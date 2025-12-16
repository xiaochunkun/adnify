/**
 * Chat 类型定义
 * 参考 void 编辑器的 chatThreadServiceTypes.ts
 */

// ===== 工具消息类型 =====

export type ToolMessageType =
  | 'invalid_params'   // 参数验证失败
  | 'tool_request'     // 等待用户审批
  | 'running_now'      // 正在执行
  | 'tool_error'       // 执行出错
  | 'success'          // 执行成功
  | 'rejected'         // 用户拒绝

export interface ToolMessage {
  role: 'tool'
  type: ToolMessageType
  id: string                // 内部消息 ID
  toolCallId: string        // LLM 返回的原始 tool_call_id
  name: string
  content: string           // 给 LLM 的结果字符串
  rawParams: Record<string, unknown>  // 原始参数
  params?: Record<string, unknown>    // 验证后的参数
  result?: unknown          // 工具执行结果
}

// ===== 检查点类型 =====

export interface FileSnapshot {
  content: string
  mtime?: number
}

export interface CheckpointEntry {
  role: 'checkpoint'
  id: string
  type: 'user_message' | 'tool_edit'
  timestamp: string
  description: string
  snapshots: Record<string, FileSnapshot>  // fsPath -> snapshot
  userModifications?: {
    snapshots: Record<string, FileSnapshot>
  }
}

// ===== 文件选择类型 =====

export type StagingSelectionType = 'File' | 'CodeSelection' | 'Folder'

export interface StagingSelectionBase {
  uri: string  // 文件路径
  language?: string
}

export interface FileSelection extends StagingSelectionBase {
  type: 'File'
  state: { wasAddedAsCurrentFile: boolean }
}

export interface CodeSelection extends StagingSelectionBase {
  type: 'CodeSelection'
  range: [number, number]  // [startLine, endLine]
  state: { wasAddedAsCurrentFile: boolean }
}

export interface FolderSelection extends StagingSelectionBase {
  type: 'Folder'
}

export type StagingSelectionItem = FileSelection | CodeSelection | FolderSelection

// ===== 用户消息类型 =====

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

export interface UserMessage {
  role: 'user'
  id: string
  content: MessageContent
  displayContent?: string  // 显示给用户的内容（可能与发送给 LLM 的不同）
  selections?: StagingSelectionItem[]
  state?: {
    stagingSelections: StagingSelectionItem[]
    isBeingEdited: boolean
  }
}

// ===== 内嵌工具调用类型 (Cursor 风格) =====

export interface InlineToolCall {
  id: string              // LLM 返回的 tool_call_id
  name: string
  status: ToolMessageType
  rawParams: Record<string, unknown>
  result?: string
  error?: string
}

// ===== 助手消息类型 =====

export interface AssistantMessage {
  role: 'assistant'
  id: string
  content: string
  displayContent?: string
  reasoning?: string
  isStreaming?: boolean
  toolCallIds?: string[]  // 关联的工具调用 ID (兼容旧逻辑)
  toolCalls?: InlineToolCall[]  // 内嵌工具调用 (Cursor 风格)
}

// ===== 中断的工具调用 =====

export interface InterruptedToolMessage {
  role: 'interrupted_streaming_tool'
  id: string
  name: string
}

// ===== 聊天消息联合类型 =====

export type ChatMessage =
  | UserMessage
  | AssistantMessage
  | ToolMessage
  | InterruptedToolMessage
  | CheckpointEntry

// ===== 流状态类型 =====

export type StreamRunningType =
  | 'LLM'           // LLM 正在流式输出
  | 'tool'          // 工具正在执行
  | 'awaiting_user' // 等待用户审批
  | 'idle'          // 空闲（循环中间状态）
  | undefined       // 完全停止

export interface LLMStreamInfo {
  displayContentSoFar: string
  reasoningSoFar: string
  toolCallSoFar: RawToolCallObj | null
}

export interface ToolStreamInfo {
  toolName: string
  toolParams: Record<string, unknown>
  id: string
  content: string
  rawParams: Record<string, unknown>
}

export interface RawToolCallObj {
  name: string
  rawParams: Record<string, unknown>
  doneParams: string[]
  id: string
  isDone: boolean
}

export interface StreamState {
  isRunning: StreamRunningType
  error?: { message: string; fullError: Error | null }
  llmInfo?: LLMStreamInfo
  toolInfo?: ToolStreamInfo
  interrupt?: Promise<() => void>
}

// ===== 线程类型 =====

export interface ChatThread {
  id: string
  createdAt: string
  lastModified: string
  messages: ChatMessage[]
  state: {
    currCheckpointIdx: number | null
    stagingSelections: StagingSelectionItem[]
    focusedMessageIdx?: number
  }
}

export interface ThreadsState {
  allThreads: Record<string, ChatThread | undefined>
  currentThreadId: string
}

// ===== 工具审批类型 =====

export type ToolApprovalType = 'edits' | 'terminal' | 'dangerous' | 'mcp'

export const TOOL_APPROVAL_TYPES: Record<string, ToolApprovalType> = {
  write_file: 'edits',
  edit_file: 'edits',
  create_file_or_folder: 'edits',
  delete_file_or_folder: 'dangerous',
  run_command: 'terminal',
  run_in_terminal: 'terminal',
  open_terminal: 'terminal',
}

// ===== 辅助函数 =====

export function isUserMessage(msg: ChatMessage): msg is UserMessage {
  return msg.role === 'user'
}

export function isAssistantMessage(msg: ChatMessage): msg is AssistantMessage {
  return msg.role === 'assistant'
}

export function isToolMessage(msg: ChatMessage): msg is ToolMessage {
  return msg.role === 'tool'
}

export function isCheckpoint(msg: ChatMessage): msg is CheckpointEntry {
  return msg.role === 'checkpoint'
}

export function getMessageText(content: MessageContent): string {
  if (typeof content === 'string') return content
  return content
    .filter((c): c is TextContent => c.type === 'text')
    .map((c) => c.text)
    .join('')
}
