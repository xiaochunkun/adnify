/**
 * MCP (Model Context Protocol) 共享类型定义
 */

// ============================================
// 配置类型
// ============================================

/** MCP 服务器配置 */
export interface McpServerConfig {
  /** 服务器唯一标识 */
  id: string
  /** 显示名称 */
  name: string
  /** 启动命令 */
  command: string
  /** 命令参数 */
  args?: string[]
  /** 环境变量 */
  env?: Record<string, string>
  /** 是否禁用 */
  disabled?: boolean
  /** 自动批准的工具列表 */
  autoApprove?: string[]
  /** 工作目录 */
  cwd?: string
}

/** MCP 配置文件结构 */
export interface McpConfig {
  mcpServers: Record<string, Omit<McpServerConfig, 'id'>>
}

// ============================================
// 服务器状态
// ============================================

export type McpServerStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

/** MCP 服务器运行时状态 */
export interface McpServerState {
  id: string
  config: McpServerConfig
  status: McpServerStatus
  error?: string
  tools: McpTool[]
  resources: McpResource[]
  prompts: McpPrompt[]
  lastConnected?: number
}

// ============================================
// MCP 协议类型
// ============================================

/** MCP 工具定义 */
export interface McpTool {
  name: string
  description?: string
  inputSchema: {
    type: 'object'
    properties?: Record<string, McpToolProperty>
    required?: string[]
  }
}

export interface McpToolProperty {
  type: string
  description?: string
  enum?: string[]
  items?: McpToolProperty
  properties?: Record<string, McpToolProperty>
}

/** MCP 资源定义 */
export interface McpResource {
  uri: string
  name: string
  description?: string
  mimeType?: string
}

/** MCP 提示模板定义 */
export interface McpPrompt {
  name: string
  description?: string
  arguments?: McpPromptArgument[]
}

export interface McpPromptArgument {
  name: string
  description?: string
  required?: boolean
}

// ============================================
// 工具调用
// ============================================

/** MCP 工具调用请求 */
export interface McpToolCallRequest {
  serverId: string
  toolName: string
  arguments: Record<string, unknown>
}

/** MCP 工具调用结果 */
export interface McpToolCallResult {
  success: boolean
  content?: McpContent[]
  error?: string
  isError?: boolean
}

/** MCP 内容类型 */
export interface McpContent {
  type: 'text' | 'image' | 'resource'
  text?: string
  data?: string
  mimeType?: string
  uri?: string
}

// ============================================
// 资源操作
// ============================================

/** 资源读取请求 */
export interface McpResourceReadRequest {
  serverId: string
  uri: string
}

/** 资源读取结果 */
export interface McpResourceReadResult {
  success: boolean
  contents?: McpResourceContent[]
  error?: string
}

export interface McpResourceContent {
  uri: string
  mimeType?: string
  text?: string
  blob?: string
}

// ============================================
// 提示操作
// ============================================

/** 提示获取请求 */
export interface McpPromptGetRequest {
  serverId: string
  promptName: string
  arguments?: Record<string, string>
}

/** 提示获取结果 */
export interface McpPromptGetResult {
  success: boolean
  description?: string
  messages?: McpPromptMessage[]
  error?: string
}

export interface McpPromptMessage {
  role: 'user' | 'assistant'
  content: McpContent
}

// ============================================
// IPC 事件类型
// ============================================

export interface McpServerStatusEvent {
  serverId: string
  status: McpServerStatus
  error?: string
}

export interface McpToolsUpdatedEvent {
  serverId: string
  tools: McpTool[]
}

export interface McpResourcesUpdatedEvent {
  serverId: string
  resources: McpResource[]
}
