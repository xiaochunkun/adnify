/**
 * 持久化终端面板
 * 显示和管理多个终端会话
 */

import { useState, useEffect, useRef, useCallback, memo } from 'react'
import { Terminal, X, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { terminalService } from '../agent/terminalService'
import { PersistentTerminal } from '../agent/toolTypes'
import { useStore } from '../store'
import { t } from '../i18n'

interface TerminalTabProps {
  terminal: PersistentTerminal
  isActive: boolean
  onSelect: () => void
  onClose: () => void
}

const TerminalTab = memo(function TerminalTab({
  terminal,
  isActive,
  onSelect,
  onClose,
}: TerminalTabProps) {
  return (
    <div
      className={`
        flex items-center gap-2 px-3 py-1.5 cursor-pointer border-b-2 transition-colors
        ${isActive
          ? 'border-editor-accent bg-editor-hover text-editor-text'
          : 'border-transparent text-editor-text-muted hover:text-editor-text hover:bg-editor-hover/50'
        }
      `}
      onClick={onSelect}
    >
      <Terminal className="w-3.5 h-3.5" />
      <span className="text-sm truncate max-w-24">{terminal.name}</span>
      {terminal.isRunning && (
        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
      )}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        className="p-0.5 rounded hover:bg-editor-bg transition-colors"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  )
})

interface TerminalOutputProps {
  terminal: PersistentTerminal
}

const TerminalOutput = memo(function TerminalOutput({ terminal }: TerminalOutputProps) {
  const outputRef = useRef<HTMLDivElement>(null)
  const [output, setOutput] = useState<string[]>([])
  const [autoScroll, setAutoScroll] = useState(true)

  useEffect(() => {
    // 初始加载输出
    setOutput(terminalService.getOutput(terminal.id))

    // 订阅新输出
    const unsubscribe = terminalService.subscribeOutput(terminal.id, (newOutput) => {
      setOutput(prev => {
        const newLines = newOutput.split('\n')
        const combined = [...prev, ...newLines]
        // 限制显示行数
        return combined.slice(-500)
      })
    })

    return unsubscribe
  }, [terminal.id])

  // 自动滚动到底部
  useEffect(() => {
    if (autoScroll && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [output, autoScroll])

  // 检测用户滚动
  const handleScroll = useCallback(() => {
    if (!outputRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = outputRef.current
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50
    setAutoScroll(isAtBottom)
  }, [])

  return (
    <div
      ref={outputRef}
      className="flex-1 overflow-auto bg-editor-bg p-3 font-mono text-sm"
      onScroll={handleScroll}
    >
      {output.length === 0 ? (
        <div className="text-editor-text-muted">
          Terminal ready. Run commands using run_in_terminal tool.
        </div>
      ) : (
        output.map((line, idx) => (
          <div key={idx} className="whitespace-pre-wrap text-editor-text leading-5">
            {line}
          </div>
        ))
      )}
    </div>
  )
})

export default function TerminalPanel() {
  const { language, terminalVisible, setTerminalVisible } = useStore()
  const [terminals, setTerminals] = useState<PersistentTerminal[]>([])
  const [activeTerminalId, setActiveTerminalId] = useState<string | null>(null)
  const [isCollapsed, setIsCollapsed] = useState(false)

  // 刷新终端列表
  const refreshTerminals = useCallback(() => {
    const allTerminals = terminalService.getAllTerminals()
    setTerminals(allTerminals)

    // 如果当前活动终端不存在，选择第一个
    if (activeTerminalId && !allTerminals.find(t => t.id === activeTerminalId)) {
      setActiveTerminalId(allTerminals[0]?.id || null)
    }
  }, [activeTerminalId])

  // 定期刷新
  useEffect(() => {
    refreshTerminals()
    const interval = setInterval(refreshTerminals, 2000)
    return () => clearInterval(interval)
  }, [refreshTerminals])

  // 创建新终端
  const createTerminal = useCallback(async () => {
    const name = `Terminal ${terminals.length + 1}`
    const terminal = await terminalService.openTerminal(name)
    setActiveTerminalId(terminal.id)
    refreshTerminals()
  }, [terminals.length, refreshTerminals])

  // 关闭终端
  const closeTerminal = useCallback((id: string) => {
    terminalService.closeTerminal(id)
    refreshTerminals()
  }, [refreshTerminals])

  // 清除当前终端输出
  const clearCurrentOutput = useCallback(() => {
    if (activeTerminalId) {
      terminalService.clearOutput(activeTerminalId)
      refreshTerminals()
    }
  }, [activeTerminalId, refreshTerminals])

  if (!terminalVisible) {
    return null
  }

  const activeTerminal = terminals.find(t => t.id === activeTerminalId)

  return (
    <div className="flex flex-col border-t border-editor-border bg-editor-sidebar">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-editor-border">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-editor-accent" />
          <span className="text-sm font-medium text-editor-text">
            {t('terminal', language)}
          </span>
          <span className="text-xs text-editor-text-muted">
            ({terminals.length})
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={createTerminal}
            className="p-1.5 rounded hover:bg-editor-hover transition-colors"
            title="New Terminal"
          >
            <Plus className="w-4 h-4 text-editor-text-muted" />
          </button>
          <button
            onClick={clearCurrentOutput}
            className="p-1.5 rounded hover:bg-editor-hover transition-colors"
            title="Clear Output"
            disabled={!activeTerminal}
          >
            <Trash2 className="w-4 h-4 text-editor-text-muted" />
          </button>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded hover:bg-editor-hover transition-colors"
          >
            {isCollapsed ? (
              <ChevronUp className="w-4 h-4 text-editor-text-muted" />
            ) : (
              <ChevronDown className="w-4 h-4 text-editor-text-muted" />
            )}
          </button>
          <button
            onClick={() => setTerminalVisible(false)}
            className="p-1.5 rounded hover:bg-editor-hover transition-colors"
          >
            <X className="w-4 h-4 text-editor-text-muted" />
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <>
          {/* Tabs */}
          {terminals.length > 0 && (
            <div className="flex items-center gap-1 px-2 py-1 border-b border-editor-border overflow-x-auto">
              {terminals.map(terminal => (
                <TerminalTab
                  key={terminal.id}
                  terminal={terminal}
                  isActive={terminal.id === activeTerminalId}
                  onSelect={() => setActiveTerminalId(terminal.id)}
                  onClose={() => closeTerminal(terminal.id)}
                />
              ))}
            </div>
          )}

          {/* Content */}
          <div className="h-48 flex flex-col">
            {activeTerminal ? (
              <TerminalOutput terminal={activeTerminal} />
            ) : (
              <div className="flex-1 flex items-center justify-center text-editor-text-muted">
                <div className="text-center">
                  <Terminal className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No terminals open</p>
                  <button
                    onClick={createTerminal}
                    className="mt-2 px-3 py-1.5 text-sm bg-editor-accent text-white rounded hover:bg-editor-accent/80 transition-colors"
                  >
                    Create Terminal
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
