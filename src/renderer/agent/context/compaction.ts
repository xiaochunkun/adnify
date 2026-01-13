/**
 * 上下文压缩模块
 * 
 * 参考 OpenCode 的实现：
 * - 使用真实的 token 使用量（来自 LLM 返回）判断是否需要压缩
 * - 压缩是持久化的（修改存储的消息）
 * - L2/L3: Prune 旧工具输出 + 可选 LLM 摘要
 * - L4: 生成 Handoff 文档
 */

import { logger } from '@utils/Logger'
import type { ChatMessage, ToolResultMessage, AssistantMessage } from '../types'
import type { StructuredSummary } from './types'

// ===== 常量 =====

/** 开始 prune 的最小 token 阈值 */
export const PRUNE_MINIMUM = 20_000

/** 保护最近多少 token 的工具调用不被 prune */
export const PRUNE_PROTECT = 40_000

/** 受保护的工具（不会被 prune） */
const PROTECTED_TOOLS = ['ask_user', 'update_plan', 'create_plan']

/** 简单的 token 估算：每 4 个字符约 1 个 token */
export function estimateTokens(text: string): number {
  return Math.max(0, Math.round((text || '').length / 4))
}

// ===== 类型 =====

export interface CompactionResult {
  pruned: number
  total: number
  prunedCount: number
  /** 需要标记为已压缩的消息 ID 列表 */
  messagesToCompact: string[]
}

export type CompressionLevel = 0 | 1 | 2 | 3 | 4

export interface CompressionStats {
  level: CompressionLevel
  levelName: string
  originalTokens: number
  finalTokens: number
  savedPercent: number
  keptTurns: number
  compactedTurns: number
  needsHandoff: boolean
  lastOptimizedAt: number
  summary?: StructuredSummary
}

// ===== 核心函数 =====

/**
 * 计算压缩等级
 * 
 * @param ratio - 当前使用率 (0-1)
 */
export function getCompressionLevel(ratio: number): CompressionLevel {
  if (ratio < 0.5) return 0  // < 50%: 无压缩
  if (ratio < 0.7) return 1  // 50-70%: 轻度截断
  if (ratio < 0.85) return 2 // 70-85%: 滑动窗口 + Prune
  if (ratio < 0.95) return 3 // 85-95%: 深度压缩 + Summary
  return 4                    // > 95%: Handoff
}

/**
 * 压缩等级描述
 */
export const COMPRESSION_LEVEL_NAMES = [
  'Full Context',
  'Smart Truncation',
  'Sliding Window',
  'Deep Compression',
  'Session Handoff',
] as const

/**
 * Prune 消息列表中的旧工具输出
 * 
 * 策略：
 * 1. 从后往前遍历消息
 * 2. 保护最近 PRUNE_PROTECT token 的工具调用
 * 3. 超过保护范围的工具输出会被清除（标记为 compacted）
 * 4. 已经被压缩的消息会停止遍历
 * 
 * 注意：此函数不直接修改消息，而是返回需要压缩的消息 ID 列表，
 * 调用方应通过 store action 更新消息状态。
 * 
 * @param messages - 消息列表（只读）
 * @returns 压缩结果，包含需要压缩的消息 ID 列表
 */
export function pruneMessages(messages: readonly ChatMessage[]): CompactionResult {
  let total = 0
  let pruned = 0
  const messagesToCompact: string[] = []
  let turns = 0

  // 从后往前遍历
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    
    // 计算轮次
    if (msg.role === 'user') turns++
    
    // 跳过最近 2 轮
    if (turns < 2) continue
    
    // 遇到已压缩的 assistant 消息，停止
    if (msg.role === 'assistant' && (msg as any).compactedAt) break
    
    // 处理工具结果消息
    if (msg.role === 'tool') {
      const toolMsg = msg as ToolResultMessage
      
      // 跳过受保护的工具
      if (PROTECTED_TOOLS.includes(toolMsg.name || '')) continue
      
      // 跳过已压缩的
      if (toolMsg.compactedAt) break
      
      // 估算 token
      const content = typeof toolMsg.content === 'string' ? toolMsg.content : ''
      const estimate = estimateTokens(content)
      total += estimate
      
      // 超过保护范围的加入待压缩列表
      if (total > PRUNE_PROTECT) {
        pruned += estimate
        messagesToCompact.push(msg.id)
      }
    }
  }

  logger.agent.info(`[Compaction] Found ${messagesToCompact.length} tool results to prune, ${pruned}/${total} tokens`)

  return { 
    pruned: pruned > PRUNE_MINIMUM ? pruned : 0, 
    total, 
    prunedCount: pruned > PRUNE_MINIMUM ? messagesToCompact.length : 0,
    messagesToCompact: pruned > PRUNE_MINIMUM ? messagesToCompact : [],
  }
}

/**
 * 获取消息内容（考虑压缩状态）
 */
export function getMessageContent(msg: ToolResultMessage): string {
  if (msg.compactedAt) {
    return '[Old tool result content cleared]'
  }
  return typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
}

/**
 * 生成 assistant 消息压缩后的属性
 * 注意：返回需要更新的属性，调用方应通过 store action 触发更新
 */
export function markAssistantCompacted(
  _msg: AssistantMessage,
  summary: string
): { summary: string; compactedAt: number } {
  return {
    summary,
    compactedAt: Date.now(),
  }
}

/**
 * 计算消息列表的总 token 数（估算）
 */
export function estimateTotalTokens(messages: ChatMessage[]): number {
  let total = 0
  
  for (const msg of messages) {
    if (msg.role === 'user') {
      const content = typeof (msg as any).content === 'string' 
        ? (msg as any).content 
        : JSON.stringify((msg as any).content)
      total += estimateTokens(content)
    } else if (msg.role === 'assistant') {
      const assistantMsg = msg as AssistantMessage
      total += estimateTokens(assistantMsg.content || '')
      
      // 工具调用也计入
      for (const tc of assistantMsg.toolCalls || []) {
        total += estimateTokens(JSON.stringify(tc.arguments))
        total += estimateTokens(tc.result || '')
      }
    } else if (msg.role === 'tool') {
      const toolMsg = msg as ToolResultMessage
      if (!toolMsg.compactedAt) {
        total += estimateTokens(typeof toolMsg.content === 'string' ? toolMsg.content : '')
      } else {
        total += 10 // 压缩后的占位符
      }
    }
  }
  
  return total
}

logger.agent.info('[Compaction] Module loaded')
