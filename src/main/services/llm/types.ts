/**
 * LLM 类型定义
 * 统一的接口定义，支持多种 Provider
 */

export type ProviderType = 'openai' | 'anthropic' | 'gemini' | 'deepseek' | 'groq' | 'mistral' | 'ollama' | 'custom'

export interface LLMConfig {
  provider: ProviderType
  model: string
  apiKey: string
  baseUrl?: string
  maxTokens?: number
  temperature?: number
  timeout?: number
  // Thinking 模式配置
  thinkingEnabled?: boolean
  thinkingBudget?: number
  // 自定义适配器 ID (用于工具调用格式配置)
  adapterId?: string
}

export interface TextContent {
  type: 'text'
  text: string
}

export interface ImageContent {
  type: 'image'
  source: {
    type: 'base64' | 'url'
    media_type: string
    data: string
  }
}

export type MessageContent = string | Array<TextContent | ImageContent>

export interface LLMMessage {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: MessageContent
  toolCallId?: string
  tool_call_id?: string
  toolName?: string
  rawParams?: Record<string, unknown>
  tool_calls?: Array<{
    id: string
    type: 'function'
    function: {
      name: string
      arguments: string
    }
  }>
}

export interface ToolDefinition {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, {
      type: string
      description: string
      enum?: string[]
    }>
    required?: string[]
  }
}

export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

export interface StreamChunk {
  type: 'text' | 'tool_call' | 'tool_call_start' | 'tool_call_delta' | 'tool_call_end' | 'reasoning' | 'error'
  content?: string
  toolCall?: ToolCall
  toolCallDelta?: {
    id?: string
    name?: string
    args?: string
  }
  error?: string
}

export interface ChatParams {
  model: string
  messages: LLMMessage[]
  tools?: ToolDefinition[]
  systemPrompt?: string
  maxTokens?: number
  signal?: AbortSignal
  // Thinking 模式配置
  thinkingEnabled?: boolean
  thinkingBudget?: number
  onStream: (chunk: StreamChunk) => void
  onToolCall: (toolCall: ToolCall) => void
  onComplete: (result: ChatResult) => void
  onError: (error: LLMError) => void
}

export interface ChatResult {
  content: string
  reasoning?: string
  toolCalls?: ToolCall[]
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

export class LLMError extends Error {
  constructor(
    message: string,
    public code: LLMErrorCode,
    public status?: number,
    public retryable: boolean = false,
    public details?: unknown
  ) {
    super(message)
    this.name = 'LLMError'
  }
}

export enum LLMErrorCode {
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  INVALID_API_KEY = 'INVALID_API_KEY',
  RATE_LIMIT = 'RATE_LIMIT',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  MODEL_NOT_FOUND = 'MODEL_NOT_FOUND',
  CONTEXT_LENGTH_EXCEEDED = 'CONTEXT_LENGTH_EXCEEDED',
  INVALID_REQUEST = 'INVALID_REQUEST',
  ABORTED = 'ABORTED',
  UNKNOWN = 'UNKNOWN',
}

export interface LLMProvider {
  chat(params: ChatParams): Promise<void>
}

export interface ProviderFactory {
  create(config: LLMConfig): LLMProvider
}
