/**
 * Agent 状态栏组件
 * 精致的内嵌式设计 - 与输入框融为一体
 */

import { useState, useMemo } from 'react'
import {
  X,
  Check,
  ExternalLink,
  Square,
  ChevronDown,
  Loader2,
  FileCode,
  CheckCheck,
  XCircle
} from 'lucide-react'
import { PendingChange } from '@renderer/agent/types'
import { motion, AnimatePresence } from 'framer-motion'
import { getFileName } from '@shared/utils/pathUtils'

interface AgentStatusBarProps {
  pendingChanges: PendingChange[]
  isStreaming: boolean
  isAwaitingApproval: boolean
  streamingStatus?: string
  onStop?: () => void
  onReviewFile?: (filePath: string) => void
  onAcceptFile?: (filePath: string) => void
  onRejectFile?: (filePath: string) => void
  onUndoAll?: () => void
  onKeepAll?: () => void
}

export default function AgentStatusBar({
  pendingChanges,
  isStreaming,
  isAwaitingApproval,
  streamingStatus,
  onStop,
  onReviewFile,
  onAcceptFile,
  onRejectFile,
  onUndoAll,
  onKeepAll
}: AgentStatusBarProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  const hasChanges = pendingChanges.length > 0
  const showBar = isStreaming || isAwaitingApproval || hasChanges

  // 计算总行数变化
  const totalStats = useMemo(() => {
    return pendingChanges.reduce(
      (acc, change) => ({
        added: acc.added + change.linesAdded,
        removed: acc.removed + change.linesRemoved
      }),
      { added: 0, removed: 0 }
    )
  }, [pendingChanges])

  if (!showBar) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="mb-3"
    >
      {/* 主容器 - 与输入框风格统一 */}
      <div className="rounded-2xl border border-white/[0.06] bg-surface/30 backdrop-blur-xl overflow-hidden">
        {/* 文件变更区域 */}
        {hasChanges && (
          <>
            {/* Header - 极简风格 */}
            <div
              className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-white/[0.02] transition-colors"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              <div className="flex items-center gap-3">
                <motion.div
                  animate={{ rotate: isExpanded ? 0 : -90 }}
                  transition={{ duration: 0.15 }}
                  className="text-text-muted/50"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </motion.div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium text-text-muted/70">
                    {pendingChanges.length} file{pendingChanges.length > 1 ? 's' : ''} changed
                  </span>
                  <div className="flex items-center gap-1.5 text-[10px] font-mono">
                    <span className="text-green-400/80">+{totalStats.added}</span>
                    <span className="text-red-400/80">-{totalStats.removed}</span>
                  </div>
                </div>
              </div>

              {/* 操作按钮 - 精致小巧 */}
              <div
                className="flex items-center gap-1"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={onUndoAll}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-text-muted/60 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                >
                  <XCircle className="w-3 h-3" />
                  <span className="hidden sm:inline">Discard</span>
                </button>
                <button
                  onClick={onKeepAll}
                  className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium text-green-400 bg-green-500/10 hover:bg-green-500/20 rounded-lg transition-all"
                >
                  <CheckCheck className="w-3 h-3" />
                  <span>Accept</span>
                </button>
              </div>
            </div>

            {/* 文件列表 - 可折叠 */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-white/[0.04] max-h-32 overflow-y-auto custom-scrollbar">
                    {pendingChanges.map((change) => {
                      const fileName = getFileName(change.filePath)
                      return (
                        <div
                          key={change.id}
                          className="group flex items-center gap-3 px-4 py-2 hover:bg-white/[0.03] transition-colors"
                        >
                          <FileCode className="w-3.5 h-3.5 text-text-muted/40 group-hover:text-accent/60 transition-colors" />

                          <span className="flex-1 text-[11px] text-text-muted/80 group-hover:text-text-secondary truncate transition-colors">
                            {fileName}
                          </span>

                          <div className="flex items-center gap-2 text-[9px] font-mono opacity-50 group-hover:opacity-80 transition-opacity">
                            <span className="text-green-400">+{change.linesAdded}</span>
                            {change.linesRemoved > 0 && (
                              <span className="text-red-400">-{change.linesRemoved}</span>
                            )}
                          </div>

                          {/* 单文件操作 - hover 显示 */}
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                            <button
                              onClick={() => onRejectFile?.(change.filePath)}
                              className="p-1 text-text-muted/50 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                              title="Discard"
                            >
                              <X className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => onAcceptFile?.(change.filePath)}
                              className="p-1 text-text-muted/50 hover:text-green-400 hover:bg-green-500/10 rounded transition-colors"
                              title="Accept"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => onReviewFile?.(change.filePath)}
                              className="p-1 text-text-muted/50 hover:text-accent hover:bg-accent/10 rounded transition-colors"
                              title="View Diff"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        {/* 流式状态 / 等待审批 */}
        {(isStreaming || isAwaitingApproval) && (
          <div
            className={`flex items-center justify-between px-4 py-2 ${hasChanges ? 'border-t border-white/[0.04]' : ''}`}
          >
            <div className="flex items-center gap-2.5">
              {isStreaming ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 text-accent animate-spin" />
                  <span className="text-[11px] font-medium text-accent/80">
                    {streamingStatus || 'Processing...'}
                  </span>
                </>
              ) : (
                <>
                  <div className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
                  <span className="text-[11px] font-medium text-amber-400/80">
                    Waiting for approval
                  </span>
                </>
              )}
            </div>

            {isStreaming && (
              <button
                onClick={onStop}
                className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-medium text-text-muted/60 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
              >
                <Square className="w-2.5 h-2.5 fill-current" />
                Stop
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}
