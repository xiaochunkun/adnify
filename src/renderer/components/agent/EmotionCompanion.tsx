/**
 * 情绪伙伴（Companion）
 * 在编辑器右下角浮动的智能助手气泡
 *
 * 行为规则：
 * - 平时隐藏，只在有话要说时出现
 * - 出现后可以被关闭，不会立即重复
 * - 消息有优先级：紧急 > 建议 > 鼓励
 * - 同一消息不重复显示
 * - 心流状态下完全沉默
 */

import React, { useEffect, useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ThumbsUp, ThumbsDown, Coffee, Sparkles, AlertTriangle } from 'lucide-react'
import { EventBus } from '@/renderer/agent/core/EventBus'
import type { EmotionState } from '@/renderer/agent/types/emotion'

interface CompanionMessage {
  id: string
  text: string
  type: 'encouragement' | 'suggestion' | 'warning' | 'break'
  state: EmotionState
  priority: number    // 0-10，越高越重要
  dismissable: boolean
  actions?: Array<{
    label: string
    icon?: React.ReactNode
    onClick: () => void
  }>
}

// 冷却时间配置（毫秒）
const COOLDOWN = {
  encouragement: 10 * 60 * 1000,  // 10分钟
  suggestion: 5 * 60 * 1000,      // 5分钟
  warning: 2 * 60 * 1000,         // 2分钟
  break: 20 * 60 * 1000,          // 20分钟
}

// 自动消失时间
const AUTO_DISMISS = {
  encouragement: 6000,
  suggestion: 10000,
  warning: 15000,
  break: 20000,
}

const TYPE_STYLES: Record<CompanionMessage['type'], {
  borderColor: string
  iconColor: string
  icon: React.ReactNode
}> = {
  encouragement: {
    borderColor: 'border-green-500/20',
    iconColor: 'text-green-400',
    icon: <Sparkles className="w-4 h-4" />,
  },
  suggestion: {
    borderColor: 'border-blue-500/20',
    iconColor: 'text-blue-400',
    icon: <Sparkles className="w-4 h-4" />,
  },
  warning: {
    borderColor: 'border-orange-500/20',
    iconColor: 'text-orange-400',
    icon: <AlertTriangle className="w-4 h-4" />,
  },
  break: {
    borderColor: 'border-purple-500/20',
    iconColor: 'text-purple-400',
    icon: <Coffee className="w-4 h-4" />,
  },
}

export const EmotionCompanion: React.FC = () => {
  const [activeMessage, setActiveMessage] = useState<CompanionMessage | null>(null)
  const [isVisible, setIsVisible] = useState(false)
  const lastMessageTimeRef = useRef<Record<string, number>>({})
  const dismissTimerRef = useRef<NodeJS.Timeout | null>(null)
  const shownMessagesRef = useRef<Set<string>>(new Set())

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

    // 检查是否已经显示过完全相同的消息
    const msgKey = `${msg.state}:${msg.text}`
    if (shownMessagesRef.current.has(msgKey)) return

    // 如果当前有消息且优先级更高，不替换
    if (activeMessage && activeMessage.priority > msg.priority) return

    // 显示消息
    setActiveMessage(msg)
    setIsVisible(true)
    lastMessageTimeRef.current[msg.type] = Date.now()
    shownMessagesRef.current.add(msgKey)

    // 限制已显示消息记录大小
    if (shownMessagesRef.current.size > 50) {
      const entries = Array.from(shownMessagesRef.current)
      shownMessagesRef.current = new Set(entries.slice(-25))
    }

    // 设置自动消失
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current)
    dismissTimerRef.current = setTimeout(dismiss, AUTO_DISMISS[msg.type])
  }, [activeMessage, dismiss])

  useEffect(() => {
    // 订阅情绪消息
    const unsubMessage = EventBus.on('emotion:message', (event) => {
      // 心流状态不打扰
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

    // 订阅休息提醒
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
            onClick: () => {
              dismiss()
              // 可以在这里触发休息模式
            },
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
          className="fixed bottom-14 right-6 z-[200] max-w-[320px]"
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
                <div className={`mt-0.5 ${style.iconColor}`}>
                  {style.icon}
                </div>

                {/* 文字 */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary leading-relaxed">
                    {activeMessage.text}
                  </p>
                </div>

                {/* 关闭按钮 */}
                {activeMessage.dismissable && (
                  <button
                    onClick={dismiss}
                    className="text-text-muted hover:text-text-primary transition-colors p-0.5 rounded-lg hover:bg-white/5 -mt-0.5 -mr-0.5"
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
              className="h-0.5 bg-white/10"
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
