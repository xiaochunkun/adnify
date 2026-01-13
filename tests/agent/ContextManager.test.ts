/**
 * 上下文压缩系统测试
 * 
 * 测试新架构的压缩功能：
 * - Token 估算
 * - 压缩级别判断
 * - 消息 Prune
 * - 摘要生成
 */

import { describe, it, expect } from 'vitest'
import {
  estimateTokens,
  estimateTotalTokens,
  getCompressionLevel,
  pruneMessages,
  getMessageContent,
  COMPRESSION_LEVEL_NAMES,
  PRUNE_MINIMUM,
  PRUNE_PROTECT,
} from '../../src/renderer/agent/context/compaction'
import type { ChatMessage, UserMessage, AssistantMessage, ToolResultMessage } from '../../src/renderer/agent/types'

// ===== 辅助函数 =====

function createUserMessage(content: string, id = `user-${Date.now()}`): UserMessage {
  return {
    id,
    role: 'user',
    content,
    timestamp: Date.now(),
  }
}

function createAssistantMessage(content: string, id = `assistant-${Date.now()}`): AssistantMessage {
  return {
    id,
    role: 'assistant',
    content,
    timestamp: Date.now(),
    parts: [{ type: 'text', content }],
  }
}

function createToolResultMessage(
  content: string,
  name = 'read_file',
  id = `tool-${Date.now()}`
): ToolResultMessage {
  return {
    id,
    role: 'tool',
    toolCallId: `tc-${id}`,
    name,
    content,
    timestamp: Date.now(),
    type: 'success',
  }
}

// ===== Token 估算测试 =====

describe('Token Estimation', () => {
  it('should estimate tokens for English text', () => {
    const text = 'Hello world, this is a test.'
    const tokens = estimateTokens(text)
    expect(tokens).toBeGreaterThan(0)
    expect(tokens).toBeLessThan(text.length)
  })

  it('should estimate tokens for Chinese text', () => {
    const chinese = '你好世界，这是一个测试。'
    const tokens = estimateTokens(chinese)
    expect(tokens).toBeGreaterThan(0)
  })

  it('should handle empty string', () => {
    expect(estimateTokens('')).toBe(0)
  })

  it('should estimate total tokens for message array', () => {
    const messages: ChatMessage[] = [
      createUserMessage('Hello'),
      createAssistantMessage('Hi there!'),
    ]
    const total = estimateTotalTokens(messages)
    expect(total).toBeGreaterThan(0)
  })
})

// ===== 压缩级别测试 =====

describe('Compression Level', () => {
  it('should return level 0 for low usage', () => {
    expect(getCompressionLevel(0.3)).toBe(0)
    expect(getCompressionLevel(0.49)).toBe(0)
  })

  it('should return level 1 for 50-70% usage', () => {
    expect(getCompressionLevel(0.5)).toBe(1)
    expect(getCompressionLevel(0.69)).toBe(1)
  })

  it('should return level 2 for 70-85% usage', () => {
    expect(getCompressionLevel(0.7)).toBe(2)
    expect(getCompressionLevel(0.84)).toBe(2)
  })

  it('should return level 3 for 85-95% usage', () => {
    expect(getCompressionLevel(0.85)).toBe(3)
    expect(getCompressionLevel(0.94)).toBe(3)
  })

  it('should return level 4 for >95% usage', () => {
    expect(getCompressionLevel(0.95)).toBe(4)
    expect(getCompressionLevel(1.0)).toBe(4)
  })

  it('should have correct level names', () => {
    expect(COMPRESSION_LEVEL_NAMES[0]).toBe('Full Context')
    expect(COMPRESSION_LEVEL_NAMES[4]).toBe('Session Handoff')
  })
})

// ===== Prune 测试 =====

describe('Message Pruning', () => {
  it('should not prune when below threshold', () => {
    const messages: ChatMessage[] = [
      createUserMessage('Hello'),
      createAssistantMessage('Hi'),
      createToolResultMessage('Short result'),
    ]
    
    const result = pruneMessages(messages)
    expect(result.prunedCount).toBe(0)
    expect(result.messagesToCompact).toHaveLength(0)
  })

  it('should return message IDs to prune when above threshold', () => {
    const messages: ChatMessage[] = []
    
    // 创建多轮对话，每轮有大量工具输出
    for (let i = 0; i < 10; i++) {
      messages.push(createUserMessage(`Question ${i}`, `user-${i}`))
      messages.push(createAssistantMessage(`Answer ${i}`, `assistant-${i}`))
      messages.push(createToolResultMessage('x'.repeat(20000), 'read_file', `tool-${i}`))
    }
    
    const result = pruneMessages(messages)
    
    // 应该返回需要压缩的消息 ID 列表
    expect(result.total).toBeGreaterThan(0)
    expect(result.messagesToCompact).toBeInstanceOf(Array)
  })

  it('should not include protected tools in prune list', () => {
    const messages: ChatMessage[] = [
      createUserMessage('Hello'),
      createAssistantMessage('Hi'),
      createToolResultMessage('x'.repeat(50000), 'ask_user', 'tool-1'),
      createUserMessage('Another'),
      createAssistantMessage('Response'),
    ]
    
    const result = pruneMessages(messages)
    
    // ask_user 是受保护的工具，不应在 prune 列表中
    expect(result.messagesToCompact).not.toContain('tool-1')
  })

  it('should return correct prune stats', () => {
    const messages: ChatMessage[] = [
      createUserMessage('Q1'),
      createAssistantMessage('A1'),
      createToolResultMessage('x'.repeat(100), 'read_file'),
    ]
    
    const result = pruneMessages(messages)
    
    expect(result).toHaveProperty('pruned')
    expect(result).toHaveProperty('total')
    expect(result).toHaveProperty('prunedCount')
    expect(result).toHaveProperty('messagesToCompact')
  })
})

// ===== 消息内容获取测试 =====

describe('Message Content', () => {
  it('should return content for normal message', () => {
    const msg = createToolResultMessage('Test content')
    expect(getMessageContent(msg)).toBe('Test content')
  })

  it('should return placeholder for compacted message', () => {
    const msg = createToolResultMessage('Test content')
    msg.compactedAt = Date.now()
    
    expect(getMessageContent(msg)).toBe('[Old tool result content cleared]')
  })
})

// ===== 常量测试 =====

describe('Constants', () => {
  it('should have correct PRUNE_MINIMUM', () => {
    expect(PRUNE_MINIMUM).toBe(20000)
  })

  it('should have correct PRUNE_PROTECT', () => {
    expect(PRUNE_PROTECT).toBe(40000)
  })
})
