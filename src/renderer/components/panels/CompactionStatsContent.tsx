/**
 * 压缩统计面板内容
 * 显示上下文压缩的摘要和统计信息
 */

import { Layers, RefreshCw, Hash, Zap, FileText, ArrowRight, AlertTriangle } from 'lucide-react'
import { useAgentStore, selectCompressionStats, selectContextSummary } from '@/renderer/agent'
import { Button } from '../ui'
import { useCallback, useMemo } from 'react'
import type { CompressionLevel } from '@/renderer/agent/context/types'

interface CompactionStatsContentProps {
  language?: 'zh' | 'en'
}

const LEVEL_STYLES: Record<CompressionLevel, { color: string; bg: string }> = {
  0: { color: 'text-text-muted', bg: 'bg-text-muted/10' },
  1: { color: 'text-blue-400', bg: 'bg-blue-400/10' },
  2: { color: 'text-green-400', bg: 'bg-green-400/10' },
  3: { color: 'text-orange-400', bg: 'bg-orange-400/10' },
  4: { color: 'text-red-400', bg: 'bg-red-400/10' },
}

export default function CompactionStatsContent({
  language = 'en',
}: CompactionStatsContentProps) {
  const compressionStats = useAgentStore(selectCompressionStats)
  const setCompressionStats = useAgentStore(state => state.setCompressionStats)
  const setHandoffRequired = useAgentStore(state => state.setHandoffRequired)
  const setHandoffDocument = useAgentStore(state => state.setHandoffDocument)
  const handoffDocument = useAgentStore(state => state.handoffDocument)
  const handoffRequired = useAgentStore(state => state.handoffRequired)

  const currentLevel = compressionStats?.level ?? 0
  const style = LEVEL_STYLES[currentLevel]

  const LEVEL_DESCRIPTIONS: Record<CompressionLevel, { title: string; desc: string }> = {
    0: { 
      title: language === 'zh' ? '完整上下文' : 'Full Context', 
      desc: language === 'zh' ? '保留所有历史消息' : 'All history kept' 
    },
    1: { 
      title: language === 'zh' ? '智能截断' : 'Smart Truncation', 
      desc: language === 'zh' ? '截断冗长的工具输出' : 'Truncate long tool outputs' 
    },
    2: { 
      title: language === 'zh' ? '滑动窗口' : 'Sliding Window', 
      desc: language === 'zh' ? '保留最近对话 + 摘要' : 'Recent turns + summary' 
    },
    3: { 
      title: language === 'zh' ? '深度压缩' : 'Deep Compression', 
      desc: language === 'zh' ? '仅保留核心逻辑' : 'Core logic only' 
    },
    4: { 
      title: language === 'zh' ? '会话交接' : 'Session Handoff', 
      desc: language === 'zh' ? '创建新会话以继续' : 'New session required' 
    },
  }

  const handleClear = useCallback(() => {
    setCompressionStats(null)
    setHandoffRequired(false)
    setHandoffDocument(null)
  }, [setCompressionStats, setHandoffRequired, setHandoffDocument])

  const contextSummary = useAgentStore(selectContextSummary)
  const summary = useMemo(() => contextSummary, [contextSummary])

  return (
    <div className="flex flex-col h-full bg-background/50 backdrop-blur-xl select-none">
      {/* 顶部：等级状态 */}
      <div className="p-5 border-b border-border/40">
        <div className="flex items-start justify-between">
          <div className="flex gap-4">
            {/* 动态图标 */}
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-all duration-500 ${style.bg} ${style.color}`}>
              <Layers className="w-6 h-6" />
            </div>
            
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black tracking-tight text-text-primary">
                  L{currentLevel}
                </span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${style.bg} ${style.color}`}>
                  {LEVEL_DESCRIPTIONS[currentLevel].title}
                </span>
              </div>
              <p className="text-xs text-text-muted font-medium">
                {LEVEL_DESCRIPTIONS[currentLevel].desc}
              </p>
            </div>
          </div>

          {compressionStats && compressionStats.level > 0 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClear}
              className="h-8 w-8 text-text-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
              title={language === 'zh' ? '重置上下文' : 'Reset Context'}
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* 进度条 */}
        <div className="mt-5 flex gap-1 h-1.5 w-full">
          {[0, 1, 2, 3, 4].map((level) => (
            <div
              key={level}
              className={`flex-1 rounded-full transition-all duration-500 ${
                level <= currentLevel 
                  ? level === 4 ? 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.4)]' 
                  : level === 3 ? 'bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.4)]' 
                  : level === 2 ? 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.4)]' 
                  : level === 1 ? 'bg-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.4)]' 
                  : 'bg-white/20'
                  : 'bg-white/5'
              }`}
            />
          ))}
        </div>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6">
        
        {/* 统计数据 */}
        {compressionStats ? (
          <div className="grid grid-cols-3 gap-4">
            <StatItem 
              label={language === 'zh' ? '原始 Token' : 'Original'}
              value={formatToken(compressionStats.originalTokens)}
              icon={Hash}
            />
            <StatItem 
              label={language === 'zh' ? '当前 Token' : 'Current'}
              value={formatToken(compressionStats.finalTokens)}
              icon={Zap}
              highlight
            />
            <StatItem 
              label={language === 'zh' ? '已节省' : 'Saved'}
              value={`${compressionStats.savedPercent}%`}
              icon={FileText}
              color="text-green-400"
            />
          </div>
        ) : (
          <div className="text-center py-4 text-text-muted text-xs opacity-60">
            {language === 'zh' ? '暂无统计数据' : 'No stats available'}
          </div>
        )}

        {/* 轮次详情 */}
        {compressionStats && (compressionStats.keptTurns > 0 || compressionStats.compactedTurns > 0) && (
          <div className="flex items-center gap-6 px-1">
            <TurnInfo 
              label={language === 'zh' ? '保留轮次' : 'Kept Turns'}
              value={compressionStats.keptTurns}
              color="bg-blue-400"
            />
            {compressionStats.compactedTurns > 0 && (
              <>
                <ArrowRight className="w-3 h-3 text-text-muted/30" />
                <TurnInfo 
                  label={language === 'zh' ? '压缩轮次' : 'Compacted'}
                  value={compressionStats.compactedTurns}
                  color="bg-orange-400"
                />
              </>
            )}
          </div>
        )}

        {/* Handoff 警告 */}
        {handoffDocument && handoffRequired && (
          <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20 flex gap-3 animate-pulse">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            <div>
              <h4 className="text-xs font-bold text-red-400 mb-1">
                {language === 'zh' ? '需要创建新会话' : 'New Session Required'}
              </h4>
              <p className="text-[10px] text-red-400/70">
                {language === 'zh' 
                  ? '当前上下文已达到极限。系统将自动创建新会话并迁移关键信息。' 
                  : 'Context limit reached. System will auto-create a new session and migrate key info.'}
              </p>
            </div>
          </div>
        )}

        {/* 摘要信息 */}
        {summary && (
          <div className="space-y-3">
            <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-widest px-1">
              {language === 'zh' ? '当前任务' : 'Current Task'}
            </h4>
            
            <div className="p-4 rounded-xl bg-surface/30 border border-border/40 space-y-4">
              <div>
                <div className="text-[10px] text-accent font-bold uppercase tracking-wider mb-1.5 opacity-80">
                  {language === 'zh' ? '目标' : 'Objective'}
                </div>
                <p className="text-xs text-text-secondary leading-relaxed font-medium">
                  {summary.objective}
                </p>
              </div>

              {summary.completedSteps.length > 0 && (
                <div>
                  <div className="text-[10px] text-text-muted font-bold uppercase tracking-wider mb-1.5 opacity-60">
                    {language === 'zh' ? '最近进展' : 'Recent Progress'}
                  </div>
                  <ul className="space-y-1.5">
                    {summary.completedSteps.slice(-2).map((step: string, i: number) => (
                      <li key={i} className="flex gap-2 text-xs text-text-secondary/80">
                        <span className="w-1 h-1 rounded-full bg-green-400/40 mt-1.5 shrink-0" />
                        <span className="line-clamp-1">{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer Legend */}
      <div className="p-4 border-t border-border/40 bg-background/30 backdrop-blur-md">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          {([1, 2, 3, 4] as CompressionLevel[]).map((level) => {
            const style = LEVEL_STYLES[level]
            const desc = LEVEL_DESCRIPTIONS[level].desc
            return (
              <div key={level} className="flex items-center gap-2 group">
                <span className={`text-[9px] font-bold font-mono px-1.5 py-0.5 rounded ${style.bg} ${style.color} group-hover:ring-1 ring-inset ring-current/20 transition-all`}>
                  L{level}
                </span>
                <span className="text-[10px] text-text-secondary truncate group-hover:text-text-primary transition-colors" title={desc}>
                  {desc}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// 子组件：统计项
function StatItem({ label, value, icon: Icon, highlight, color }: any) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 text-[10px] text-text-muted font-bold uppercase tracking-wider opacity-70">
        <Icon className="w-3 h-3" />
        {label}
      </div>
      <div className={`text-lg font-mono font-bold tracking-tight ${color || (highlight ? 'text-text-primary' : 'text-text-secondary')}`}>
        {value}
      </div>
    </div>
  )
}

// 子组件：轮次信息
function TurnInfo({ label, value, color }: any) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-1.5 h-1.5 rounded-full ${color}`} />
      <div className="flex flex-col">
        <span className="text-[9px] text-text-muted font-bold uppercase tracking-wider">{label}</span>
        <span className="text-xs font-mono font-bold text-text-secondary">{value}</span>
      </div>
    </div>
  )
}

function formatToken(num: number) {
  return num >= 1000 ? `${(num / 1000).toFixed(1)}k` : num
}
