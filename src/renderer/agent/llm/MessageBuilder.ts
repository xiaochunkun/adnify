/**
 * 消息构建服务
 * 
 * 职责：构建发送给 LLM 的消息列表
 * 使用 ContextManager 进行上下文优化
 */

import { logger } from '@utils/Logger'
import { useAgentStore } from '../store/AgentStore'
import { buildOpenAIMessages, validateOpenAIMessages, OpenAIMessage } from './MessageConverter'
import { MessageContent, ChatMessage, AssistantMessage } from '../types'

// 从 ContextBuilder 导入已有的函数
export { buildContextContent, buildUserContent, calculateContextStats } from './ContextBuilder'

/**
 * 过滤已压缩的消息（参考 OpenCode 的 filterCompacted）
 * 
 * 策略：
 * 1. 如果遇到带有 contextSummary 的 assistant 消息，表示这是压缩后的摘要
 * 2. 该消息之前的历史不会被发送给 LLM（实现滑动窗口）
 */
function filterCompactedMessages(messages: ChatMessage[]): ChatMessage[] {
  // 从后往前找第一个带有 summary 标记的 assistant 消息
  let cutoffIndex = -1
  
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg.role === 'assistant') {
      const assistantMsg = msg as AssistantMessage & { compactedAt?: number }
      // 如果这个 assistant 消息被标记为压缩过，则从这里开始保留
      if (assistantMsg.compactedAt) {
        cutoffIndex = i
        break
      }
    }
  }
  
  // 如果找到了压缩点，只返回该点之后的消息
  if (cutoffIndex >= 0) {
    logger.agent.info(`[MessageBuilder] Filtering compacted messages, keeping from index ${cutoffIndex}`)
    return messages.slice(cutoffIndex)
  }
  
  return messages
}

/**
 * 构建发送给 LLM 的消息列表
 * 注意：不在这里进行上下文优化，优化在 runAgentLoop 中进行
 */
export async function buildLLMMessages(
  currentMessage: MessageContent,
  contextContent: string,
  systemPrompt: string
): Promise<OpenAIMessage[]> {
  const store = useAgentStore.getState()
  const historyMessages = store.getMessages()
  const currentThread = store.getCurrentThread()

  const { buildUserContent } = await import('./ContextBuilder')

  // 检查是否有 handoff 上下文需要注入
  let enhancedSystemPrompt = systemPrompt
  if (currentThread && (currentThread as any).handoffContext) {
    const handoffContext = (currentThread as any).handoffContext
    enhancedSystemPrompt = `${systemPrompt}\n\n${handoffContext}`
    logger.agent.info('[MessageBuilder] Injected handoff context into system prompt')
  }

  // 过滤掉 checkpoint 消息
  type NonCheckpointMessage = Exclude<typeof historyMessages[number], { role: 'checkpoint' }>
  const filteredMessages: NonCheckpointMessage[] = historyMessages.filter(
    (m): m is NonCheckpointMessage => m.role !== 'checkpoint'
  )

  // 过滤已压缩的消息（实现滑动窗口）
  const compactedFiltered = filterCompactedMessages(filteredMessages)
  
  if (compactedFiltered.length < filteredMessages.length) {
    logger.agent.info(`[MessageBuilder] Filtered ${filteredMessages.length - compactedFiltered.length} compacted messages`)
  }

  // 排除最后一条用户消息（会在后面重新添加带上下文的版本）
  const lastMsg = compactedFiltered[compactedFiltered.length - 1]
  const messagesToConvert = lastMsg?.role === 'user' 
    ? compactedFiltered.slice(0, -1) 
    : compactedFiltered

  // 转换为 OpenAI 格式（不进行优化，优化在 runAgentLoop 中进行）
  const openaiMessages = buildOpenAIMessages(messagesToConvert as any, enhancedSystemPrompt)

  // 添加当前用户消息
  const userContent = buildUserContent(currentMessage, contextContent)
  openaiMessages.push({ role: 'user', content: userContent as any })

  // 验证消息格式
  const validation = validateOpenAIMessages(openaiMessages)
  if (!validation.valid) {
    logger.agent.warn('[MessageBuilder] Validation warning:', validation.error)
  }

  logger.agent.info(`[MessageBuilder] Built ${openaiMessages.length} messages`)

  return openaiMessages
}


