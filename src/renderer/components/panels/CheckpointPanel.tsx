/**
 * 检查点面板
 * 显示检查点历史，支持回滚操作
 * 
 * 数据来源：AgentStore.messageCheckpoints（消息级别的检查点）
 */

import { useState, useCallback, memo } from 'react'
import { History, RotateCcw, ChevronDown, ChevronUp, FileText, MessageSquare, X } from 'lucide-react'
import { useAgentStore } from '@/renderer/agent/store/AgentStore'
import { MessageCheckpoint } from '@/renderer/agent/types'
import { getFileName } from '@shared/utils/pathUtils'

interface CheckpointItemProps {
  checkpoint: MessageCheckpoint
  isCurrent: boolean
  onRollback: () => void
}

const CheckpointItem = memo(function CheckpointItem({
  checkpoint,
  isCurrent,
  onRollback,
}: CheckpointItemProps) {
  const [expanded, setExpanded] = useState(false)
  const fileCount = Object.keys(checkpoint.fileSnapshots).length

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  return (
    <div
      className={`
        border rounded-lg overflow-hidden transition-colors
        ${isCurrent
          ? 'border-editor-accent bg-editor-accent/10'
          : 'border-border bg-background/50 hover:bg-editor-hover/50'
        }
      `}
    >
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <MessageSquare className={`w-4 h-4 ${isCurrent ? 'text-editor-accent' : 'text-text-primary-muted'}`} />
        <div className="flex-1 min-w-0">
          <div className="text-sm text-text-primary truncate">
            {checkpoint.description}
          </div>
          <div className="text-xs text-text-primary-muted">
            {formatTime(checkpoint.timestamp)} • {fileCount} file(s)
          </div>
        </div>
        {isCurrent && (
          <span className="px-2 py-0.5 text-xs bg-editor-accent text-white rounded">
            Current
          </span>
        )}
        {!isCurrent && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onRollback()
            }}
            className="p-1.5 rounded hover:bg-editor-hover transition-colors"
            title="Rollback to this checkpoint"
          >
            <RotateCcw className="w-4 h-4 text-text-primary-muted hover:text-editor-accent" />
          </button>
        )}
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-text-primary-muted" />
        ) : (
          <ChevronDown className="w-4 h-4 text-text-primary-muted" />
        )}
      </div>

      {expanded && fileCount > 0 && (
        <div className="px-3 pb-2 border-t border-border/50">
          <div className="text-xs text-text-primary-muted mt-2 mb-1">Saved files:</div>
          <div className="space-y-1">
            {Object.keys(checkpoint.fileSnapshots).map((path) => (
              <div
                key={path}
                className="flex items-center gap-2 text-xs text-text-primary"
              >
                <FileText className="w-3 h-3 text-text-primary-muted" />
                <span className="truncate">{getFileName(path)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
})

interface CheckpointPanelProps {
  onClose?: () => void
}

export default function CheckpointPanel({ onClose }: CheckpointPanelProps) {
  // 直接从 AgentStore 获取检查点数据
  const messageCheckpoints = useAgentStore(state => state.messageCheckpoints)
  const restoreToCheckpoint = useAgentStore(state => state.restoreToCheckpoint)
  const addAssistantMessage = useAgentStore(state => state.addAssistantMessage)
  const appendToAssistant = useAgentStore(state => state.appendToAssistant)
  const finalizeAssistant = useAgentStore(state => state.finalizeAssistant)
  
  const [isRollingBack, setIsRollingBack] = useState(false)

  // 辅助函数：添加完整的助手消息
  const showMessage = useCallback((text: string) => {
    const id = addAssistantMessage()
    if (id) {
      appendToAssistant(id, text)
      finalizeAssistant(id)
    }
  }, [addAssistantMessage, appendToAssistant, finalizeAssistant])

  const handleRollback = useCallback(async (checkpoint: MessageCheckpoint) => {
    if (isRollingBack) return

    setIsRollingBack(true)
    try {
      const result = await restoreToCheckpoint(checkpoint.id)

      if (result.success) {
        showMessage(
          `✅ Rolled back to checkpoint: "${checkpoint.description}"\nRestored ${result.restoredFiles.length} file(s).`
        )
      } else {
        showMessage(
          `⚠️ Rollback completed with errors:\n${result.errors.join('\n')}`
        )
      }
    } catch (error: unknown) {
      const err = error as { message?: string }
      showMessage(
        `❌ Rollback failed: ${err.message}`
      )
    } finally {
      setIsRollingBack(false)
    }
  }, [isRollingBack, restoreToCheckpoint, showMessage])

  if (messageCheckpoints.length === 0) {
    return (
      <div className="p-4 text-center text-text-primary-muted">
        <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No checkpoints yet</p>
        <p className="text-xs mt-1">Checkpoints are created automatically when you send messages.</p>
      </div>
    )
  }

  // 最新的检查点是当前检查点
  const currentCheckpointId = messageCheckpoints[messageCheckpoints.length - 1]?.id

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-editor-accent" />
          <span className="text-sm font-medium text-text-primary">
            Checkpoints
          </span>
          <span className="text-xs text-text-primary-muted">
            ({messageCheckpoints.length})
          </span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-editor-hover transition-colors"
          >
            <X className="w-4 h-4 text-text-primary-muted" />
          </button>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto p-2 space-y-2">
        {[...messageCheckpoints].reverse().map((checkpoint) => (
          <CheckpointItem
            key={checkpoint.id}
            checkpoint={checkpoint}
            isCurrent={checkpoint.id === currentCheckpointId}
            onRollback={() => handleRollback(checkpoint)}
          />
        ))}
      </div>

      {/* Footer */}
      {isRollingBack && (
        <div className="px-3 py-2 border-t border-border bg-background/50">
          <div className="flex items-center gap-2 text-sm text-text-primary-muted">
            <div className="w-4 h-4 border-2 border-editor-accent border-t-transparent rounded-full animate-spin" />
            Rolling back...
          </div>
        </div>
      )}
    </div>
  )
}
