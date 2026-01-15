/**
 * MessageBuilder 测试
 * 测试消息构建和压缩逻辑
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { buildLLMMessages } from '@renderer/agent/llm/MessageBuilder'
import { useAgentStore } from '@renderer/agent/store/AgentStore'

describe('MessageBuilder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset store to clean state
    useAgentStore.setState({
      threads: {},
      currentThreadId: null,
    })
  })

  describe('buildLLMMessages', () => {
    it('should build messages with empty history', async () => {
      // Create a thread first
      const store = useAgentStore.getState()
      store.createThread()

      const messages = await buildLLMMessages(
        'Hello',
        '',
        'You are a helpful assistant'
      )

      expect(messages.length).toBeGreaterThan(0)
      expect(messages[0].role).toBe('system')
      const userMessage = messages.find(m => m.role === 'user')
      expect(userMessage).toBeDefined()
      expect(userMessage?.content).toContain('Hello')
    })

    it('should handle context content', async () => {
      const store = useAgentStore.getState()
      store.createThread()

      const messages = await buildLLMMessages(
        'What is this?',
        '## File: test.ts\nconst x = 1;',
        'You are a helpful assistant'
      )

      const userMessage = messages.find(m => m.role === 'user')
      expect(userMessage).toBeDefined()
      // Context should be included in some form
      const content = typeof userMessage?.content === 'string' 
        ? userMessage.content 
        : JSON.stringify(userMessage?.content)
      expect(content).toContain('test.ts')
    })

    it('should handle array message content', async () => {
      const store = useAgentStore.getState()
      store.createThread()

      const messages = await buildLLMMessages(
        [{ type: 'text', text: 'Hello' }],
        '',
        'You are a helpful assistant'
      )

      expect(messages.length).toBeGreaterThan(0)
      const userMessage = messages.find(m => m.role === 'user')
      expect(userMessage).toBeDefined()
    })

    it('should include message history', async () => {
      const store = useAgentStore.getState()
      store.createThread()
      
      // Add some history
      store.addUserMessage('First message')
      store.addAssistantMessage('First response')

      const messages = await buildLLMMessages(
        'Second message',
        '',
        'You are a helpful assistant'
      )

      // Should have system + history + new message
      expect(messages.length).toBeGreaterThanOrEqual(3)
      expect(messages[0].role).toBe('system')
    })
  })
})
