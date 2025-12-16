/**
 * ToolCallCard - 工具调用卡片组件
 * 参考 Cursor 设计，提供紧凑、流畅的工具调用展示
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.6, 3.2, 4.1
 */

import { useState, useCallback, memo } from 'react'
import {
  FileText, FileEdit, Terminal, Search, FolderOpen,
  FolderTree, Trash2, AlertTriangle, Check, X,
  ChevronRight, Loader2, ExternalLink, Eye, EyeOff
} from 'lucide-react'
import { ToolCall } from '../store'
import ToolResultViewer from './ToolResultViewer'

// 解析 Search/Replace 块 (简易版)
function parseBlocks(text: string) {
    const blocks: { search: string; replace: string }[] = []
    const regex = /<<<SEARCH\n([\s\S]*?)\n===(?:[ \t]*\n)?([\s\S]*?)\n>>>/g
    let match
    while ((match = regex.exec(text)) !== null) {
        blocks.push({ search: match[1], replace: match[2] })
    }
    return blocks
}

function EditBlockDiff({ search, replace }: { search: string; replace: string }) {
  return (
    <div className="flex flex-col text-xs font-mono border border-border-subtle rounded bg-black/20 overflow-hidden">
      <div className="flex bg-red-900/20 border-b border-red-900/30">
         <div className="w-8 p-2 text-center text-red-500/50 select-none border-r border-red-900/30">-</div>
         <pre className="p-2 text-red-300/90 whitespace-pre-wrap overflow-x-auto flex-1">{search}</pre>
      </div>
      <div className="flex bg-green-900/20">
         <div className="w-8 p-2 text-center text-green-500/50 select-none border-r border-green-900/30">+</div>
         <pre className="p-2 text-green-300/90 whitespace-pre-wrap overflow-x-auto flex-1">{replace}</pre>
      </div>
    </div>
  )
}

// 工具显示配置
const TOOL_CONFIG: Record<string, {
  icon: typeof FileText
  label: string
  color: string
  bgColor: string
  isFileEdit?: boolean
  showResult?: boolean
}> = {
  read_file: { 
    icon: FileText, 
    label: '读取文件', 
    color: 'text-blue-400', 
    bgColor: 'bg-blue-500/10',
    showResult: true 
  },
  write_file: { 
    icon: FileEdit, 
    label: '写入文件', 
    color: 'text-green-400', 
    bgColor: 'bg-green-500/10',
    isFileEdit: true 
  },
  edit_file: { 
    icon: FileEdit, 
    label: '编辑文件', 
    color: 'text-green-400', 
    bgColor: 'bg-green-500/10',
    isFileEdit: true 
  },
  create_file_or_folder: { 
    icon: FolderOpen, 
    label: '创建', 
    color: 'text-yellow-400', 
    bgColor: 'bg-yellow-500/10',
    isFileEdit: true 
  },
  delete_file_or_folder: { 
    icon: Trash2, 
    label: '删除', 
    color: 'text-red-400',
    bgColor: 'bg-red-500/10'
  },
  search_files: { 
    icon: Search, 
    label: '搜索文件', 
    color: 'text-purple-400', 
    bgColor: 'bg-purple-500/10',
    showResult: true 
  },
  search_in_file: { 
    icon: Search, 
    label: '文件内搜索', 
    color: 'text-purple-400', 
    bgColor: 'bg-purple-500/10',
    showResult: true 
  },
  list_directory: { 
    icon: FolderOpen, 
    label: '列出目录', 
    color: 'text-yellow-400', 
    bgColor: 'bg-yellow-500/10',
    showResult: true 
  },
  get_dir_tree: { 
    icon: FolderTree, 
    label: '目录树', 
    color: 'text-yellow-400', 
    bgColor: 'bg-yellow-500/10',
    showResult: true 
  },
  run_command: { 
    icon: Terminal, 
    label: '执行命令', 
    color: 'text-cyan-400', 
    bgColor: 'bg-cyan-500/10',
    showResult: true 
  },
  run_in_terminal: { 
    icon: Terminal, 
    label: '终端命令', 
    color: 'text-cyan-400', 
    bgColor: 'bg-cyan-500/10',
    showResult: true 
  },
  open_terminal: { 
    icon: Terminal, 
    label: '打开终端', 
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10'
  },
  get_terminal_output: { 
    icon: Terminal, 
    label: '终端输出', 
    color: 'text-cyan-400', 
    bgColor: 'bg-cyan-500/10',
    showResult: true 
  },
  get_lint_errors: { 
    icon: AlertTriangle, 
    label: 'Lint 检查', 
    color: 'text-orange-400', 
    bgColor: 'bg-orange-500/10',
    showResult: true 
  },
}

interface ToolCallCardProps {
  toolCall: ToolCall
  onApprove?: () => void
  onReject?: () => void
  onFileClick?: (path: string) => void
}

// 状态指示器组件 - 带脉冲动画
const StatusIndicator = memo(function StatusIndicator({ 
  status 
}: { 
  status: ToolCall['status'] 
}) {
  switch (status) {
    case 'running':
      return (
        <div className="relative">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
          <div className="absolute inset-0 animate-ping opacity-30">
            <Loader2 className="w-3.5 h-3.5 text-accent" />
          </div>
        </div>
      )
    case 'success':
      return (
        <div className="w-4 h-4 rounded-full bg-green-500/20 flex items-center justify-center">
          <Check className="w-3 h-3 text-green-400" />
        </div>
      )
    case 'error':
    case 'rejected':
      return (
        <div className="w-4 h-4 rounded-full bg-red-500/20 flex items-center justify-center">
          <X className="w-3 h-3 text-red-400" />
        </div>
      )
    case 'awaiting_user':
      return (
        <div className="relative">
          <div className="w-3 h-3 rounded-full bg-yellow-400" />
          <div className="absolute inset-0 w-3 h-3 rounded-full bg-yellow-400 animate-ping opacity-50" />
        </div>
      )
    default:
      return <div className="w-2.5 h-2.5 rounded-full bg-text-muted/40" />
  }
})

// 从参数中提取文件路径
function extractFilePath(args: Record<string, unknown>): string | null {
  if (typeof args.path === 'string') return args.path
  if (typeof args.file_path === 'string') return args.file_path
  if (typeof args.target_file === 'string') return args.target_file
  return null
}

// 从参数中提取命令
function extractCommand(args: Record<string, unknown>): string | null {
  if (typeof args.command === 'string') return args.command
  return null
}

// 获取文件名
function getFileName(path: string): string {
  return path.split(/[/\\]/).pop() || path
}

// 获取状态文本
function getStatusText(status: ToolCall['status']): string {
  switch (status) {
    case 'running': return '执行中...'
    case 'success': return '完成'
    case 'error': return '失败'
    case 'rejected': return '已拒绝'
    case 'awaiting_user': return '等待确认'
    default: return '等待中'
  }
}

export default memo(function ToolCallCard({
  toolCall,
  onApprove,
  onReject,
  onFileClick
}: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [showResult, setShowResult] = useState(false)
  
  const config = TOOL_CONFIG[toolCall.name] || { 
    icon: Terminal, 
    label: toolCall.name, 
    color: 'text-text-muted',
    bgColor: 'bg-surface-active'
  }
  const Icon = config.icon
  const isFileEdit = config.isFileEdit
  const isAwaiting = toolCall.status === 'awaiting_user'
  const isRunning = toolCall.status === 'running'
  const hasResult = !!(toolCall.result || toolCall.error)

  // 提取关键信息
  const filePath = extractFilePath(toolCall.arguments)
  const command = extractCommand(toolCall.arguments)
  const fileName = filePath ? getFileName(filePath) : null
  
  // 对于 edit_file，提取修改块
  const editBlocks = toolCall.name === 'edit_file' && typeof toolCall.arguments.search_replace_blocks === 'string'
      ? parseBlocks(toolCall.arguments.search_replace_blocks)
      : []

  // 处理文件点击 - 打开文件并显示 diff
  const handleFileClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (filePath && onFileClick) {
      onFileClick(filePath)
    }
  }, [filePath, onFileClick])

  // 切换展开状态（显示参数详情）
  const toggleExpand = useCallback(() => {
    setExpanded(prev => !prev)
  }, [])

  // 切换结果显示
  const toggleResult = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setShowResult(prev => !prev)
  }, [])

  // 计算边框和背景样式
  const cardStyles = isAwaiting 
    ? 'border-yellow-500/40 bg-yellow-500/5 shadow-[0_0_15px_rgba(234,179,8,0.1)] backdrop-blur-sm' 
    : isRunning
      ? 'border-accent/40 bg-accent/5 shadow-[0_0_15px_rgba(99,102,241,0.1)] backdrop-blur-sm'
      : toolCall.status === 'error' || toolCall.status === 'rejected'
        ? 'border-red-500/30 bg-red-500/5 backdrop-blur-sm'
        : 'border-border-subtle/50 bg-surface/40 hover:bg-surface/60 backdrop-blur-sm'

  return (
    <div className={`
      group rounded-xl border transition-all duration-300 overflow-hidden
      ${cardStyles}
    `}>
      {/* 主行 - 紧凑显示 */}
      <div 
        className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer select-none"
        onClick={toggleExpand}
      >
        {/* 状态指示器 */}
        <StatusIndicator status={toolCall.status} />
        
        {/* 工具图标和标签 */}
        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md ${config.bgColor}`}>
          <Icon className={`w-3.5 h-3.5 ${config.color}`} />
          <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
        </div>
        
        {/* 文件编辑：显示可点击的文件名 */}
        {isFileEdit && fileName && (
          <button
            onClick={handleFileClick}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-surface-active/80 hover:bg-accent/20 
                       text-xs font-mono text-text-primary hover:text-accent transition-all duration-200
                       border border-transparent hover:border-accent/30"
            title="点击打开文件并查看 diff"
          >
            <FileText className="w-3 h-3 opacity-60" />
            <span className="max-w-[150px] truncate">{fileName}</span>
            <ExternalLink className="w-2.5 h-2.5 opacity-40 group-hover:opacity-70" />
          </button>
        )}
        
        {/* 非文件编辑：显示文件路径 */}
        {!isFileEdit && fileName && (
          <span className="text-xs font-mono text-text-secondary truncate max-w-[180px]">
            {fileName}
          </span>
        )}
        
        {/* 命令：显示命令内容 */}
        {command && (
          <code className="text-xs font-mono text-text-secondary truncate max-w-[180px] px-1.5 py-0.5 bg-black/20 rounded">
            $ {command}
          </code>
        )}
        
        {/* 右侧区域 */}
        <div className="flex items-center gap-2 ml-auto">
          {/* 结果切换按钮 */}
          {hasResult && config.showResult && (
            <button
              onClick={toggleResult}
              className={`p-1 rounded hover:bg-surface-active transition-colors ${showResult ? 'text-accent' : 'text-text-muted'}`}
              title={showResult ? '隐藏结果' : '显示结果'}
            >
              {showResult ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          )}
          
          {/* 状态文本 */}
          <span className={`text-[10px] font-medium ${
            toolCall.status === 'success' ? 'text-green-400' :
            toolCall.status === 'error' || toolCall.status === 'rejected' ? 'text-red-400' :
            toolCall.status === 'running' ? 'text-accent' :
            toolCall.status === 'awaiting_user' ? 'text-yellow-400' :
            'text-text-muted'
          }`}>
            {getStatusText(toolCall.status)}
          </span>
          
          {/* 展开指示器 */}
          <ChevronRight className={`
            w-3.5 h-3.5 text-text-muted transition-transform duration-200
            ${expanded ? 'rotate-90' : ''}
          `} />
        </div>
      </div>

      {/* 审批按钮区域 */}
      {isAwaiting && onApprove && onReject && (
        <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-t border-yellow-500/20 bg-yellow-500/5">
          <div className="flex items-center gap-2 text-xs text-yellow-400">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span className="font-medium">需要您的确认</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); onReject() }}
              className="px-3 py-1.5 text-xs rounded-md bg-surface hover:bg-red-500/20 
                         text-text-muted hover:text-red-400 transition-all duration-200
                         border border-transparent hover:border-red-500/30"
            >
              拒绝
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onApprove() }}
              className="px-3 py-1.5 text-xs rounded-md bg-accent text-white 
                         hover:bg-accent-hover transition-all duration-200 font-medium
                         shadow-sm hover:shadow-glow"
            >
              允许执行
            </button>
          </div>
        </div>
      )}

      {/* 展开内容 - 参数详情 */}
      {expanded && (
        <div className="px-3 py-2.5 border-t border-border-subtle/30 bg-black/20 animate-slide-in">
          {editBlocks.length > 0 && (
              <div className="mb-4">
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5 flex items-center gap-2">
                      <FileEdit className="w-3 h-3" />
                      Proposed Changes ({editBlocks.length})
                  </div>
                  <div className="space-y-2">
                      {editBlocks.map((block, i) => (
                          <EditBlockDiff key={i} search={block.search} replace={block.replace} />
                      ))}
                  </div>
              </div>
          )}
          
          <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5">参数 JSON</div>
          <pre className="text-xs text-text-secondary font-mono whitespace-pre-wrap max-h-32 overflow-auto custom-scrollbar">
            {JSON.stringify(toolCall.arguments, null, 2)}
          </pre>
        </div>
      )}

      {/* 内联结果显示 - Requirements 1.6, 3.2 */}
      {showResult && hasResult && (
        <div className="border-t border-border-subtle/30 bg-black/10 animate-slide-in">
          <div className="px-3 py-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-text-muted uppercase tracking-wider">
                {toolCall.error ? '错误信息' : '执行结果'}
              </span>
              <button
                onClick={toggleResult}
                className="text-[10px] text-text-muted hover:text-text-primary transition-colors"
              >
                收起
              </button>
            </div>
            <ToolResultViewer 
              toolName={toolCall.name} 
              result={toolCall.result || ''} 
              error={toolCall.error}
            />
          </div>
        </div>
      )}

      {/* 错误显示（始终显示错误，不需要展开） */}
      {toolCall.error && !showResult && (
        <div className="px-3 py-2 border-t border-red-500/20 bg-red-500/5">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-300 line-clamp-2">
              {toolCall.error}
            </p>
          </div>
        </div>
      )}
    </div>
  )
})
