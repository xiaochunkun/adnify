/**
 * Tool Call Display Component
 * 参考 void 编辑器的工具调用显示设计
 */

import { useState, useMemo, useCallback } from 'react'
import {
  ChevronRight,
  File,
  Folder,
  Terminal,
  Search,
  Edit,
  Trash2,
  Plus,
  AlertTriangle,
  Check,
  X,
  Loader2,
  Ban,
  FileText,
  FolderTree,
  Bug,
} from 'lucide-react'
import { ToolMessage, ToolMessageType } from '../../agent/types/chatTypes'
import { ToolCall } from '../../agent/types/toolTypes'
import { LLMToolCall } from '../../types/electron'

// ===== 工具图标映射 =====

import type { LucideIcon } from 'lucide-react'

const TOOL_ICONS: Record<string, LucideIcon> = {
  read_file: File,
  list_directory: Folder,
  get_dir_tree: FolderTree,
  search_files: Search,
  search_in_file: FileText,
  edit_file: Edit,
  write_file: Edit,
  create_file_or_folder: Plus,
  delete_file_or_folder: Trash2,
  run_command: Terminal,
  open_terminal: Terminal,
  run_in_terminal: Terminal,
  get_terminal_output: Terminal,
  list_terminals: Terminal,
  get_lint_errors: Bug,
}

// ===== 工具名称显示 =====

const TOOL_DISPLAY_NAMES: Record<string, string> = {
  read_file: 'Read File',
  list_directory: 'List Directory',
  get_dir_tree: 'Directory Tree',
  search_files: 'Search Files',
  search_in_file: 'Search in File',
  edit_file: 'Edit File',
  write_file: 'Write File',
  create_file_or_folder: 'Create',
  delete_file_or_folder: 'Delete',
  run_command: 'Run Command',
  open_terminal: 'Open Terminal',
  run_in_terminal: 'Run in Terminal',
  get_terminal_output: 'Terminal Output',
  list_terminals: 'List Terminals',
  get_lint_errors: 'Lint Errors',
}

// ===== 状态指示器 =====

interface StatusIndicatorProps {
  status: ToolMessageType | 'pending' | 'running'
}

function StatusIndicator({ status }: StatusIndicatorProps) {
  switch (status) {
    case 'running_now':
    case 'running':
    case 'pending':
      return <Loader2 className="w-3.5 h-3.5 text-accent animate-spin" />
    case 'success':
      return <Check className="w-3.5 h-3.5 text-green-500" />
    case 'tool_error':
    case 'invalid_params':
      return <AlertTriangle className="w-3.5 h-3.5 text-warning" />
    case 'rejected':
      return <Ban className="w-3.5 h-3.5 text-text-muted" />
    case 'tool_request':
      return <div className="w-3.5 h-3.5 rounded-full bg-accent/20 animate-pulse" />
    default:
      return <div className="w-2 h-2 rounded-full bg-text-muted" />
  }
}

// ===== 工具参数显示 =====

interface ToolParamsProps {
  params: Record<string, unknown>
  toolName: string
}

function ToolParams({ params, toolName }: ToolParamsProps) {
  const displayParams = useMemo(() => {
    const entries = Object.entries(params)
    
    // 特殊处理某些工具的参数显示
    if (toolName === 'edit_file' && params.search_replace_blocks) {
      return entries.filter(([key]) => key !== 'search_replace_blocks')
    }
    
    return entries.slice(0, 3) // 最多显示 3 个参数
  }, [params, toolName])

  if (displayParams.length === 0) return null

  return (
    <div className="text-xs text-text-muted truncate">
      {displayParams.map(([key, value], i) => (
        <span key={key}>
          {i > 0 && ' • '}
          <span className="text-text-secondary">{key}:</span>{' '}
          {typeof value === 'string' ? value.slice(0, 50) : JSON.stringify(value).slice(0, 30)}
        </span>
      ))}
    </div>
  )
}

// ===== 工具结果显示 =====

interface ToolResultProps {
  content: string
  isError?: boolean
}

function ToolResult({ content, isError }: ToolResultProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const lines = content.split('\n')
  const shouldTruncate = lines.length > 10 || content.length > 500

  const displayContent = useMemo(() => {
    if (!shouldTruncate || isExpanded) return content
    return lines.slice(0, 10).join('\n') + (lines.length > 10 ? '\n...' : '')
  }, [content, lines, shouldTruncate, isExpanded])

  return (
    <div className={`mt-2 text-xs ${isError ? 'text-warning' : 'text-text-secondary'}`}>
      <pre className="whitespace-pre-wrap font-mono bg-surface/50 rounded p-2 overflow-x-auto max-h-60 overflow-y-auto">
        {displayContent}
      </pre>
      {shouldTruncate && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-1 text-accent hover:underline"
        >
          {isExpanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  )
}

// ===== 审批按钮 =====

interface ApprovalButtonsProps {
  onApprove: () => void
  onReject: () => void
}

function ApprovalButtons({ onApprove, onReject }: ApprovalButtonsProps) {
  return (
    <div className="flex items-center gap-2 mt-2">
      <button
        onClick={onApprove}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-500/10 text-green-500 hover:bg-green-500/20 rounded-md transition-colors"
      >
        <Check className="w-3.5 h-3.5" />
        Approve
      </button>
      <button
        onClick={onReject}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-md transition-colors"
      >
        <X className="w-3.5 h-3.5" />
        Reject
      </button>
    </div>
  )
}

// ===== 主组件 =====

interface ToolCallDisplayProps {
  toolCall: ToolCall | ToolMessage | LLMToolCall
  onApprove?: () => void
  onReject?: () => void
  onFileClick?: (path: string) => void
}

export function ToolCallDisplay({
  toolCall,
  onApprove,
  onReject,
  onFileClick,
}: ToolCallDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // 判断是 ToolCall 还是 ToolMessage
  const isToolMessage = 'role' in toolCall && toolCall.role === 'tool'
  
  const name = toolCall.name
  const params = isToolMessage
    ? (toolCall as ToolMessage).params || (toolCall as ToolMessage).rawParams
    : (toolCall as ToolCall).arguments
  const status: ToolMessageType | 'pending' | 'running' = isToolMessage
    ? (toolCall as ToolMessage).type
    : (toolCall as ToolCall).status === 'running'
    ? 'running'
    : (toolCall as ToolCall).status === 'success'
    ? 'success'
    : (toolCall as ToolCall).status === 'error'
    ? 'tool_error'
    : 'pending'
  const content = isToolMessage
    ? (toolCall as ToolMessage).content
    : (toolCall as ToolCall).result || ''
  const error = !isToolMessage ? (toolCall as ToolCall).error : undefined

  const Icon = TOOL_ICONS[name] || File
  const displayName = TOOL_DISPLAY_NAMES[name] || name

  // 获取主要描述（如文件路径）
  const primaryDesc = useMemo(() => {
    if (params.path) return String(params.path).split(/[\\/]/).pop()
    if (params.command) return String(params.command).slice(0, 50)
    if (params.name) return String(params.name)
    return null
  }, [params])

  // 是否需要审批
  const needsApproval = status === 'tool_request' && onApprove && onReject

  // 是否有结果可显示
  const hasResult = content && status !== 'tool_request' && status !== 'running_now'
  const isError = status === 'tool_error' || status === 'invalid_params'

  // 点击文件路径
  const handleFileClick = useCallback(() => {
    if (params.path && onFileClick) {
      onFileClick(String(params.path))
    }
  }, [params.path, onFileClick])

  return (
    <div className="border border-border-subtle rounded-lg bg-surface/30 overflow-hidden">
      {/* Header */}
      <div
        className={`flex items-center gap-2 px-3 py-2 ${
          hasResult ? 'cursor-pointer hover:bg-surface/50' : ''
        } transition-colors`}
        onClick={() => hasResult && setIsExpanded(!isExpanded)}
      >
        {/* Expand Icon */}
        {hasResult && (
          <ChevronRight
            className={`w-4 h-4 text-text-muted transition-transform ${
              isExpanded ? 'rotate-90' : ''
            }`}
          />
        )}

        {/* Status */}
        <StatusIndicator status={status} />

        {/* Tool Icon */}
        <Icon className="w-4 h-4 text-text-secondary" />

        {/* Tool Name */}
        <span className="text-sm font-medium text-text-primary">{displayName}</span>

        {/* Primary Description */}
        {primaryDesc && (
          <span
            className={`text-sm text-text-muted truncate ${
              params.path && onFileClick ? 'hover:text-accent cursor-pointer' : ''
            }`}
            onClick={(e) => {
              if (params.path && onFileClick) {
                e.stopPropagation()
                handleFileClick()
              }
            }}
          >
            {primaryDesc}
          </span>
        )}

        {/* Error indicator */}
        {error && (
          <span className="ml-auto text-xs text-warning truncate max-w-[200px]">{error}</span>
        )}
      </div>

      {/* Params (collapsed view) */}
      {!isExpanded && !needsApproval && (
        <div className="px-3 pb-2">
          <ToolParams params={params} toolName={name} />
        </div>
      )}

      {/* Approval Buttons */}
      {needsApproval && (
        <div className="px-3 pb-3">
          <ApprovalButtons onApprove={onApprove} onReject={onReject} />
        </div>
      )}

      {/* Expanded Content */}
      {isExpanded && hasResult && (
        <div className="px-3 pb-3 border-t border-border-subtle">
          <ToolResult content={content} isError={isError} />
        </div>
      )}
    </div>
  )
}

// ===== 工具调用列表 =====

interface ToolCallListProps {
  toolCalls: (ToolCall | ToolMessage | LLMToolCall)[]
  pendingToolId?: string
  onApprove?: () => void
  onReject?: () => void
  onFileClick?: (path: string) => void
}

export function ToolCallList({
  toolCalls,
  pendingToolId,
  onApprove,
  onReject,
  onFileClick,
}: ToolCallListProps) {
  if (toolCalls.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      {toolCalls.map((tc) => {
        const id = 'id' in tc ? tc.id : ''
        const isPending = id === pendingToolId

        return (
          <ToolCallDisplay
            key={id}
            toolCall={tc}
            onApprove={isPending ? onApprove : undefined}
            onReject={isPending ? onReject : undefined}
            onFileClick={onFileClick}
          />
        )
      })}
    </div>
  )
}

export default ToolCallDisplay
