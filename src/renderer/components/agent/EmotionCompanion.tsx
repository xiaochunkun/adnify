/**
 * 情绪伙伴（Companion）v2
 * 在编辑器右下角浮动的智能助手气泡
 *
 * v2 变化：
 *  - 直接订阅 emotion:changed，捕获 LLM 推理和上下文建议
 *  - 新增 'insight' 消息类型，展示 AI 推理过程 + 建议
 *  - LLM 洞察有独立冷却规则（2分钟），优先级更高
 *  - 消息体支持双行：推理（sub-text）+ 建议（main-text）
 *
 * 行为规则：
 *  - 平时隐藏，只在有话要说时出现
 *  - 心流状态下完全沉默
 *  - LLM 洞察可以打断普通消息
 */

import React, { useEffect, useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ThumbsUp, ThumbsDown, Coffee, Sparkles, AlertTriangle, Brain } from 'lucide-react'
import { EventBus } from '@/renderer/agent/core/EventBus'
import type { EmotionState, EmotionDetection } from '@/renderer/agent/types/emotion'

interface CompanionMessage {
  id: string
  text: string
  subText?: string          // 推理过程 / 附加说明
  type: 'encouragement' | 'suggestion' | 'warning' | 'break' | 'insight'
  state: EmotionState
  priority: number          // 0-10，越高越重要
  dismissable: boolean
  actions?: Array<{
    label: string
    icon?: React.ReactNode
    onClick: () => void
  }>
}

// 冷却时间配置（毫秒）
const COOLDOWN: Record<CompanionMessage['type'], number> = {
  encouragement: 10 * 60 * 1000,  // 10分钟
  suggestion: 5 * 60 * 1000,      // 5分钟
  warning: 2 * 60 * 1000,         // 2分钟
  break: 20 * 60 * 1000,          // 20分钟
  insight: 2 * 60 * 1000,         // 2分钟 — LLM 洞察更频繁
}

// 自动消失时间
const AUTO_DISMISS: Record<CompanionMessage['type'], number> = {
  encouragement: 6000,
  suggestion: 10000,
  warning: 15000,
  break: 20000,
  insight: 12000,     // LLM 洞察多给点阅读时间
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
  const lastMessageTimeRef = useRef<Record<string, number>>({})
  const dismissTimerRef = useRef<NodeJS.Timeout | null>(null)
  const shownMessagesRef = useRef<Set<string>>(new Set())
  const prevEmotionStateRef = useRef<EmotionState>('neutral')

  const dismiss = useCallback(() => {
    setIsVisible(false)
    setTimeout(() => setActiveMessage(null), 300)
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current)
      dismissTimerRef.current = null
    }
  }, [])

  const showMessage = useCallback((msg: CompanionMessage) => {
    // 检查冷却时间
    const lastTime = lastMessageTimeRef.current[msg.type] || 0
    const cooldown = COOLDOWN[msg.type]
    if (Date.now() - lastTime < cooldown) return

    // insight 类型用 state+type 做唯一键（允许不同推理出现）
    const msgKey = msg.type === 'insight'
      ? `${msg.state}:insight:${msg.text.slice(0, 30)}`
      : `${msg.state}:${msg.text}`
    if (shownMessagesRef.current.has(msgKey)) return

    // insight 可以打断普通消息；同级别比较优先级
    if (activeMessage) {
      if (msg.type === 'insight' && activeMessage.type !== 'insight') {
        // insight 打断非 insight
      } else if (activeMessage.priority > msg.priority) {
        return // 当前消息优先级更高，不替换
      }
    }

    // 显示消息
    setActiveMessage(msg)
    setIsVisible(true)
    lastMessageTimeRef.current[msg.type] = Date.now()
    shownMessagesRef.current.add(msgKey)

    // 限制记录大小
    if (shownMessagesRef.current.size > 50) {
      const entries = Array.from(shownMessagesRef.current)
      shownMessagesRef.current = new Set(entries.slice(-25))
    }

    // 设置自动消失
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current)
    dismissTimerRef.current = setTimeout(dismiss, AUTO_DISMISS[msg.type])
  }, [activeMessage, dismiss])

  useEffect(() => {
    // ===== 1. 直接订阅 emotion:changed — 捕获 LLM 洞察 =====
    const unsubChanged = EventBus.on('emotion:changed', (event) => {
      const detection: EmotionDetection = event.emotion
      if (!detection) return

      // 心流状态不打扰
      if (detection.state === 'flow') return

      const prevState = prevEmotionStateRef.current
      prevEmotionStateRef.current = detection.state

      // 有 LLM 推理 → 显示 insight 消息
      if (detection.llmReasoning && detection.suggestions && detection.suggestions.length > 0) {
        showMessage({
          id: `insight-${Date.now()}`,
          text: detection.suggestions[0],
          subText: detection.llmReasoning,
          type: 'insight',
          state: detection.state,
          priority: 8,  // 高优先级
          dismissable: true,
        })
        return // LLM insight 已经包含了建议，不再发普通消息
      }

      // 有上下文建议但没有 LLM 推理 → 走 suggestion 通道
      if (detection.suggestions && detection.suggestions.length > 0 && prevState !== detection.state) {
        showMessage({
          id: `ctx-suggestion-${Date.now()}`,
          text: detection.suggestions[0],
          type: detection.state === 'frustrated' || detection.state === 'stressed' ? 'warning' : 'suggestion',
          state: detection.state,
          priority: 5,
          dismissable: true,
        })
      }
    })

    // ===== 2. 订阅 emotion:message — 通用情绪消息（来自 adapter） =====
    const unsubMessage = EventBus.on('emotion:message', (event) => {
      if (event.state === 'flow') return

      showMessage({
        id: `emotion-${Date.now()}`,
        text: event.message,
        type: event.state === 'frustrated' || event.state === 'stressed' ? 'suggestion' : 'encouragement',
        state: event.state,
        priority: event.state === 'frustrated' ? 6 : 3,
        dismissable: true,
      })
    })

    // ===== 3. 订阅休息提醒 =====
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
          {
            label: '休息一下',
            icon: <Coffee className="w-3 h-3" />,
            onClick: dismiss,
          },
          {
            label: '稍后',
            icon: <ThumbsDown className="w-3 h-3" />,
            onClick: dismiss,
          },
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
  }, [showMessage, dismiss])

  const style = activeMessage ? TYPE_STYLES[activeMessage.type] : TYPE_STYLES.encouragement

  return (
    <AnimatePresence>
      {isVisible && activeMessage && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="fixed bottom-14 right-6 z-[200] max-w-[340px]"
        >
          <div className={`
            bg-background-secondary/95 backdrop-blur-xl
            border ${style.borderColor}
            rounded-2xl shadow-2xl
            overflow-hidden
          `}>
            {/* 内容 */}
            <div className="p-4">
              <div className="flex items-start gap-3">
                {/* 图标 */}
                <div className={`mt-0.5 ${style.iconColor} flex-shrink-0`}>
                  {style.icon}
                </div>

                {/* 文字内容 */}
                <div className="flex-1 min-w-0">
                  {/* LLM 推理（sub-text，如果有） */}
                  {activeMessage.subText && (
                    <div className={`mb-2 px-2.5 py-2 rounded-lg ${style.bgAccent}`}>
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

                {/* 关闭按钮 */}
                {activeMessage.dismissable && (
                  <button
                    onClick={dismiss}
                    className="text-text-muted hover:text-text-primary transition-colors p-0.5 rounded-lg hover:bg-white/5 -mt-0.5 -mr-0.5 flex-shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* 操作按钮 */}
              {activeMessage.actions && activeMessage.actions.length > 0 && (
                <div className="flex items-center gap-2 mt-3 pl-7">
                  {activeMessage.actions.map((action, i) => (
                    <button
                      key={i}
                      onClick={action.onClick}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                        bg-white/5 hover:bg-white/10 text-text-secondary hover:text-text-primary
                        transition-all"
                    >
                      {action.icon}
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 底部进度条（自动消失倒计时） */}
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
