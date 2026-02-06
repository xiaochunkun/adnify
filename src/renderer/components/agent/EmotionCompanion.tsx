/**
 * 情绪伙伴（Companion）v3
 *
 * 变化：
 *  - 直接订阅 emotion:changed，捕获 LLM 推理和上下文建议
 *  - insight 消息展示 AI 推理过程 + 建议 + 可操作按钮
 *  - 每条消息底部有 👍/👎 反馈按钮（存储到 emotionFeedback）
 *  - LLM 推荐的 action 直接变成可点击按钮
 */

import React, { useEffect, useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ThumbsUp, ThumbsDown, Coffee, Sparkles, AlertTriangle, Brain } from 'lucide-react'
import { EventBus } from '@/renderer/agent/core/EventBus'
import { emotionFeedback } from '@/renderer/agent/services/emotionFeedback'
import { getRecommendedActions, getActionByType } from '@/renderer/agent/services/emotionActions'
import { emotionLLMAnalyzer } from '@/renderer/agent/services/emotionLLMAnalyzer'
import type { EmotionState, EmotionDetection } from '@/renderer/agent/types/emotion'
import type { EmotionActionDef } from '@/renderer/agent/services/emotionActions'

interface CompanionMessage {
  id: string
  text: string
  subText?: string
  type: 'encouragement' | 'suggestion' | 'warning' | 'break' | 'insight'
  state: EmotionState
  priority: number
  dismissable: boolean
  actions?: Array<{
    label: string
    emoji?: string
    icon?: React.ReactNode
    onClick: () => void
  }>
  /** 是否显示反馈按钮 */
  showFeedback?: boolean
}

// 冷却时间
const COOLDOWN: Record<CompanionMessage['type'], number> = {
  encouragement: 10 * 60 * 1000,
  suggestion: 5 * 60 * 1000,
  warning: 2 * 60 * 1000,
  break: 20 * 60 * 1000,
  insight: 2 * 60 * 1000,
}

// 自动消失时间
const AUTO_DISMISS: Record<CompanionMessage['type'], number> = {
  encouragement: 6000,
  suggestion: 10000,
  warning: 15000,
  break: 20000,
  insight: 14000,
}

const TYPE_STYLES: Record<CompanionMessage['type'], {
  borderColor: string
  iconColor: string
  bgAccent: string
  icon: React.ReactNode
}> = {
  encouragement: {
    borderColor: 'border-green-500/20',
    iconColor: 'text-green-400',
    bgAccent: 'bg-green-500/5',
    icon: <Sparkles className="w-4 h-4" />,
  },
  suggestion: {
    borderColor: 'border-blue-500/20',
    iconColor: 'text-blue-400',
    bgAccent: 'bg-blue-500/5',
    icon: <Sparkles className="w-4 h-4" />,
  },
  warning: {
    borderColor: 'border-orange-500/20',
    iconColor: 'text-orange-400',
    bgAccent: 'bg-orange-500/5',
    icon: <AlertTriangle className="w-4 h-4" />,
  },
  break: {
    borderColor: 'border-purple-500/20',
    iconColor: 'text-purple-400',
    bgAccent: 'bg-purple-500/5',
    icon: <Coffee className="w-4 h-4" />,
  },
  insight: {
    borderColor: 'border-indigo-500/30',
    iconColor: 'text-indigo-400',
    bgAccent: 'bg-indigo-500/5',
    icon: <Brain className="w-4 h-4" />,
  },
}

export const EmotionCompanion: React.FC = () => {
  const [activeMessage, setActiveMessage] = useState<CompanionMessage | null>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [feedbackGiven, setFeedbackGiven] = useState(false)
  const lastMessageTimeRef = useRef<Record<string, number>>({})
  const dismissTimerRef = useRef<NodeJS.Timeout | null>(null)
  const shownMessagesRef = useRef<Set<string>>(new Set())
  const prevEmotionStateRef = useRef<EmotionState>('neutral')

  const dismiss = useCallback(() => {
    setIsVisible(false)
    setTimeout(() => {
      setActiveMessage(null)
      setFeedbackGiven(false)
    }, 300)
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current)
      dismissTimerRef.current = null
    }
  }, [])

  const showMessage = useCallback((msg: CompanionMessage) => {
    const lastTime = lastMessageTimeRef.current[msg.type] || 0
    const cooldown = COOLDOWN[msg.type]
    if (Date.now() - lastTime < cooldown) return

    const msgKey = msg.type === 'insight'
      ? `${msg.state}:insight:${msg.text.slice(0, 30)}`
      : `${msg.state}:${msg.text}`
    if (shownMessagesRef.current.has(msgKey)) return

    if (activeMessage) {
      if (msg.type === 'insight' && activeMessage.type !== 'insight') {
        // insight can interrupt non-insight
      } else if (activeMessage.priority > msg.priority) {
        return
      }
    }

    setActiveMessage(msg)
    setIsVisible(true)
    setFeedbackGiven(false)
    lastMessageTimeRef.current[msg.type] = Date.now()
    shownMessagesRef.current.add(msgKey)

    if (shownMessagesRef.current.size > 50) {
      const entries = Array.from(shownMessagesRef.current)
      shownMessagesRef.current = new Set(entries.slice(-25))
    }

    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current)
    dismissTimerRef.current = setTimeout(dismiss, AUTO_DISMISS[msg.type])
  }, [activeMessage, dismiss])

  /**
   * 把 EmotionActionDef 转换成 CompanionMessage action
   */
  const buildActionButtons = useCallback((
    emotionActions: EmotionActionDef[],
    onDismiss: () => void,
  ): CompanionMessage['actions'] => {
    return emotionActions.map(a => ({
      label: a.label,
      emoji: a.emoji,
      onClick: () => {
        a.execute()
        onDismiss()
      },
    }))
  }, [])

  useEffect(() => {
    // ===== 1. 订阅 emotion:changed — LLM 洞察 + 可操作建议 =====
    const unsubChanged = EventBus.on('emotion:changed', (event) => {
      const detection: EmotionDetection = event.emotion
      if (!detection || detection.state === 'flow') return

      const prevState = prevEmotionStateRef.current
      prevEmotionStateRef.current = detection.state

      // 获取可操作按钮
      let emotionActions: EmotionActionDef[] = []

      // 优先用 LLM 推荐的 action
      const llmResult = emotionLLMAnalyzer.getLastResult()
      if (llmResult?.action && llmResult.action !== 'none') {
        const llmAction = getActionByType(llmResult.action)
        if (llmAction) emotionActions = [llmAction]
      }

      // LLM 没推荐 action → 用规则推荐
      if (emotionActions.length === 0) {
        emotionActions = getRecommendedActions(detection)
      }

      // 有 LLM 推理 → insight 消息
      if (detection.llmReasoning && detection.suggestions && detection.suggestions.length > 0) {
        showMessage({
          id: `insight-${Date.now()}`,
          text: detection.suggestions[0],
          subText: detection.llmReasoning,
          type: 'insight',
          state: detection.state,
          priority: 8,
          dismissable: true,
          showFeedback: true,
          actions: buildActionButtons(emotionActions, dismiss),
        })
        return
      }

      // 有上下文建议 + 状态变化 → suggestion 消息
      if (detection.suggestions && detection.suggestions.length > 0 && prevState !== detection.state) {
        showMessage({
          id: `ctx-${Date.now()}`,
          text: detection.suggestions[0],
          type: detection.state === 'frustrated' || detection.state === 'stressed' ? 'warning' : 'suggestion',
          state: detection.state,
          priority: 5,
          dismissable: true,
          showFeedback: true,
          actions: buildActionButtons(emotionActions, dismiss),
        })
      }
    })

    // ===== 2. emotion:message =====
    const unsubMessage = EventBus.on('emotion:message', (event) => {
      if (event.state === 'flow') return
      showMessage({
        id: `emotion-${Date.now()}`,
        text: event.message,
        type: event.state === 'frustrated' || event.state === 'stressed' ? 'suggestion' : 'encouragement',
        state: event.state,
        priority: event.state === 'frustrated' ? 6 : 3,
        dismissable: true,
        showFeedback: true,
      })
    })

    // ===== 3. 休息提醒 =====
    const unsubBreakMicro = EventBus.on('break:micro', (event) => {
      showMessage({
        id: `break-micro-${Date.now()}`,
        text: event.message,
        type: 'break',
        state: 'tired',
        priority: 4,
        dismissable: true,
        actions: [{
          label: '好的',
          icon: <ThumbsUp className="w-3 h-3" />,
          onClick: dismiss,
        }],
      })
    })

    const unsubBreakSuggested = EventBus.on('break:suggested', (event) => {
      showMessage({
        id: `break-${Date.now()}`,
        text: event.message,
        type: 'break',
        state: 'tired',
        priority: 7,
        dismissable: true,
        actions: [
          { label: '休息一下', icon: <Coffee className="w-3 h-3" />, onClick: dismiss },
          { label: '稍后', icon: <ThumbsDown className="w-3 h-3" />, onClick: dismiss },
        ],
      })
    })

    return () => {
      unsubChanged()
      unsubMessage()
      unsubBreakMicro()
      unsubBreakSuggested()
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current)
    }
  }, [showMessage, dismiss, buildActionButtons])

  // ===== 反馈处理 =====
  const handleFeedback = useCallback((accurate: boolean) => {
    if (!activeMessage || feedbackGiven) return
    emotionFeedback.recordFeedback(
      activeMessage.state,
      accurate ? 'accurate' : 'inaccurate',
    )
    setFeedbackGiven(true)
    // 给 2 秒看反馈确认，然后消失
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current)
    dismissTimerRef.current = setTimeout(dismiss, 2000)
  }, [activeMessage, feedbackGiven, dismiss])

  const style = activeMessage ? TYPE_STYLES[activeMessage.type] : TYPE_STYLES.encouragement

  return (
    <AnimatePresence>
      {isVisible && activeMessage && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="fixed bottom-14 right-6 z-[200] max-w-[360px]"
        >
          <div className={`
            bg-background-secondary/95 backdrop-blur-xl
            border ${style.borderColor}
            rounded-2xl shadow-2xl
            overflow-hidden
          `}>
            <div className="p-4">
              <div className="flex items-start gap-3">
                {/* 图标 */}
                <div className={`mt-0.5 ${style.iconColor} flex-shrink-0`}>
                  {style.icon}
                </div>

                {/* 文字内容 */}
                <div className="flex-1 min-w-0">
                  {/* LLM 推理 */}
                  {activeMessage.subText && (
                    <div className={`mb-2.5 px-2.5 py-2 rounded-lg ${style.bgAccent}`}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                        <span className="text-[10px] text-indigo-400 font-semibold tracking-wide uppercase">
                          AI 分析
                        </span>
                      </div>
                      <p className="text-xs text-text-secondary leading-relaxed">
                        {activeMessage.subText}
                      </p>
                    </div>
                  )}

                  {/* 主消息 */}
                  <p className="text-sm text-text-primary leading-relaxed">
                    {activeMessage.text}
                  </p>
                </div>

                {/* 关闭 */}
                {activeMessage.dismissable && (
                  <button
                    onClick={dismiss}
                    className="text-text-muted hover:text-text-primary transition-colors p-0.5 rounded-lg hover:bg-white/5 -mt-0.5 -mr-0.5 flex-shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* 操作按钮行 */}
              {activeMessage.actions && activeMessage.actions.length > 0 && (
                <div className="flex items-center gap-2 mt-3 pl-7">
                  {activeMessage.actions.map((action, i) => (
                    <button
                      key={i}
                      onClick={action.onClick}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                        bg-white/5 hover:bg-white/10 text-text-secondary hover:text-text-primary
                        transition-all border border-white/5 hover:border-white/10"
                    >
                      {action.emoji && <span>{action.emoji}</span>}
                      {action.icon}
                      {action.label}
                    </button>
                  ))}
                </div>
              )}

              {/* 反馈行 */}
              {activeMessage.showFeedback && (
                <div className="flex items-center gap-2 mt-3 pl-7 pt-2 border-t border-white/5">
                  {feedbackGiven ? (
                    <span className="text-[10px] text-text-muted">
                      感谢反馈，会帮助我更准确 ✓
                    </span>
                  ) : (
                    <>
                      <span className="text-[10px] text-text-muted mr-1">判断准确吗？</span>
                      <button
                        onClick={() => handleFeedback(true)}
                        className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px]
                          bg-white/5 hover:bg-green-500/10 text-text-muted hover:text-green-400
                          transition-all"
                      >
                        <ThumbsUp className="w-3 h-3" />
                        准确
                      </button>
                      <button
                        onClick={() => handleFeedback(false)}
                        className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px]
                          bg-white/5 hover:bg-red-500/10 text-text-muted hover:text-red-400
                          transition-all"
                      >
                        <ThumbsDown className="w-3 h-3" />
                        不准
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* 进度条 */}
            <motion.div
              className={`h-0.5 ${activeMessage.type === 'insight' ? 'bg-indigo-500/30' : 'bg-white/10'}`}
              initial={{ width: '100%' }}
              animate={{ width: '0%' }}
              transition={{
                duration: AUTO_DISMISS[activeMessage.type] / 1000,
                ease: 'linear',
              }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
