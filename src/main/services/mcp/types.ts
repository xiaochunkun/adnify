/**
 * MCP 主进程内部类型定义
 */

import type { ChildProcess } from 'child_process'
import type { McpServerConfig, McpTool, McpResource, McpPrompt, McpServerStatus } from '@shared/types/mcp'

/** MCP 客户端内部状态 */
export interface McpClientState {
  config: McpServerConfig
  process: ChildProcess | null
  status: McpServerStatus
  error?: string
  tools: McpTool[]
  resources: McpResource[]
  prompts: McpPrompt[]
  requestId: number
  pendingRequests: Map<number, PendingRequest>
  messageBuffer: string
}

/** 待处理请求 */
export interface PendingRequest {
  resolve: (value: any) => void
  reject: (error: Error) => void
  timeout: NodeJS.Timeout
}

/** JSON-RPC 请求 */
export interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: number
  method: string
  params?: Record<string, unknown>
}

/** JSON-RPC 响应 */
export interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: number
  result?: unknown
  error?: {
    code: number
    message: string
    data?: unknown
  }
}

/** JSON-RPC 通知 */
export interface JsonRpcNotification {
  jsonrpc: '2.0'
  method: string
  params?: Record<string, unknown>
}

/** MCP 初始化结果 */
export interface McpInitializeResult {
  protocolVersion: string
  capabilities: {
    tools?: { listChanged?: boolean }
    resources?: { subscribe?: boolean; listChanged?: boolean }
    prompts?: { listChanged?: boolean }
  }
  serverInfo: {
    name: string
    version: string
  }
}

/** MCP 工具列表结果 */
export interface McpToolsListResult {
  tools: McpTool[]
}

/** MCP 资源列表结果 */
export interface McpResourcesListResult {
  resources: McpResource[]
}

/** MCP 提示列表结果 */
export interface McpPromptsListResult {
  prompts: McpPrompt[]
}

/** MCP 工具调用结果 */
export interface McpToolCallResponse {
  content: Array<{
    type: 'text' | 'image' | 'resource'
    text?: string
    data?: string
    mimeType?: string
  }>
  isError?: boolean
}
