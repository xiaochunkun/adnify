/**
 * Tool Call Display Component
 * Cursor 风格的工具调用显示 - 写入操作显示代码预览，读取操作简洁显示
 */

import { useState, useMemo, useCallback } from 'react'
import {
  ChevronRight,
  ChevronDown,
  Check,
  X,
  Loader2,
  Ban,
  CheckCircle2,
  XCircle,
  ExternalLink,
  FileCode,
} from 'lucide-react'
import { ToolMessage, ToolMessageType } from '../../agent/types/chatTypes'
import { ToolCall } from '../../agent/types/toolTypes'
import { LLMToolCall } from '../../types/electron'
import DiffViewer from '../DiffViewer'

// ===== 类型定义 =====

type AnyToolCall = ToolCall | ToolMessage | LLMToolCall
type ToolStatus = ToolMessageType | 'pending' | 'running'

// ===== 工具名称显示 =====

const TOOL_DISPLAY_NAMES: Record<string, string> = {
  read_file: 'Read',
  list_directory: 'List',
  get_dir_tree: 'Tree',
  search_files: 'Search',
  search_in_file: 'Search',
  edit_file: 'Edit',
  write_file: 'Write',
  create_file_or_folder: 'Create',
  delete_file_or_folder: 'Delete',
  run_command: 'Command',
  run_in_terminal: 'Terminal',
  get_lint_errors: 'Lint',
}

// 写入类文件操作（显示代码预览）
const WRITE_TOOLS = ['edit_file', 'write_file', 'create_file_or_folder', 'delete_file_or_folder']

// ===== 工具函数 =====

function getToolCallStatus(tc: AnyToolCall): ToolStatus {
  const isToolMessage = 'role' in tc && tc.role === 'tool'
  if (isToolMessage) return (tc as ToolMessage).type
  
  const toolCall = tc as ToolCall
  if (toolCall.status === 'running' || toolCall.status === 'running_now') return 'running_now'
  if (toolCall.status === 'success') return 'success'
  if (toolCall.status === 'error' || toolCall.status === 'tool_error') return 'tool_error'
  if (toolCall.status === 'tool_request') return 'tool_request'
  if (toolCall.status === 'rejected') return 'rejected'
  return 'pending'
}

function getToolCallParams(tc: AnyToolCall): Record<string, unknown> {
  const isToolMessage = 'role' in tc && tc.role === 'tool'
  if (isToolMessage) {
    return (tc as ToolMessage).params || (tc as ToolMessage).rawParams || {}
  }
  const toolCall = tc as ToolCall & { rawParams?: Record<string, unknown> }
  return toolCall.arguments || toolCall.rawParams || {}
}

function getToolCallResult(tc: AnyToolCall): string {
  const isToolMessage = 'role' in tc && tc.role === 'tool'
  return isToolMessage ? (tc as ToolMessage).content : (tc as ToolCall).result || ''
}

function isInProgress(status: ToolStatus): boolean {
  return status === 'pending' || status === 'running_now' || status === 'running' || status === 'tool_request'
}

// ===== 状态指示器 =====

function StatusIndicator({ status }: { status: ToolStatus }) {
  switch (status) {
    case 'running_now':
    case 'running':
    case 'pending':
      return <Loader2 className="w-3.5 h-3.5 text-accent animate-spin" />
    case 'success':
      return <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
    case 'tool_error':
    case 'invalid_params':
      return <XCircle className="w-3.5 h-3.5 text-red-500" />
    case 'rejected':
      return <Ban className="w-3.5 h-3.5 text-text-muted" />
    case 'tool_request':
      return <div className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" />
    default:
      return <div className="w-2.5 h-2.5 rounded-full bg-text-muted/50" />
  }
}

// ===== 文件变更预览 (Cursor 风格) =====

interface FileChangePreviewProps {
  toolCall: AnyToolCall
  isPending: boolean
  onApprove?: () => void
  onReject?: () => void
  onFileClick?: (path: string) => void
  onShowDiff?: (path: string, oldContent: string, newContent: string) => void
}

function FileChangePreview({ 
  toolCall, 
  isPending, 
  onApprove, 
  onReject, 
  onFileClick,
  onShowDiff,
}: FileChangePreviewProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [showFullDiff, setShowFullDiff] = useState(false)
  
  const name = toolCall.name
  const params = getToolCallParams(toolCall)
  const status = getToolCallStatus(toolCall)
  const path = params?.path ? String(params.path) : ''
  const fileName = path.split(/[\\/]/).pop() || path
  const isStreamingParams = params?._streaming === true
  
  // 获取代码内容
  const content = params?.content ? String(params.content) : 
                  params?.new_string ? String(params.new_string) : ''
  const oldContent = params?.old_string ? String(params.old_string) : ''
  
  const linesAdded = content ? content.split('\n').length : 0
  const linesRemoved = oldContent ? oldContent.split('\n').length : 0
  const isEdit = name === 'edit_file'
  const isCreate = name === 'write_file' || name === 'create_file_or_folder'
  const isDelete = name === 'delete_file_or_folder'
  
  const needsApproval = status === 'tool_request' && isPending && onApprove && onReject
  const isStreaming = status === 'pending' || status === 'running_now' || isStreamingParams
  const isCompleted = status === 'success' || status === 'rejected' || status === 'tool_error'
  const error = !('role' in toolCall) ? (toolCall as ToolCall).error : undefined
  
  // 是否有内容可预览
  const hasContent = content.length > 0 || oldContent.length > 0
  
  // 点击卡片：展开/收起预览，不跳转文件
  const handleCardClick = useCallback(() => {
    if (hasContent) {
      setIsExpanded(!isExpanded)
    }
  }, [hasContent, isExpanded])
  
  // 点击外部链接按钮：在编辑器中打开 diff 或文件
  const handleOpenInEditor = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (onShowDiff && isEdit && oldContent && content) {
      onShowDiff(path, oldContent, content)
    } else if (onFileClick && path) {
      onFileClick(path)
    }
  }, [onShowDiff, onFileClick, path, oldContent, content, isEdit])
  
  // 切换完整 diff 视图
  const toggleFullDiff = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setShowFullDiff(!showFullDiff)
  }, [showFullDiff])

  return (
    <div className={`
      rounded-lg border overflow-hidden transition-all
      ${needsApproval ? 'border-amber-500/50 bg-amber-500/5' : 
        isStreaming ? 'border-blue-500/40 bg-blue-500/5' :
        status === 'success' ? 'border-green-500/30 bg-green-500/5' :
        status === 'tool_error' ? 'border-red-500/30 bg-red-500/5' :
        'border-border-subtle/50 bg-bg-secondary/30'}
    `}>
      {/* Header */}
      <div
        className={`flex items-center gap-2 px-3 py-2.5 transition-colors ${hasContent ? 'cursor-pointer hover:bg-white/5' : ''}`}
        onClick={handleCardClick}
      >
        {/* 展开/收起图标 */}
        {hasContent && (
          isExpanded ? (
            <ChevronDown className="w-4 h-4 text-text-muted flex-shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-text-muted flex-shrink-0" />
          )
        )}
        
        {/* 文件图标 */}
        <FileCode className={`w-4 h-4 flex-shrink-0 ${
          isStreaming ? 'text-blue-400' :
          status === 'success' ? 'text-green-400' :
          status === 'tool_error' ? 'text-red-400' :
          'text-text-muted'
        }`} />
        
        {/* 文件名 */}
        <span className={`text-sm font-medium flex-1 truncate ${
          isStreaming ? 'text-blue-300' : 
          status === 'success' ? 'text-green-300' :
          status === 'tool_error' ? 'text-red-300' :
          'text-text-primary'
        }`}>
          {fileName || 'Unknown file'}
        </span>
        
        {/* 状态指示器 */}
        <StatusIndicator status={status} />
        
        {/* 变更统计 */}
        {hasContent && (
          <span className="text-xs font-mono text-text-muted">
            {isEdit && (
              <>
                <span className="text-green-400">+{linesAdded}</span>
                {' '}
                <span className="text-red-400">-{linesRemoved}</span>
              </>
            )}
            {isCreate && <span className="text-green-400">+{linesAdded} new</span>}
            {isDelete && <span className="text-red-400">delete</span>}
          </span>
        )}
        
        {/* 流式指示 */}
        {isStreaming && (
          <span className="text-xs text-blue-400 animate-pulse">streaming...</span>
        )}
        
        {/* 状态标签 */}
        {status === 'success' && !isStreaming && (
          <span className="text-xs text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded">Applied</span>
        )}
        {status === 'rejected' && (
          <span className="text-xs text-text-muted bg-white/5 px-1.5 py-0.5 rounded">Rejected</span>
        )}
        {status === 'tool_error' && (
          <span className="text-xs text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">Error</span>
        )}
        
        {/* 在编辑器中打开按钮 */}
        {path && !isStreaming && (
          <button
            onClick={handleOpenInEditor}
            className="p-1 hover:bg-white/10 rounded transition-colors"
            title="Open in editor"
          >
            <ExternalLink className="w-3.5 h-3.5 text-text-muted" />
          </button>
        )}
        
        {/* 审批按钮 */}
        {needsApproval && (
          <div className="flex items-center gap-1 ml-1">
            <button
              onClick={(e) => { e.stopPropagation(); onApprove?.() }}
              className="p-1.5 text-green-400 hover:bg-green-500/20 rounded-md transition-colors"
              title="Accept"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onReject?.() }}
              className="p-1.5 text-red-400 hover:bg-red-500/20 rounded-md transition-colors"
              title="Reject"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
      
      {/* 代码预览 - 始终显示（不管是否完成） */}
      {isExpanded && hasContent && !showFullDiff && (
        <div className="border-t border-border-subtle/30">
          {isEdit && oldContent ? (
            // Edit 操作：显示简化 diff
            <div className="text-xs font-mono max-h-72 overflow-auto">
              {/* 删除的行 */}
              {oldContent.split('\n').slice(0, 10).map((line, i) => (
                <div key={`old-${i}`} className="px-3 py-0.5 bg-red-500/10 text-red-300/90 flex">
                  <span className="w-8 text-red-500/50 select-none text-right pr-2">{i + 1}</span>
                  <span className="w-4 text-red-500/60 select-none">-</span>
                  <span className="flex-1 whitespace-pre overflow-hidden text-ellipsis">{line}</span>
                </div>
              ))}
              {oldContent.split('\n').length > 10 && (
                <div className="px-3 py-1 text-red-400/50 text-center text-[10px] bg-red-500/5">
                  ... {oldContent.split('\n').length - 10} more lines removed
                </div>
              )}
              {/* 添加的行 */}
              {content.split('\n').slice(0, 10).map((line, i) => (
                <div key={`new-${i}`} className="px-3 py-0.5 bg-green-500/10 text-green-300/90 flex">
                  <span className="w-8 text-green-500/50 select-none text-right pr-2">{i + 1}</span>
                  <span className="w-4 text-green-500/60 select-none">+</span>
                  <span className="flex-1 whitespace-pre overflow-hidden text-ellipsis">{line}</span>
                </div>
              ))}
              {content.split('\n').length > 10 && (
                <div className="px-3 py-1 text-green-400/50 text-center text-[10px] bg-green-500/5">
                  ... {content.split('\n').length - 10} more lines added
                </div>
              )}
              {/* 查看完整 diff 按钮 */}
              <div className="px-3 py-2 border-t border-border-subtle/30 flex justify-center">
                <button
                  onClick={toggleFullDiff}
                  className="text-xs text-accent hover:text-accent/80 transition-colors"
                >
                  View full diff
                </button>
              </div>
            </div>
          ) : (
            // Write/Create 操作：显示新内容
            <div className="text-xs font-mono max-h-72 overflow-auto bg-green-500/5">
              {content.split('\n').slice(0, 15).map((line, i) => (
                <div key={i} className="px-3 py-0.5 text-green-300/90 flex">
                  <span className="w-8 text-green-500/40 select-none text-right pr-2">{i + 1}</span>
                  <span className="w-4 text-green-500/50 select-none">+</span>
                  <span className="flex-1 whitespace-pre overflow-hidden text-ellipsis">{line}</span>
                </div>
              ))}
              {content.split('\n').length > 15 && (
                <div className="px-3 py-1 text-green-400/50 text-center text-[10px]">
                  ... {content.split('\n').length - 15} more lines
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      {/* 完整 Diff 视图 */}
      {showFullDiff && isEdit && oldContent && content && (
        <div className="border-t border-border-subtle/30">
          <DiffViewer
            originalContent={oldContent}
            modifiedContent={content}
            filePath={path}
            onAccept={() => { onApprove?.(); setShowFullDiff(false) }}
            onReject={() => { onReject?.(); setShowFullDiff(false) }}
            onClose={() => setShowFullDiff(false)}
            minimal
          />
        </div>
      )}
      
      {/* 错误信息 */}
      {error && (
        <div className="px-3 py-2 text-xs text-red-400 bg-red-500/10 border-t border-red-500/20">
          {error}
        </div>
      )}
    </div>
  )
}

// ===== 单个工具调用显示（非文件操作）=====

interface ToolCallDisplayProps {
  toolCall: AnyToolCall
  onApprove?: () => void
  onReject?: () => void
  onFileClick?: (path: string) => void
}

export function ToolCallDisplay({ toolCall, onApprove, onReject }: ToolCallDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  const name = toolCall.name
  const params = getToolCallParams(toolCall)
  const status = getToolCallStatus(toolCall)
  const result = getToolCallResult(toolCall)
  const error = !('role' in toolCall) ? (toolCall as ToolCall).error : undefined
  
  const displayName = TOOL_DISPLAY_NAMES[name] || name
  const needsApproval = status === 'tool_request' && onApprove && onReject
  const hasResult = result && !isInProgress(status)
  const isError = status === 'tool_error' || status === 'invalid_params'
  const isStreaming = status === 'pending' || status === 'running_now'

  const primaryDesc = useMemo(() => {
    if (params.path) return String(params.path).split(/[\\/]/).pop()
    if (params.command) return String(params.command).slice(0, 50)
    return null
  }, [params])

  return (
    <div className={`
      rounded-md border border-border-subtle/30 transition-all
      ${isStreaming ? 'bg-blue-500/5 border-blue-500/30' : ''}
      ${hasResult || needsApproval ? 'hover:bg-white/5' : ''}
    `}>
      <div
        className={`flex items-center gap-2 px-3 py-2 ${hasResult ? 'cursor-pointer' : ''}`}
        onClick={() => hasResult && setIsExpanded(!isExpanded)}
      >
        <StatusIndicator status={status} />
        
        <span className={`text-xs font-medium ${
          isStreaming ? 'text-blue-400' : 
          status === 'success' ? 'text-green-400' :
          'text-text-muted'
        }`}>
          {displayName}
        </span>
        
        {primaryDesc && (
          <span className="text-xs text-text-muted/70 truncate max-w-[200px] font-mono">
            {primaryDesc}
          </span>
        )}
        
        <div className="flex-1" />
        
        {isStreaming && (
          <span className="text-xs text-blue-400 animate-pulse">running...</span>
        )}
        
        {error && <span className="text-[10px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">Error</span>}
        
        {needsApproval && (
          <div className="flex items-center gap-1">
            <button onClick={(e) => { e.stopPropagation(); onApprove?.() }} className="p-1.5 text-green-400 hover:bg-green-500/20 rounded-md">
              <Check className="w-3.5 h-3.5" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onReject?.() }} className="p-1.5 text-red-400 hover:bg-red-500/20 rounded-md">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        
        {hasResult && !needsApproval && (
          isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-text-muted/50" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-text-muted/50" />
          )
        )}
      </div>

      {isExpanded && hasResult && (
        <div className="px-3 pb-2 border-t border-border-subtle/30 pt-2">
          <pre className={`text-[10px] ${isError ? 'text-red-400' : 'text-text-muted'} bg-black/20 rounded p-2 overflow-auto max-h-40 font-mono whitespace-pre-wrap`}>
            {result.slice(0, 1500)}{result.length > 1500 ? '\n...' : ''}
          </pre>
        </div>
      )}
    </div>
  )
}

// ===== 工具调用列表 =====

interface ToolCallListProps {
  toolCalls: AnyToolCall[]
  pendingToolId?: string
  onApprove?: () => void
  onReject?: () => void
  onFileClick?: (path: string) => void
  onShowDiff?: (path: string, oldContent: string, newContent: string) => void
}

export function ToolCallList({ toolCalls, pendingToolId, onApprove, onReject, onFileClick, onShowDiff }: ToolCallListProps) {
  if (toolCalls.length === 0) return null

  // 分离写入操作和其他操作
  const { writeOps, otherOps } = useMemo(() => {
    const writes: AnyToolCall[] = []
    const others: AnyToolCall[] = []
    
    for (const tc of toolCalls) {
      if (WRITE_TOOLS.includes(tc.name)) {
        writes.push(tc)
      } else {
        others.push(tc)
      }
    }
    
    return { writeOps: writes, otherOps: others }
  }, [toolCalls])

  return (
    <div className="space-y-2 mt-3">
      {/* 写入操作优先显示 */}
      {writeOps.map((tc) => {
        const id = 'id' in tc ? tc.id : Math.random().toString()
        return (
          <FileChangePreview
            key={id}
            toolCall={tc}
            isPending={id === pendingToolId}
            onApprove={id === pendingToolId ? onApprove : undefined}
            onReject={id === pendingToolId ? onReject : undefined}
            onFileClick={onFileClick}
            onShowDiff={onShowDiff}
          />
        )
      })}
      
      {/* 其他操作 */}
      {otherOps.map((tc) => {
        const id = 'id' in tc ? tc.id : Math.random().toString()
        return (
          <ToolCallDisplay
            key={id}
            toolCall={tc}
            onApprove={id === pendingToolId ? onApprove : undefined}
            onReject={id === pendingToolId ? onReject : undefined}
            onFileClick={onFileClick}
          />
        )
      })}
    </div>
  )
}

export default ToolCallDisplay
