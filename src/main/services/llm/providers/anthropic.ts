/**
 * Anthropic Provider
 * 支持 Claude 系列模型
 * 
 * 认证方式：
 * - 官方 API: x-api-key header
 * - 自定义 baseUrl (代理): Bearer token (可通过 advanced.auth 配置)
 */

import { logger } from '@shared/utils/Logger'
import Anthropic from '@anthropic-ai/sdk'
import { BaseProvider } from './base'
import { ChatParams, ToolDefinition, LLMToolCall, MessageContent, LLMErrorCode, LLMConfig } from '../types'
import { adapterService } from '../adapterService'
import { AGENT_DEFAULTS } from '@shared/constants'

export class AnthropicProvider extends BaseProvider {
  private client: Anthropic
  private apiKey: string
  private baseUrl?: string
  private timeout: number
  private useBearer: boolean  // 是否使用 Bearer token 认证

  constructor(config: LLMConfig) {
    super('Anthropic')
    this.apiKey = config.apiKey
    this.timeout = config.timeout || AGENT_DEFAULTS.DEFAULT_LLM_TIMEOUT
    
    // 处理 baseUrl
    let baseUrl = config.baseUrl
    if (baseUrl) {
      // 去掉末尾的 /v1（Anthropic SDK 会自动加）
      baseUrl = baseUrl.replace(/\/v1\/?$/, '')
      this.baseUrl = baseUrl
    }
    
    // 判断认证方式
    // 1. 如果配置了 advanced.auth，使用配置的认证方式
    // 2. 如果是自定义 baseUrl（代理），默认使用 Bearer token
    // 3. 否则使用 Anthropic 默认的 x-api-key
    const authConfig = config.advanced?.auth
    if (authConfig) {
      this.useBearer = authConfig.type === 'bearer'
    } else {
      // 自定义 baseUrl 默认使用 Bearer token
      this.useBearer = !!this.baseUrl
    }
    
    this.log('info', 'Initialized', { baseUrl: this.baseUrl || 'default', useBearer: this.useBearer })
    
    // 创建 Anthropic client
    const clientOptions: ConstructorParameters<typeof Anthropic>[0] = {
      apiKey: this.apiKey,
      timeout: this.timeout,
    }
    
    if (this.baseUrl) {
      clientOptions.baseURL = this.baseUrl
    }
    
    // 如果使用 Bearer token，添加 Authorization header
    if (this.useBearer) {
      clientOptions.defaultHeaders = {
        Authorization: `Bearer ${this.apiKey}`,
        'anthropic-beta': 'interleaved-thinking-2025-05-14',
      }
    } else {
      // 即使不用 Bearer，也需要 beta header 来支持 thinking
      clientOptions.defaultHeaders = {
        'anthropic-beta': 'interleaved-thinking-2025-05-14',
      }
    }
    
    // 应用自定义请求头
    if (config.advanced?.request?.headers) {
      clientOptions.defaultHeaders = {
        ...clientOptions.defaultHeaders,
        ...config.advanced.request.headers,
      }
    }
    
    this.client = new Anthropic(clientOptions)
  }

  private convertContent(
    content: MessageContent
  ): string | Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam> {
    if (typeof content === 'string') return content
    
    // 处理空数组
    if (!content || content.length === 0) {
      logger.system.warn('[Anthropic] Empty content array, returning empty string')
      return ''
    }

    return content.map((part) => {
      if (part.type === 'text') {
        // 确保 text 不是 undefined 或 null
        if (part.text === undefined || part.text === null) {
          logger.system.warn('[Anthropic] Text part has invalid text:', part)
          return { type: 'text', text: '' }
        }
        return { type: 'text', text: part.text }
      } else {
        if (part.source.type === 'url') {
          logger.system.warn('Anthropic provider received URL image, which is not directly supported.')
          return { type: 'text', text: '[Image URL not supported]' }
        }
        return {
          type: 'image',
          source: {
            type: 'base64',
            media_type: part.source.media_type as
              | 'image/jpeg'
              | 'image/png'
              | 'image/gif'
              | 'image/webp',
            data: part.source.data,
          },
        }
      }
    })
  }

  private convertTools(tools?: ToolDefinition[], adapterId?: string): Anthropic.Tool[] | undefined {
    if (!tools?.length) return undefined

    if (adapterId && adapterId !== 'anthropic') {
      return adapterService.convertTools(tools, adapterId) as Anthropic.Tool[]
    }

    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters as Anthropic.Tool['input_schema'],
    }))
  }

  async chat(params: ChatParams): Promise<void> {
    const {
      model,
      messages,
      tools,
      systemPrompt,
      signal,
      adapterConfig,
      onStream,
      onToolCall,
      onComplete,
      onError,
    } = params

    try {
      this.log('info', 'Chat', { 
        model, 
        messageCount: messages.length,
        temperature: params.temperature,
        topP: params.topP,
        maxTokens: params.maxTokens,
      })

      const anthropicMessages: Anthropic.MessageParam[] = []
      let extractedSystemPrompt = systemPrompt || ''

      for (const msg of messages) {
        // 提取 system 消息作为 system prompt
        if (msg.role === 'system') {
          const content = typeof msg.content === 'string' 
            ? msg.content 
            : Array.isArray(msg.content) 
              ? msg.content.map(p => p.type === 'text' ? p.text : '').join('')
              : ''
          if (content) {
            extractedSystemPrompt = extractedSystemPrompt ? `${extractedSystemPrompt}\n\n${content}` : content
          }
          continue
        }
        
        if (msg.role === 'tool') {
          // 获取 tool_call_id（可能在 toolCallId 或 tool_call_id 字段）
          const toolCallId = msg.toolCallId || (msg as any).tool_call_id
          if (!toolCallId) {
            continue
          }
          anthropicMessages.push({
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: toolCallId,
                content:
                  typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
              },
            ],
          })
        } else if (msg.role === 'assistant' && (msg as any).tool_calls?.length > 0) {
          // OpenAI 格式的 tool_calls
          const toolCalls = (msg as any).tool_calls as Array<{
            id: string
            type: string
            function: { name: string; arguments: string }
          }>
          
          const contentBlocks: Anthropic.ContentBlockParam[] = []
          
          // 如果有文本内容，先添加
          if (msg.content) {
            const textContent = typeof msg.content === 'string' ? msg.content : ''
            if (textContent) {
              contentBlocks.push({ type: 'text', text: textContent })
            }
          }
          
          // 添加 tool_use blocks
          for (const tc of toolCalls) {
            let input: Record<string, unknown> = {}
            try {
              let argsStr = tc.function.arguments || '{}'
              // 清理可能的多余字符
              const firstBrace = argsStr.indexOf('{')
              const lastBrace = argsStr.lastIndexOf('}')
              if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                argsStr = argsStr.slice(firstBrace, lastBrace + 1)
              }
              input = JSON.parse(argsStr)
            } catch (e) {
              logger.system.warn('[Anthropic] Failed to parse tool arguments:', e)
            }
            contentBlocks.push({
              type: 'tool_use',
              id: tc.id,
              name: tc.function.name,
              input,
            })
          }
          
          anthropicMessages.push({
            role: 'assistant',
            content: contentBlocks,
          })
        } else if (msg.role === 'assistant' && msg.toolName) {
          // 旧格式：单个工具调用
          let input: Record<string, unknown> = {}
          try {
            const contentStr = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
            let argsStr = contentStr || '{}'
            const firstBrace = argsStr.indexOf('{')
            const lastBrace = argsStr.lastIndexOf('}')
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
              argsStr = argsStr.slice(firstBrace, lastBrace + 1)
            }
            input = JSON.parse(argsStr)
          } catch (e) {
            logger.system.warn('[Anthropic] Failed to parse tool content:', e)
          }
          anthropicMessages.push({
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: msg.toolCallId!,
                name: msg.toolName,
                input,
              },
            ],
          })
        } else if (msg.role === 'user' || msg.role === 'assistant') {
          // 跳过内容为空的消息
          if (msg.content === undefined || msg.content === null) {
            continue
          }
          anthropicMessages.push({
            role: msg.role,
            content: this.convertContent(msg.content),
          })
        }
      }

      // 构建请求参数
      const requestParams: Record<string, unknown> = {
        model,
        max_tokens: params.maxTokens || AGENT_DEFAULTS.DEFAULT_MAX_TOKENS,
        messages: anthropicMessages,
      }

      // 添加 LLM 参数（稍后会根据 thinking 模式调整）
      if (params.temperature !== undefined) {
        requestParams.temperature = params.temperature
      }
      if (params.topP !== undefined) {
        requestParams.top_p = params.topP
      }

      if (extractedSystemPrompt) {
        requestParams.system = extractedSystemPrompt
      }

      const convertedTools = this.convertTools(tools, adapterConfig?.id)
      if (convertedTools && convertedTools.length > 0) {
        requestParams.tools = convertedTools
      }

      // 应用适配器的请求体模板参数
      if (adapterConfig?.request?.bodyTemplate) {
        const template = adapterConfig.request.bodyTemplate
        for (const [key, value] of Object.entries(template)) {
          if (typeof value === 'string' && value.startsWith('{{')) continue
          if (['model', 'messages', 'system', 'tools'].includes(key)) continue
          requestParams[key] = value
        }
      }
      
      // 如果启用了 thinking 模式，必须移除 temperature 和 top_p（Anthropic API 要求）
      if (requestParams.thinking) {
        delete requestParams.temperature
        delete requestParams.top_p
      }

      // 打印请求体用于调试（不含 system 和 tools 详情）
      const debugParams = {
        ...requestParams,
        system: requestParams.system ? `[${(requestParams.system as string).length} chars]` : undefined,
        tools: convertedTools ? `[${convertedTools.length} tools]` : undefined,
      }
      logger.system.info('[Anthropic] Request body:', JSON.stringify(debugParams, null, 2))

      const stream = this.client.messages.stream(
        requestParams as unknown as Anthropic.MessageCreateParamsStreaming,
        { signal }
      )

      let fullContent = ''
      const toolCalls: LLMToolCall[] = []

      stream.on('text', (text) => {
        fullContent += text
        onStream({ type: 'text', content: text })
      })

      // 支持 Anthropic 的原生思考块
      stream.on('streamEvent', (event) => {
        if (event.type === 'content_block_delta' && event.delta.type === 'thinking_delta') {
          const thinking = (event.delta as any).thinking
          onStream({ type: 'reasoning', content: thinking })
        }
      })

      const finalMessage = await stream.finalMessage()

      for (const block of finalMessage.content) {
        if (block.type === 'tool_use') {
          const toolCall: LLMToolCall = {
            id: block.id,
            name: block.name,
            arguments: block.input as Record<string, unknown>,
          }
          toolCalls.push(toolCall)
          onToolCall(toolCall)
        }
      }

      onComplete({
        content: fullContent,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        usage: {
          promptTokens: finalMessage.usage.input_tokens,
          completionTokens: finalMessage.usage.output_tokens,
          totalTokens: finalMessage.usage.input_tokens + finalMessage.usage.output_tokens,
        },
      })
    } catch (error: unknown) {
      const llmError = this.parseError(error)
      if (llmError.code === LLMErrorCode.ABORTED) {
        this.log('info', 'Chat aborted by user')
      } else {
        this.log('error', 'Chat failed', { code: llmError.code, message: llmError.message })
      }
      onError(llmError)
    }
  }
}
