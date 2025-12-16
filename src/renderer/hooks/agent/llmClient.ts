/**
 * LLM 客户端
 * 处理与 LLM 的通信
 */
import { LLMStreamChunk, LLMToolCall, LLMResult, LLMError } from '../../types/electron'
import { getEditorConfig } from '../../config/editorConfig'

const getRequestTimeout = () => getEditorConfig().performance.requestTimeoutMs

// 消息内容类型（支持文本和图片）
export type MessageContentPart =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64' | 'url'; media_type: string; data: string } }

export type MessageContent = string | MessageContentPart[]

export interface LLMMessageForSend {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: MessageContent
  toolCallId?: string
  toolName?: string
  rawParams?: Record<string, unknown>  // 工具调用的原始参数
}

export interface ToolDefinitionForSend {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<
      string,
      {
        type: string
        description: string
        enum?: string[]
      }
    >
    required?: string[]
  }
}

export interface LLMConfigForSend {
  provider: string
  model: string
  apiKey: string
  baseUrl?: string
}

export interface SendToLLMParams {
  config: LLMConfigForSend
  messages: LLMMessageForSend[]
  tools?: ToolDefinitionForSend[]
  systemPrompt: string
  onStream: (chunk: LLMStreamChunk) => void
  onToolCall: (toolCall: LLMToolCall) => void
}

export interface SendToLLMResult {
  data?: LLMResult
  error?: LLMError
}

/**
 * 发送请求到 LLM 并等待响应
 */
export async function sendToLLM(params: SendToLLMParams): Promise<SendToLLMResult> {
  return new Promise((resolve) => {
    let resolved = false
    const unsubscribers: (() => void)[] = []

    const cleanup = () => {
      if (!resolved) {
        resolved = true
        unsubscribers.forEach((unsub) => unsub())
      }
    }

    // 监听流式响应
    unsubscribers.push(window.electronAPI.onLLMStream(params.onStream))

    // 监听工具调用
    unsubscribers.push(window.electronAPI.onLLMToolCall(params.onToolCall))

    // 监听完成
    unsubscribers.push(
      window.electronAPI.onLLMDone((result) => {
        cleanup()
        resolve({ data: result })
      })
    )

    // 监听错误
    unsubscribers.push(
      window.electronAPI.onLLMError((error) => {
        cleanup()
        resolve({ error })
      })
    )

    // 超时保护
    setTimeout(() => {
      if (!resolved) {
        cleanup()
        resolve({
          error: {
            message: 'Request timeout. Please try again.',
            code: 'TIMEOUT',
            retryable: true,
          },
        })
      }
    }, getRequestTimeout())

    // 发送请求
    window.electronAPI
      .sendMessage({
        config: params.config,
        messages: params.messages as any, // 类型兼容，但 TS 无法推断
        tools: params.tools,
        systemPrompt: params.systemPrompt,
      })
      .catch((err) => {
        if (!resolved) {
          cleanup()
          resolve({
            error: {
              message: err.message || 'IPC call failed',
              code: 'IPC_ERROR',
              retryable: false,
            },
          })
        }
      })
  })
}
