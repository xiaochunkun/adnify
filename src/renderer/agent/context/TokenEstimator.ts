/**
 * Token 估算器
 * 
 * 使用 gpt-tokenizer 进行精确的 token 计算
 */

import { encode } from 'gpt-tokenizer'
import type { OpenAIMessage } from '../llm/MessageConverter'

// 消息结构开销（role, content 等字段）
const MESSAGE_OVERHEAD = 4
// tool_call 结构开销
const TOOL_CALL_OVERHEAD = 10
// 图片 token（低分辨率）
const IMAGE_TOKENS = 85

/**
 * 计算文本的精确 token 数
 */
export function countTokens(text: string): number {
  if (!text) return 0
  return encode(text).length
}

/**
 * 计算单条消息的 token 数
 */
export function countMessageTokens(msg: OpenAIMessage): number {
  let tokens = MESSAGE_OVERHEAD

  if (typeof msg.content === 'string') {
    tokens += countTokens(msg.content)
  } else if (Array.isArray(msg.content)) {
    for (const part of msg.content) {
      if (part.type === 'text') {
        tokens += countTokens(part.text || '')
      } else {
        tokens += IMAGE_TOKENS
      }
    }
  }

  if (msg.tool_calls) {
    for (const tc of msg.tool_calls) {
      tokens += TOOL_CALL_OVERHEAD
      tokens += countTokens(tc.function.name)
      tokens += countTokens(tc.function.arguments)
    }
  }

  return tokens
}

/**
 * 计算消息列表的总 token 数
 */
export function countTotalTokens(messages: OpenAIMessage[]): number {
  return messages.reduce((sum, msg) => sum + countMessageTokens(msg), 0)
}

// 兼容旧 API（逐步迁移后删除）
export const estimateTokens = countTokens
export const estimateMessageTokens = countMessageTokens
export const estimateTotalTokens = countTotalTokens
