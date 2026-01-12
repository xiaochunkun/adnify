/**
 * 上下文管理器
 * 
 * 多级压缩策略：
 * Level 0: Full Context - 完整保留
 * Level 1: Smart Truncation - 智能截断工具输出
 * Level 2: Sliding Window + Summary - 滑动窗口 + 摘要
 * Level 3: Deep Compression - 深度压缩
 * Level 4: Session Handoff - 生成 Handoff 文档
 */

import { logger } from '@utils/Logger'
import type { OpenAIMessage } from '../llm/MessageConverter'
import type { CompressionLevel, StructuredSummary, HandoffDocument, MessageGroup, OptimizedContext } from './types'
import { COMPRESSION_LEVELS } from './types'
import { countMessageTokens, countTotalTokens } from './TokenEstimator'
import { truncateToolResult } from './MessageTruncator'
import { scoreMessageGroup } from './ImportanceScorer'
import { generateQuickSummary, generateHandoffDocument, handoffToSystemPrompt } from './SummaryGenerator'
import { getAgentConfig } from '../utils/AgentConfig'
import { isWriteTool } from '@/shared/config/tools'

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
}

/** 配置覆盖（用于测试） */
export interface ConfigOverride {
  maxTokens?: number
  keepRecentTurns?: number
  deepCompressionTurns?: number
  maxImportantOldTurns?: number
  autoHandoff?: boolean
}

export class ContextManager {
  private summary: StructuredSummary | null = null
  private handoff: HandoffDocument | null = null
  private currentLevel: CompressionLevel = 0
  private sessionId = ''
  private lastStats: CompressionStats | null = null

  setSessionId(id: string): void {
    this.sessionId = id
  }

  getCurrentLevel(): CompressionLevel {
    return this.currentLevel
  }

  getSummary(): StructuredSummary | null {
    return this.summary
  }

  setSummary(summary: StructuredSummary | null): void {
    this.summary = summary
  }

  getHandoff(): HandoffDocument | null {
    return this.handoff
  }

  getStats(): CompressionStats | null {
    return this.lastStats
  }

  clear(): void {
    this.summary = null
    this.handoff = null
    this.currentLevel = 0
    this.lastStats = null
  }

  /**
   * 优化上下文（主入口）
   */
  optimize(messages: OpenAIMessage[], override?: ConfigOverride): OptimizedContext {
    const baseConfig = getAgentConfig()
    const config = { ...baseConfig, ...override }
    const maxTokens = override?.maxTokens ?? baseConfig.maxContextTokens
    const originalTokens = countTotalTokens(messages)

    const nonSystemMessages = messages.filter(m => m.role !== 'system')
    if (nonSystemMessages.length === 0) {
      return this.buildResult(messages, originalTokens, originalTokens, 0, 0, 0)
    }

    const level = this.determineLevel(originalTokens, maxTokens)
    this.currentLevel = level

    const ratio = (originalTokens / maxTokens * 100).toFixed(1)
    logger.agent.info(`[ContextManager] Level ${level}, tokens: ${originalTokens}/${maxTokens} (${ratio}%)`)

    let result: OptimizedContext
    switch (level) {
      case 0:
        result = this.level0(messages, originalTokens)
        break
      case 1:
        result = this.level1(messages, originalTokens)
        break
      case 2:
        result = this.level2(messages, originalTokens, config)
        break
      case 3:
        result = this.level3(messages, originalTokens, config)
        break
      case 4:
        result = this.level4(messages, originalTokens, config)
        break
      default:
        result = this.level0(messages, originalTokens)
    }

    this.lastStats = {
      level,
      levelName: COMPRESSION_LEVELS[level].description,
      originalTokens: result.stats.originalTokens,
      finalTokens: result.stats.finalTokens,
      savedPercent: result.stats.savedPercent,
      keptTurns: result.stats.keptTurns,
      compactedTurns: result.stats.compactedTurns,
      needsHandoff: result.stats.needsHandoff,
      lastOptimizedAt: Date.now(),
    }

    return result
  }

  private determineLevel(tokens: number, maxTokens: number): CompressionLevel {
    const ratio = tokens / maxTokens
    if (ratio < COMPRESSION_LEVELS[1].threshold) return 0
    if (ratio < COMPRESSION_LEVELS[2].threshold) return 1
    if (ratio < COMPRESSION_LEVELS[3].threshold) return 2
    if (ratio < COMPRESSION_LEVELS[4].threshold) return 3
    return 4
  }

  /** Level 0: 完整保留 */
  private level0(messages: OpenAIMessage[], originalTokens: number): OptimizedContext {
    return this.buildResult(messages, originalTokens, originalTokens, 0, this.countTurns(messages), 0)
  }

  /** Level 1: 智能截断工具输出 */
  private level1(messages: OpenAIMessage[], originalTokens: number): OptimizedContext {
    const truncated = this.truncateAllToolResults(messages)
    const finalTokens = countTotalTokens(truncated)
    logger.agent.info(`[ContextManager] Level 1: ${originalTokens} -> ${finalTokens} tokens`)
    return this.buildResult(truncated, originalTokens, finalTokens, 1, this.countTurns(messages), 0)
  }

  /** Level 2: 滑动窗口 + 摘要 */
  private level2(
    messages: OpenAIMessage[],
    originalTokens: number,
    config: ReturnType<typeof getAgentConfig> & ConfigOverride
  ): OptimizedContext {
    const systemMsg = messages.find(m => m.role === 'system')
    const nonSystemMessages = messages.filter(m => m.role !== 'system')
    const groups = this.groupMessages(nonSystemMessages)

    if (groups.length === 0) {
      return this.level1(messages, originalTokens)
    }

    // 计算重要性
    for (const group of groups) {
      group.importance = scoreMessageGroup(group, nonSystemMessages, groups)
    }

    const keepTurns = config.keepRecentTurns
    const recentGroups = groups.slice(-keepTurns)
    const olderGroups = groups.slice(0, -keepTurns)

    // 保留高重要性的旧轮次
    const importantOldGroups = olderGroups
      .filter(g => g.importance > 60 || g.hasWriteOps || g.hasErrors)
      .slice(-config.maxImportantOldTurns)

    const compactedGroups = olderGroups.filter(g => !importantOldGroups.includes(g))

    // 生成摘要
    if (compactedGroups.length > 0) {
      const turnRange: [number, number] = [
        compactedGroups[0].turnIndex,
        compactedGroups[compactedGroups.length - 1].turnIndex,
      ]
      const newSummary = generateQuickSummary(nonSystemMessages, compactedGroups, turnRange)
      this.summary = this.summary ? this.mergeSummaries(this.summary, newSummary) : newSummary
    }

    // 构建保留的消息
    const keptGroups = [...importantOldGroups, ...recentGroups]
    const keptIndices = this.collectIndices(keptGroups)
    const finalMessages = this.buildFinalMessages(systemMsg, nonSystemMessages, keptIndices)
    const finalTokens = countTotalTokens(finalMessages)

    logger.agent.info(
      `[ContextManager] Level 2: ${originalTokens} -> ${finalTokens} tokens, ` +
      `kept ${keptGroups.length}, compacted ${compactedGroups.length}`
    )

    return this.buildResult(finalMessages, originalTokens, finalTokens, 2, keptGroups.length, compactedGroups.length)
  }

  /** Level 3: 深度压缩 */
  private level3(
    messages: OpenAIMessage[],
    originalTokens: number,
    config: ReturnType<typeof getAgentConfig> & ConfigOverride
  ): OptimizedContext {
    const systemMsg = messages.find(m => m.role === 'system')
    const nonSystemMessages = messages.filter(m => m.role !== 'system')
    const groups = this.groupMessages(nonSystemMessages)

    if (groups.length === 0) {
      return this.level1(messages, originalTokens)
    }

    const recentGroups = groups.slice(-config.deepCompressionTurns)
    const olderGroups = groups.slice(0, -config.deepCompressionTurns)

    if (olderGroups.length > 0) {
      const turnRange: [number, number] = [0, olderGroups[olderGroups.length - 1].turnIndex]
      this.summary = generateQuickSummary(nonSystemMessages, olderGroups, turnRange)
    }

    const keptIndices = this.collectIndices(recentGroups)
    const finalMessages = this.buildFinalMessages(systemMsg, nonSystemMessages, keptIndices, true)
    const finalTokens = countTotalTokens(finalMessages)

    logger.agent.info(`[ContextManager] Level 3: ${originalTokens} -> ${finalTokens} tokens (deep compression)`)

    return this.buildResult(finalMessages, originalTokens, finalTokens, 3, recentGroups.length, olderGroups.length)
  }

  /** Level 4: Session Handoff */
  private level4(
    messages: OpenAIMessage[],
    originalTokens: number,
    config: ReturnType<typeof getAgentConfig> & ConfigOverride
  ): OptimizedContext {
    const nonSystemMessages = messages.filter(m => m.role !== 'system')
    const groups = this.groupMessages(nonSystemMessages)

    if (groups.length <= 1) {
      return this.level3(messages, originalTokens, config)
    }

    const turnRange: [number, number] = [0, groups.length - 1]
    this.summary = generateQuickSummary(nonSystemMessages, groups, turnRange)
    this.handoff = generateHandoffDocument(this.sessionId, nonSystemMessages, groups, this.summary, '')

    if (config.autoHandoff) {
      const systemMsg = messages.find(m => m.role === 'system')
      const handoffPrompt = handoffToSystemPrompt(this.handoff)
      const lastGroup = groups[groups.length - 1]
      const lastMessages: OpenAIMessage[] = []

      if (systemMsg) {
        const systemContent = typeof systemMsg.content === 'string' ? systemMsg.content : ''
        lastMessages.push({ ...systemMsg, content: `${systemContent}\n\n${handoffPrompt}` })
      }

      lastMessages.push(nonSystemMessages[lastGroup.userIndex])
      if (lastGroup.assistantIndex !== null) {
        lastMessages.push(nonSystemMessages[lastGroup.assistantIndex])
      }

      const finalTokens = countTotalTokens(lastMessages)
      logger.agent.warn(`[ContextManager] Level 4: Session handoff. ${originalTokens} -> ${finalTokens} tokens`)

      return {
        messages: lastMessages,
        summary: this.summary,
        stats: {
          originalTokens,
          finalTokens,
          savedPercent: Math.round((1 - finalTokens / originalTokens) * 100),
          compressionLevel: 4,
          keptTurns: 1,
          compactedTurns: groups.length - 1,
          needsHandoff: true,
        },
        handoff: this.handoff,
      }
    }

    return this.level3(messages, originalTokens, config)
  }

  // ===== 辅助方法 =====

  private groupMessages(messages: OpenAIMessage[]): MessageGroup[] {
    const groups: MessageGroup[] = []
    let current: MessageGroup | null = null
    let turnIndex = 0

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i]
      if (msg.role === 'system') continue

      if (msg.role === 'user') {
        if (current) groups.push(current)
        current = {
          turnIndex: turnIndex++,
          userIndex: i,
          assistantIndex: null,
          toolIndices: [],
          tokens: countMessageTokens(msg),
          importance: 0,
          hasWriteOps: false,
          hasErrors: false,
          files: [],
        }
      } else if (msg.role === 'assistant' && current) {
        current.assistantIndex = i
        current.tokens += countMessageTokens(msg)

        if (msg.tool_calls) {
          for (const tc of msg.tool_calls) {
            if (isWriteTool(tc.function.name)) {
              current.hasWriteOps = true
              try {
                const args = JSON.parse(tc.function.arguments)
                if (args.path) current.files.push(args.path)
              } catch { /* ignore */ }
            }
          }
        }
      } else if (msg.role === 'tool' && current) {
        current.toolIndices.push(i)
        current.tokens += countMessageTokens(msg)

        const content = typeof msg.content === 'string' ? msg.content : ''
        if (/^(Error:|❌)/.test(content)) {
          current.hasErrors = true
        }
      }
    }

    if (current) groups.push(current)
    return groups
  }

  private truncateAllToolResults(messages: OpenAIMessage[]): OpenAIMessage[] {
    return messages.map(msg => {
      if (msg.role === 'tool' && typeof msg.content === 'string') {
        const toolName = (msg as any).name || ''
        return { ...msg, content: truncateToolResult(msg.content, toolName) }
      }
      return msg
    })
  }

  private collectIndices(groups: MessageGroup[]): Set<number> {
    const indices = new Set<number>()
    for (const group of groups) {
      indices.add(group.userIndex)
      if (group.assistantIndex !== null) indices.add(group.assistantIndex)
      for (const idx of group.toolIndices) indices.add(idx)
    }
    return indices
  }

  private buildFinalMessages(
    systemMsg: OpenAIMessage | undefined,
    nonSystemMessages: OpenAIMessage[],
    keptIndices: Set<number>,
    deepTruncate = false
  ): OpenAIMessage[] {
    const result: OpenAIMessage[] = []

    if (systemMsg) {
      const systemContent = typeof systemMsg.content === 'string' ? systemMsg.content : ''
      const summaryText = this.summary ? this.formatSummary(this.summary, deepTruncate) : ''
      result.push({
        ...systemMsg,
        content: summaryText ? `${systemContent}\n\n${summaryText}` : systemContent,
      })
    }

    for (let i = 0; i < nonSystemMessages.length; i++) {
      if (!keptIndices.has(i)) continue

      const msg = nonSystemMessages[i]
      if (msg.role === 'tool' && typeof msg.content === 'string') {
        const toolName = (msg as any).name || ''
        result.push({ ...msg, content: truncateToolResult(msg.content, toolName) })
      } else {
        result.push(msg)
      }
    }

    return result
  }

  private formatSummary(summary: StructuredSummary, detailed: boolean): string {
    const fileChanges = summary.fileChanges
      .slice(-10)
      .map(f => `- ${f.action}: ${f.path}`)
      .join('\n')

    if (detailed) {
      return `## Context Summary (Turns ${summary.turnRange[0]}-${summary.turnRange[1]})

**Objective:** ${summary.objective}

**Completed:**
${summary.completedSteps.map(s => `✓ ${s}`).join('\n') || 'None'}

**Pending:**
${summary.pendingSteps.map(s => `○ ${s}`).join('\n') || 'None'}

**Files:**
${fileChanges || 'None'}

**User Instructions:**
${summary.userInstructions.slice(-3).map(i => `- ${i}`).join('\n') || 'None'}

---`
    }

    return `## Previous Context (Turns ${summary.turnRange[0]}-${summary.turnRange[1]})
**Objective:** ${summary.objective}
**Files:** ${fileChanges || 'None'}
---`
  }

  private mergeSummaries(existing: StructuredSummary, newSummary: StructuredSummary): StructuredSummary {
    const mergeArrays = <T>(arr1: T[], arr2: T[], limit: number): T[] => {
      const combined = [...arr1, ...arr2]
      const unique = Array.from(new Set(combined.map(item =>
        typeof item === 'string' ? item : JSON.stringify(item)
      ))).map(item => {
        try { return JSON.parse(item) } catch { return item }
      }) as T[]
      return unique.slice(-limit)
    }

    return {
      objective: newSummary.objective || existing.objective,
      completedSteps: mergeArrays(existing.completedSteps, newSummary.completedSteps, 30),
      pendingSteps: newSummary.pendingSteps.length > 0 ? newSummary.pendingSteps : existing.pendingSteps,
      decisions: mergeArrays(existing.decisions, newSummary.decisions, 15),
      fileChanges: mergeArrays(existing.fileChanges, newSummary.fileChanges, 30),
      errorsAndFixes: mergeArrays(existing.errorsAndFixes, newSummary.errorsAndFixes, 10),
      userInstructions: mergeArrays(existing.userInstructions, newSummary.userInstructions, 10),
      generatedAt: Date.now(),
      turnRange: [
        Math.min(existing.turnRange[0], newSummary.turnRange[0]),
        Math.max(existing.turnRange[1], newSummary.turnRange[1]),
      ],
    }
  }

  private countTurns(messages: OpenAIMessage[]): number {
    return messages.filter(m => m.role === 'user').length
  }

  private buildResult(
    messages: OpenAIMessage[],
    originalTokens: number,
    finalTokens: number,
    level: CompressionLevel,
    keptTurns: number,
    compactedTurns: number
  ): OptimizedContext {
    return {
      messages: [...messages],
      summary: this.summary,
      stats: {
        originalTokens,
        finalTokens,
        savedPercent: originalTokens > 0 ? Math.round((1 - finalTokens / originalTokens) * 100) : 0,
        compressionLevel: level,
        keptTurns,
        compactedTurns,
        needsHandoff: false,
      },
    }
  }
}

export const contextManager = new ContextManager()
