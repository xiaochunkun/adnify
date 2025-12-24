/**
 * LLM 服务
 * 统一管理 LLM Provider，处理消息发送和事件分发
 */

import { BrowserWindow } from 'electron'
import { OpenAIProvider } from './providers/openai'
import { AnthropicProvider } from './providers/anthropic'
import { GeminiProvider } from './providers/gemini'
import { LLMProvider, LLMMessage, LLMConfig, ToolDefinition, LLMError, LLMErrorCode } from './types'

export class LLMService {
  private window: BrowserWindow
  private providers: Map<string, LLMProvider> = new Map()
  private currentAbortController: AbortController | null = null

  constructor(window: BrowserWindow) {
    this.window = window
  }

  /**
   * 获取或创建 Provider 实例
   */
  private getProvider(config: LLMConfig): LLMProvider {
    const adapterKey = config.adapterConfig?.id || config.adapterId || 'default'
    const key = `${config.provider}-${config.apiKey}-${config.baseUrl || 'default'}-${config.timeout || 'default'}-${adapterKey}`

    if (!this.providers.has(key)) {
      console.log('[LLMService] Creating new provider:', config.provider, 'timeout:', config.timeout)

      switch (config.provider) {
        case 'openai':
        case 'custom':
          this.providers.set(key, new OpenAIProvider(config.apiKey, config.baseUrl, config.timeout))
          break
        case 'anthropic':
          this.providers.set(key, new AnthropicProvider(config.apiKey, config.baseUrl, config.timeout))
          break
        case 'gemini':
          this.providers.set(key, new GeminiProvider(config.apiKey, config.baseUrl, config.timeout))
          break
        // OpenAI 兼容的 providers
        case 'deepseek':
          this.providers.set(key, new OpenAIProvider(
            config.apiKey,
            config.baseUrl || 'https://api.deepseek.com',
            config.timeout
          ))
          break
        case 'groq':
          this.providers.set(key, new OpenAIProvider(
            config.apiKey,
            config.baseUrl || 'https://api.groq.com/openai/v1',
            config.timeout
          ))
          break
        case 'mistral':
          this.providers.set(key, new OpenAIProvider(
            config.apiKey,
            config.baseUrl || 'https://api.mistral.ai/v1',
            config.timeout
          ))
          break
        case 'ollama':
          this.providers.set(key, new OpenAIProvider(
            config.apiKey || 'ollama', // Ollama 不需要 API key
            config.baseUrl || 'http://localhost:11434/v1',
            config.timeout
          ))
          break
        default:
          throw new LLMError(
            `Unknown provider: ${config.provider}`,
            LLMErrorCode.INVALID_REQUEST
          )
      }
    }

    return this.providers.get(key)!
  }

  /**
   * 发送消息到 LLM
   */
  async sendMessage(params: {
    config: LLMConfig
    messages: LLMMessage[]
    tools?: ToolDefinition[]
    systemPrompt?: string
  }) {
    const { config, messages, tools, systemPrompt } = params

    console.log('[LLMService] sendMessage', {
      provider: config.provider,
      model: config.model,
      messageCount: messages.length,
      hasTools: !!tools?.length,
    })

    this.currentAbortController = new AbortController()

    try {
      const provider = this.getProvider(config)

      await provider.chat({
        model: config.model,
        messages,
        tools,
        systemPrompt,
        maxTokens: config.maxTokens,
        signal: this.currentAbortController.signal,
        // 完整适配器配置
        adapterConfig: config.adapterConfig,

        onStream: (chunk) => {
          if (!this.window.isDestroyed()) {
            try {
              this.window.webContents.send('llm:stream', chunk)
            } catch (e) {
              // 忽略窗口已销毁的错误
            }
          }
        },

        onToolCall: (toolCall) => {
          if (!this.window.isDestroyed()) {
            try {
              this.window.webContents.send('llm:toolCall', toolCall)
            } catch (e) {
              // 忽略窗口已销毁的错误
            }
          }
        },

        onComplete: (result) => {
          console.log('[LLMService] Complete', {
            contentLength: result.content.length,
            toolCallCount: result.toolCalls?.length || 0,
          })
          if (!this.window.isDestroyed()) {
            try {
              this.window.webContents.send('llm:done', result)
            } catch (e) {
              // 忽略窗口已销毁的错误
            }
          }
        },

        onError: (error) => {
          console.error('[LLMService] Error', {
            code: error.code,
            message: error.message,
            retryable: error.retryable,
          })
          if (!this.window.isDestroyed()) {
            try {
              this.window.webContents.send('llm:error', {
                message: error.message,
                code: error.code,
                retryable: error.retryable,
              })
            } catch (e) {
              // 忽略窗口已销毁的错误
            }
          }
        },
      })
    } catch (error: unknown) {
      const err = error as { name?: string; message?: string }
      if (err.name !== 'AbortError') {
        console.error('[LLMService] Uncaught error:', error)
        if (!this.window.isDestroyed()) {
          try {
            this.window.webContents.send('llm:error', {
              message: err.message || 'Unknown error',
              code: LLMErrorCode.UNKNOWN,
              retryable: false,
            })
          } catch (e) {
            // 忽略窗口已销毁的错误
          }
        }
      }
    }
  }

  /**
   * 中止当前请求
   */
  abort() {
    if (this.currentAbortController) {
      console.log('[LLMService] Aborting request')
      this.currentAbortController.abort()
      this.currentAbortController = null
    }
  }

  /**
   * 清除 Provider 缓存
   */
  clearProviders() {
    this.providers.clear()
  }
}
