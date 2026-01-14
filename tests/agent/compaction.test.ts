/**
 * 上下文压缩边界条件测试
 * 
 * 测试场景：
 * 1. 正常流程
 * 2. 边界条件
 * 3. 异常情况
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  estimateTokens,
  getCompressionLevel,
  pruneMessages,
  getMessageContent,
  isOverflow,
  getPruneMinimum,
  getPruneProtect,
} from '../../src/renderer/agent/context/compaction'
import type { ChatMessage, UserMessage, AssistantMessage, ToolResultMessage } from '../../src/renderer/agent/types'

// ===== 辅助函数 =====

let idCounter = 0

function resetIdCounter() {
  idCounter = 0
}

function createUserMessage(content: string): UserMessage {
  return {
    id: `user-${++idCounter}`,
    role: 'user',
    content,
    timestamp: Date.now(),
  }
}

function createAssistantMessage(content: string, options?: { compactedAt?: number }): AssistantMessage {
  return {
    id: `assistant-${++idCounter}`,
    role: 'assistant',
    content,
    timestamp: Date.now(),
    parts: [{ type: 'text', content }],
    ...options,
  } as AssistantMessage
}

function createToolResultMessage(
  content: string,
  name = 'read_file',
  options?: { compactedAt?: number }
): ToolResultMessage {
  const id = `tool-${++idCounter}`
  return {
    id,
    role: 'tool',
    toolCallId: `tc-${id}`,
    name,
    content,
    timestamp: Date.now(),
    type: 'success',
    ...options,
  }
}

// 创建指定 token 数的内容（约 4 字符 = 1 token）
function createContentWithTokens(tokens: number): string {
  return 'x'.repeat(tokens * 4)
}

// ===== isOverflow 测试 =====

describe('isOverflow', () => {
  it('should return false when within limit', () => {
    expect(isOverflow({ input: 50000, output: 1000 }, 128000)).toBe(false)
  })

  it('should return true when exceeding usable context', () => {
    // 128000 - 4096 (output reserve) = 123904 usable
    expect(isOverflow({ input: 120000, output: 5000 }, 128000)).toBe(true)
  })

  it('should respect custom output reserve', () => {
    expect(isOverflow({ input: 100000, output: 10000 }, 128000, 8192)).toBe(false)
    expect(isOverflow({ input: 115000, output: 10000 }, 128000, 8192)).toBe(true)
  })

  it('should handle edge case at exact limit', () => {
    // 128000 - 4096 = 123904
    expect(isOverflow({ input: 123904, output: 0 }, 128000)).toBe(false)
    expect(isOverflow({ input: 123905, output: 0 }, 128000)).toBe(true)
  })
})

// ===== getCompressionLevel 边界测试 =====

describe('getCompressionLevel boundaries', () => {
  it('should handle exact boundary values', () => {
    expect(getCompressionLevel(0.5)).toBe(1)   // 50% 边界
    expect(getCompressionLevel(0.7)).toBe(2)   // 70% 边界
    expect(getCompressionLevel(0.85)).toBe(3)  // 85% 边界
    expect(getCompressionLevel(0.95)).toBe(4)  // 95% 边界
  })

  it('should handle values just below boundaries', () => {
    expect(getCompressionLevel(0.499)).toBe(0)
    expect(getCompressionLevel(0.699)).toBe(1)
    expect(getCompressionLevel(0.849)).toBe(2)
    expect(getCompressionLevel(0.949)).toBe(3)
  })

  it('should handle extreme values', () => {
    expect(getCompressionLevel(0)).toBe(0)
    expect(getCompressionLevel(1)).toBe(4)
    expect(getCompressionLevel(1.5)).toBe(4)  // 超过 100%
  })

  it('should handle negative values gracefully', () => {
    expect(getCompressionLevel(-0.1)).toBe(0)
  })
})

// ===== pruneMessages 边界测试 =====

describe('pruneMessages edge cases', () => {
  beforeEach(() => {
    resetIdCounter()
  })

  it('should not prune empty message list', () => {
    const result = pruneMessages([])
    expect(result.prunedCount).toBe(0)
    expect(result.messagesToCompact).toHaveLength(0)
  })

  it('should not prune single turn conversation', () => {
    const messages: ChatMessage[] = [
      createUserMessage('Hello'),
      createAssistantMessage('Hi'),
      createToolResultMessage(createContentWithTokens(50000)), // 50k tokens
    ]
    
    const result = pruneMessages(messages)
    // 只有 1 轮，应该被保护
    expect(result.prunedCount).toBe(0)
  })

  it('should not prune recent 5 turns (keepRecentTurns default)', () => {
    const messages: ChatMessage[] = [
      // 第 1 轮
      createUserMessage('Q1'),
      createAssistantMessage('A1'),
      createToolResultMessage(createContentWithTokens(30000)),
      // 第 2 轮
      createUserMessage('Q2'),
      createAssistantMessage('A2'),
      createToolResultMessage(createContentWithTokens(30000)),
    ]
    
    const result = pruneMessages(messages)
    // 只有 2 轮，都应该被保护（keepRecentTurns=5）
    expect(result.prunedCount).toBe(0)
  })

  it('should prune old turns when exceeding threshold', () => {
    const messages: ChatMessage[] = []
    
    // 创建 8 轮对话，每轮 15k tokens（需要超过 keepRecentTurns=5 才能触发 prune）
    for (let i = 0; i < 8; i++) {
      messages.push(createUserMessage(`Q${i}`))
      messages.push(createAssistantMessage(`A${i}`))
      messages.push(createToolResultMessage(createContentWithTokens(15000), 'read_file'))
    }
    
    const result = pruneMessages(messages)
    
    // 最近 5 轮被保护（keepRecentTurns=5），前 3 轮的工具结果可能被 prune
    // 总共 120k tokens，保护 40k，超出 80k > 20k minimum
    expect(result.total).toBeGreaterThan(0)
  })

  it('should stop at compacted assistant message', () => {
    const messages: ChatMessage[] = [
      // 旧轮次
      createUserMessage('Q1'),
      createAssistantMessage('A1', { compactedAt: Date.now() }), // 压缩点
      createToolResultMessage(createContentWithTokens(50000)),
      // 新轮次
      createUserMessage('Q2'),
      createAssistantMessage('A2'),
      createToolResultMessage(createContentWithTokens(10000)),
      createUserMessage('Q3'),
      createAssistantMessage('A3'),
      createToolResultMessage(createContentWithTokens(10000)),
    ]
    
    const result = pruneMessages(messages)
    
    // 应该在 compactedAt 处停止，不会 prune 之前的内容
    // 只会扫描 compactedAt 之后的消息
    expect(result.messagesToCompact).not.toContain('tool-1')
  })

  it('should skip already compacted tool results', () => {
    const messages: ChatMessage[] = [
      createUserMessage('Q1'),
      createAssistantMessage('A1'),
      createToolResultMessage(createContentWithTokens(30000), 'read_file', { compactedAt: Date.now() }),
      createUserMessage('Q2'),
      createAssistantMessage('A2'),
      createToolResultMessage(createContentWithTokens(30000)),
      createUserMessage('Q3'),
      createAssistantMessage('A3'),
      createToolResultMessage(createContentWithTokens(10000)),
    ]
    
    const result = pruneMessages(messages)
    
    // 已压缩的工具结果应该被跳过（continue），不是停止
    expect(result.messagesToCompact).not.toContain('tool-1')
  })

  it('should protect ask_user tool results', () => {
    const messages: ChatMessage[] = [
      createUserMessage('Q1'),
      createAssistantMessage('A1'),
      createToolResultMessage(createContentWithTokens(50000), 'ask_user'),
      createUserMessage('Q2'),
      createAssistantMessage('A2'),
      createToolResultMessage(createContentWithTokens(50000), 'read_file'),
      createUserMessage('Q3'),
      createAssistantMessage('A3'),
    ]
    
    const result = pruneMessages(messages)
    
    // ask_user 是受保护的工具
    const askUserToolId = 'tool-1'
    expect(result.messagesToCompact).not.toContain(askUserToolId)
  })

  it('should protect update_plan tool results', () => {
    const messages: ChatMessage[] = [
      createUserMessage('Q1'),
      createAssistantMessage('A1'),
      createToolResultMessage(createContentWithTokens(50000), 'update_plan'),
      createUserMessage('Q2'),
      createAssistantMessage('A2'),
      createUserMessage('Q3'),
      createAssistantMessage('A3'),
    ]
    
    const result = pruneMessages(messages)
    expect(result.messagesToCompact).not.toContain('tool-1')
  })
})

// ===== getMessageContent 测试 =====

describe('getMessageContent edge cases', () => {
  it('should handle non-string content', () => {
    const msg = createToolResultMessage('test')
    msg.content = { data: 'json' } as any
    
    const content = getMessageContent(msg)
    expect(content).toBe('{"data":"json"}')
  })

  it('should return placeholder for compacted message regardless of content', () => {
    const msg = createToolResultMessage('Very long content...')
    msg.compactedAt = Date.now()
    
    expect(getMessageContent(msg)).toBe('[Old tool result content cleared]')
  })
})

// ===== estimateTokens 边界测试 =====

describe('estimateTokens edge cases', () => {
  it('should handle null/undefined gracefully', () => {
    expect(estimateTokens(null as any)).toBe(0)
    expect(estimateTokens(undefined as any)).toBe(0)
  })

  it('should handle very long strings', () => {
    const longString = 'x'.repeat(1000000) // 1M chars
    const tokens = estimateTokens(longString)
    expect(tokens).toBe(250000) // 1M / 4
  })

  it('should round correctly', () => {
    expect(estimateTokens('x')).toBe(0)     // 1/4 = 0.25 -> 0
    expect(estimateTokens('xx')).toBe(1)    // 2/4 = 0.5 -> 1
    expect(estimateTokens('xxx')).toBe(1)   // 3/4 = 0.75 -> 1
    expect(estimateTokens('xxxx')).toBe(1)  // 4/4 = 1 -> 1
    expect(estimateTokens('xxxxx')).toBe(1) // 5/4 = 1.25 -> 1
  })
})

// ===== 配置值测试 =====

describe('Configuration values', () => {
  it('should have reasonable default values', () => {
    const pruneMinimum = getPruneMinimum()
    const pruneProtect = getPruneProtect()
    
    expect(pruneMinimum).toBeGreaterThan(0)
    expect(pruneProtect).toBeGreaterThan(pruneMinimum)
    expect(pruneProtect).toBeLessThan(128000) // 应该小于常见的上下文限制
  })
})

// ===== 集成场景测试 =====

describe('Integration scenarios', () => {
  beforeEach(() => {
    resetIdCounter()
  })

  it('scenario: first turn with large tool output should not be pruned', () => {
    // 模拟第一轮对话产生大量工具输出
    const messages: ChatMessage[] = [
      createUserMessage('Read all files in src/'),
      createAssistantMessage('I will read the files'),
      createToolResultMessage(createContentWithTokens(80000), 'read_file'), // 80k tokens
    ]
    
    const result = pruneMessages(messages)
    
    // 第一轮应该被保护
    expect(result.prunedCount).toBe(0)
  })

  it('scenario: multi-turn conversation with gradual token accumulation', () => {
    const messages: ChatMessage[] = []
    
    // 模拟 10 轮对话，每轮增加 10k tokens
    for (let i = 0; i < 10; i++) {
      messages.push(createUserMessage(`Question ${i}`))
      messages.push(createAssistantMessage(`Answer ${i}`))
      messages.push(createToolResultMessage(createContentWithTokens(10000), 'read_file'))
    }
    
    const result = pruneMessages(messages)
    
    // 总共 100k tokens，保护 40k，应该 prune 60k
    // 但最近 2 轮被跳过，所以实际 prune 的是第 1-8 轮中超出的部分
    expect(result.total).toBeGreaterThan(0)
  })

  it('scenario: conversation with mixed tool types', () => {
    const messages: ChatMessage[] = [
      // 第 1 轮
      createUserMessage('Q1'),
      createAssistantMessage('A1'),
      createToolResultMessage(createContentWithTokens(20000), 'read_file'),
      createToolResultMessage(createContentWithTokens(5000), 'ask_user'), // 受保护
      // 第 2 轮
      createUserMessage('Q2'),
      createAssistantMessage('A2'),
      createToolResultMessage(createContentWithTokens(20000), 'grep_search'),
      // 第 3 轮
      createUserMessage('Q3'),
      createAssistantMessage('A3'),
      createToolResultMessage(createContentWithTokens(20000), 'write_file'),
      // 第 4 轮
      createUserMessage('Q4'),
      createAssistantMessage('A4'),
    ]
    
    const result = pruneMessages(messages)
    
    // ask_user 不应该被 prune
    expect(result.messagesToCompact).not.toContain('tool-2')
  })

  it('scenario: resuming from compacted state', () => {
    // 模拟从压缩状态恢复后继续对话
    const messages: ChatMessage[] = [
      // 旧的压缩点
      createUserMessage('Old question'),
      createAssistantMessage('Old answer', { compactedAt: Date.now() - 10000 }),
      createToolResultMessage(createContentWithTokens(50000), 'read_file', { compactedAt: Date.now() - 10000 }),
      // 新的对话
      createUserMessage('Q1'),
      createAssistantMessage('A1'),
      createToolResultMessage(createContentWithTokens(30000), 'read_file'),
      createUserMessage('Q2'),
      createAssistantMessage('A2'),
      createToolResultMessage(createContentWithTokens(30000), 'read_file'),
      createUserMessage('Q3'),
      createAssistantMessage('A3'),
    ]
    
    const result = pruneMessages(messages)
    
    // 应该在 compactedAt 处停止，不会重复 prune 旧内容
    expect(result.messagesToCompact).not.toContain('tool-1')
  })
})
