/**
 * 流式处理模块
 * 
 * 职责：
 * - 处理 LLM 流式响应
 * - 解析文本、推理、工具调用
 * - 发布事件到 EventBus
 */

import { api } from '@/renderer/services/electronAPI'
import { useAgentStore } from '../store/AgentStore'
import { parseXMLToolCalls } from '../utils/XMLToolParser'
import { EventBus } from './EventBus'
import type { ToolCall, TokenUsage } from '../types'
import type { LLMCallResult } from './types'

// ===== 流式处理器 =====

export interface StreamProcessor {
  wait: () => Promise<LLMCallResult>
  cleanup: () => void
}

export function createStreamProcessor(assistantId: string | null): StreamProcessor {
  const store = useAgentStore.getState()

  let content = ''
  let reasoning = ''
  let isInReasoning = false
  let reasoningPartId: string | null = null
  let toolCalls: ToolCall[] = []
  let usage: TokenUsage | undefined
  let error: string | undefined

  // 工具调用流式状态
  let currentToolCall: { id: string; name: string; argsString: string } | null = null

  // 清理函数列表
  const cleanups: (() => void)[] = []

  const cleanup = () => {
    for (const fn of cleanups) {
      try { fn() } catch {}
    }
    cleanups.length = 0
  }

  // 处理流式数据
  const handleStream = (data: {
    type: string
    content?: string
    reasoning?: string
    toolCall?: unknown
    toolCallDelta?: { id?: string; name?: string; args?: string }
    usage?: unknown
  }) => {
    switch (data.type) {
      case 'text':
      case 'content':
        if (data.content) {
          content += data.content
          if (assistantId) {
            store.appendToAssistant(assistantId, data.content)
          }
          EventBus.emit({ type: 'stream:text', text: data.content })

          // 检测 XML 工具调用
          const detected = parseXMLToolCalls(content)
          for (const tc of detected) {
            if (!toolCalls.find(t => t.id === tc.id)) {
              const toolCall: ToolCall = { ...tc, status: 'pending' }
              toolCalls.push(toolCall)
              if (assistantId) {
                store.addToolCallPart(assistantId, toolCall)
              }
              EventBus.emit({ type: 'stream:tool_end', id: tc.id, args: tc.arguments })
            }
          }
        }
        break

      case 'reasoning': {
        // 后端发送的是 { type: 'reasoning', content: xxx }
        const reasoningContent = data.content || data.reasoning
        if (reasoningContent) {
          if (!isInReasoning) {
            isInReasoning = true
            if (assistantId) {
              // 创建 ReasoningPart 并获取 partId
              reasoningPartId = store.addReasoningPart(assistantId)
              store.updateMessage(assistantId, { reasoningStartTime: Date.now() } as any)
            }
            EventBus.emit({ type: 'stream:reasoning', text: '', phase: 'start' })
          }
          reasoning += reasoningContent
          if (assistantId && reasoningPartId) {
            // 更新 ReasoningPart 内容
            store.updateReasoningPart(assistantId, reasoningPartId, reasoningContent, true)
            store.updateMessage(assistantId, { reasoning } as any)
          }
          EventBus.emit({ type: 'stream:reasoning', text: reasoningContent, phase: 'delta' })
        }
        break
      }

      case 'tool_call_start':
        if (data.toolCallDelta) {
          const toolId = data.toolCallDelta.id || `tool-${Date.now()}`
          const toolName = data.toolCallDelta.name || 'unknown'
          currentToolCall = { id: toolId, name: toolName, argsString: '' }
          
          if (assistantId) {
            store.addToolCallPart(assistantId, {
              id: toolId,
              name: toolName,
              arguments: { _streaming: true },
            })
          }
          EventBus.emit({ type: 'stream:tool_start', id: toolId, name: toolName })
        }
        break

      case 'tool_call_delta':
        if (data.toolCallDelta && currentToolCall) {
          if (data.toolCallDelta.args) {
            currentToolCall.argsString += data.toolCallDelta.args
          }
          if (data.toolCallDelta.name && currentToolCall.name === 'unknown') {
            currentToolCall.name = data.toolCallDelta.name
          }
          EventBus.emit({ type: 'stream:tool_delta', id: currentToolCall.id, args: currentToolCall.argsString })
        }
        break

      case 'tool_call_end':
        if (currentToolCall) {
          try {
            let argsString = currentToolCall.argsString || '{}'
            // 清理可能的多余字符
            const firstBrace = argsString.indexOf('{')
            const lastBrace = argsString.lastIndexOf('}')
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
              argsString = argsString.slice(firstBrace, lastBrace + 1)
            }
            const args = JSON.parse(argsString)
            const toolCall: ToolCall = {
              id: currentToolCall.id,
              name: currentToolCall.name,
              arguments: args,
              status: 'pending',
            }
            toolCalls.push(toolCall)
            if (assistantId) {
              store.updateToolCall(assistantId, currentToolCall.id, {
                arguments: args,
                status: 'pending',
              })
            }
            EventBus.emit({ type: 'stream:tool_end', id: currentToolCall.id, args })
          } catch {
            // 解析失败，使用原始字符串
            const toolCall: ToolCall = {
              id: currentToolCall.id,
              name: currentToolCall.name,
              arguments: { _parseError: true, _rawArgs: currentToolCall.argsString },
              status: 'pending',
            }
            toolCalls.push(toolCall)
          }
          currentToolCall = null
        }
        // 也处理 data.toolCall（完整工具调用）
        if (data.toolCall) {
          const tc = data.toolCall as ToolCall
          if (!toolCalls.find(t => t.id === tc.id)) {
            const toolCall: ToolCall = { ...tc, status: 'pending' }
            toolCalls.push(toolCall)
            if (assistantId) {
              store.addToolCallPart(assistantId, toolCall)
            }
            EventBus.emit({ type: 'stream:tool_end', id: tc.id, args: tc.arguments })
          }
        }
        break

      case 'usage':
        if (data.usage) {
          usage = data.usage as TokenUsage
        }
        break
    }
  }

  // 处理工具调用
  const handleToolCall = (tc: unknown) => {
    const toolCall = tc as ToolCall
    if (!toolCalls.find(t => t.id === toolCall.id)) {
      toolCalls.push(toolCall)
      if (assistantId) {
        store.addToolCallPart(assistantId, toolCall)
      }
      EventBus.emit({ type: 'stream:tool_end', id: toolCall.id, args: toolCall.arguments })
    }
  }

  // 订阅 IPC 事件
  const unsubStream = api.llm.onStream(handleStream)
  const unsubToolCall = api.llm.onToolCall(handleToolCall)
  const unsubError = api.llm.onError((err: string) => { error = err })

  cleanups.push(unsubStream, unsubToolCall, unsubError)

  // 等待完成
  const wait = (): Promise<LLMCallResult> => {
    return new Promise((resolve) => {
      // 处理错误事件 - 立即 resolve（不等待 done）
      const handleError = (err: { message?: string; code?: string } | string) => {
        const errorMsg = typeof err === 'string' ? err : (err.message || 'Unknown error')
        error = errorMsg
        cleanup()
        
        // 结束推理
        if (isInReasoning) {
          if (assistantId && reasoningPartId) {
            store.finalizeReasoningPart(assistantId, reasoningPartId)
          }
          EventBus.emit({ type: 'stream:reasoning', text: '', phase: 'end' })
        }
        
        EventBus.emit({ type: 'llm:error', error: errorMsg })
        resolve({ content, toolCalls, usage, error: errorMsg })
      }
      
      // 替换原来的错误处理
      const errorCleanupIdx = cleanups.findIndex(fn => fn === unsubError)
      if (errorCleanupIdx !== -1) {
        cleanups.splice(errorCleanupIdx, 1)
        unsubError() // 取消原来的订阅
      }
      const unsubErrorNew = api.llm.onError(handleError)
      cleanups.push(unsubErrorNew)

      const unsubDone = api.llm.onDone((result: { usage?: unknown }) => {
        cleanup()

        // 从 done 事件获取 usage
        if (result?.usage) {
          usage = result.usage as TokenUsage
        }

        // 结束推理
        if (isInReasoning) {
          if (assistantId && reasoningPartId) {
            store.finalizeReasoningPart(assistantId, reasoningPartId)
          }
          EventBus.emit({ type: 'stream:reasoning', text: '', phase: 'end' })
        }

        // 发布完成事件
        if (error) {
          EventBus.emit({ type: 'llm:error', error })
        } else {
          EventBus.emit({ type: 'llm:done', content, toolCalls, usage })
        }

        resolve({ content, toolCalls, usage, error })
      })
      cleanups.push(unsubDone)
    })
  }

  EventBus.emit({ type: 'llm:start' })

  return { wait, cleanup }
}
