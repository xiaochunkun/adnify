/**
 * Agent 主循环
 * 
 * 职责：
 * - 管理 LLM 调用循环
 * - 基于真实 token 使用量的上下文压缩
 * - 工具执行协调
 * - 循环检测
 * - 发布事件到 EventBus
 */

import { api } from '@/renderer/services/electronAPI'
import { logger } from '@utils/Logger'
import { performanceMonitor, withRetry, isRetryableError } from '@shared/utils'
import { useAgentStore } from '../store/AgentStore'
import { useStore } from '@store'
import { toolManager, initializeToolProviders, setToolLoadingContext, initializeTools } from '../tools'
import { toolRegistry } from '../tools/registry'
import { getAgentConfig, READ_TOOLS } from '../utils/AgentConfig'
import { LoopDetector } from '../utils/LoopDetector'
import { getReadOnlyTools, isFileEditTool } from '@/shared/config/tools'
import { pathStartsWith, joinPath } from '@shared/utils/pathUtils'
import { createStreamProcessor } from './stream'
import { executeTools } from './tools'
import { EventBus } from './EventBus'
import { 
  pruneMessages, 
  getCompressionLevel, 
  COMPRESSION_LEVEL_NAMES,
  estimateTokens,
  generateSummary,
  generateHandoffDocument,
} from '../context'
import type { OpenAIMessage } from '../llm/MessageConverter'
import type { WorkMode } from '@/renderer/modes/types'
import type { LLMConfig, LLMCallResult, ExecutionContext } from './types'

// ===== LLM 调用 =====

async function callLLM(
  config: LLMConfig,
  messages: OpenAIMessage[],
  chatMode: WorkMode,
  assistantId: string | null
): Promise<LLMCallResult> {
  performanceMonitor.start(`llm:${config.model}`, 'llm', { provider: config.provider, messageCount: messages.length })

  const processor = createStreamProcessor(assistantId)

  // 初始化工具
  initializeToolProviders()
  await initializeTools()
  const templateId = useStore.getState().promptTemplateId
  setToolLoadingContext({
    mode: chatMode === 'plan' ? 'plan' : chatMode === 'chat' ? 'chat' : 'code',
    templateId,
  })
  const tools = chatMode === 'chat' ? [] : toolManager.getAllToolDefinitions()

  // 发送请求
  api.llm.send({ config: config as any, messages: messages as any, tools, systemPrompt: '' }).catch(() => {
    processor.cleanup()
  })

  const result = await processor.wait()
  performanceMonitor.end(`llm:${config.model}`, !result.error)

  // 更新 usage
  if (assistantId && result.usage) {
    useAgentStore.getState().updateMessage(assistantId, { usage: result.usage } as any)
  }

  return result
}

async function callLLMWithRetry(
  config: LLMConfig,
  messages: OpenAIMessage[],
  chatMode: WorkMode,
  assistantId: string | null,
  abortSignal?: AbortSignal
): Promise<LLMCallResult> {
  const retryConfig = getAgentConfig()
  try {
    return await withRetry(
      async () => {
        if (abortSignal?.aborted) throw new Error('Aborted')
        const result = await callLLM(config, messages, chatMode, assistantId)
        if (result.error) throw new Error(result.error)
        return result
      },
      {
        maxRetries: retryConfig.maxRetries,
        initialDelayMs: retryConfig.retryDelayMs,
        backoffMultiplier: retryConfig.retryBackoffMultiplier,
        isRetryable: error => {
          const msg = error instanceof Error ? error.message : String(error)
          return isRetryableError(error) && msg !== 'Aborted'
        },
        onRetry: (attempt, error, delay) => logger.agent.info(`[Loop] LLM retry ${attempt}, waiting ${delay}ms...`, error),
      }
    )
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}

// ===== 自动修复 =====

async function autoFix(
  toolCalls: any[],
  workspacePath: string,
  assistantId: string | null
): Promise<void> {
  const store = useAgentStore.getState()
  const writeToolCalls = toolCalls.filter(tc => !READ_TOOLS.includes(tc.name))
  if (writeToolCalls.length === 0) return

  const editedFiles = writeToolCalls
    .filter(tc => isFileEditTool(tc.name))
    .map(tc => {
      const path = tc.arguments.path as string
      return pathStartsWith(path, workspacePath) ? path : joinPath(workspacePath, path)
    })
    .filter(path => !path.endsWith('/'))

  if (editedFiles.length === 0) return

  // 并行检查所有文件的 lint 错误
  const results = await Promise.all(
    editedFiles.map(async (filePath) => {
      try {
        const result = await toolRegistry.execute('get_lint_errors', { path: filePath }, { workspacePath })
        if (result.success && result.result) {
          const text = result.result.trim()
          if (text && text !== '[]' && text !== 'No diagnostics found') {
            if (/\[error\]/i.test(text) || text.includes('failed to compile') || text.includes('syntax error')) {
              return `File: ${filePath}\n${text}`
            }
          }
        }
      } catch { /* ignore */ }
      return null
    })
  )

  const errors = results.filter((e): e is string => e !== null)

  if (errors.length > 0 && assistantId) {
    store.appendToAssistant(assistantId, `\n\n🔍 **Auto-check**: Detected ${errors.length} issue(s). Attempting to fix...`)
  }
}

// ===== 压缩检查与处理 =====

interface CompressionCheckResult {
  level: 0 | 1 | 2 | 3 | 4
  needsHandoff: boolean
}

async function checkAndHandleCompression(
  usage: { input: number; output: number },
  contextLimit: number,
  store: ReturnType<typeof useAgentStore.getState>,
  context: ExecutionContext,
  assistantId: string,
  enableLLMSummary: boolean,
  autoHandoff: boolean
): Promise<CompressionCheckResult> {
  const totalUsed = usage.input + usage.output
  const ratio = totalUsed / contextLimit
  const level = getCompressionLevel(ratio)

  const thread = store.getCurrentThread()
  const userTurns = thread?.messages.filter(m => m.role === 'user').length || 0

  logger.agent.info(`[Compression] Level ${level} (${COMPRESSION_LEVEL_NAMES[level]}), ratio: ${(ratio * 100).toFixed(1)}%, tokens: ${totalUsed}/${contextLimit}`)

  // 记录本次新增节省的 token 数
  let newSavedTokens = 0
  
  // 计算已经压缩的 token 数（之前 prune 过的）
  let alreadySavedTokens = 0
  if (thread) {
    for (const msg of thread.messages) {
      if (msg.role === 'tool') {
        const toolMsg = msg as import('../types').ToolResultMessage
        if (toolMsg.compactedAt) {
          // 已压缩的工具结果，估算其原始大小
          const content = typeof toolMsg.content === 'string' ? toolMsg.content : ''
          // 如果内容是占位符，估算原始大小（假设平均 2000 token）
          if (content === '[Old tool result content cleared]' || content.length < 100) {
            alreadySavedTokens += 2000
          } else {
            alreadySavedTokens += estimateTokens(content)
          }
        }
      }
    }
  }

  // L2+: 执行 prune 并标记当前 assistant 消息为压缩点
  if (level >= 2 && thread) {
    // 标记压缩点
    store.updateMessage(assistantId, { compactedAt: Date.now() } as any)
    
    // 执行 prune
    const pruneResult = pruneMessages(thread.messages)
    if (pruneResult.prunedCount > 0) {
      for (const msgId of pruneResult.messagesToCompact) {
        store.updateMessage(msgId, { compactedAt: Date.now() } as any)
      }
      newSavedTokens = pruneResult.pruned
      logger.agent.info(`[Compression] Pruned ${pruneResult.prunedCount} tool results, saved ~${pruneResult.pruned} tokens`)
      EventBus.emit({ type: 'context:prune', prunedCount: pruneResult.prunedCount, savedTokens: pruneResult.pruned })
    }
  }
  
  // 总节省 = 已压缩 + 本次新增
  const totalSavedTokens = alreadySavedTokens + newSavedTokens

  // L3: 生成 LLM 摘要
  if (level >= 3 && enableLLMSummary && thread) {
    try {
      const summaryResult = await generateSummary(thread.messages, { type: 'detailed' })
      store.setContextSummary({
        objective: summaryResult.objective,
        completedSteps: summaryResult.completedSteps,
        pendingSteps: summaryResult.pendingSteps,
        decisions: [],
        fileChanges: summaryResult.fileChanges,
        errorsAndFixes: [],
        userInstructions: [],
        generatedAt: Date.now(),
        turnRange: [0, userTurns],
      })
      EventBus.emit({ type: 'context:summary', summary: summaryResult.summary })
    } catch {
      // 摘要生成失败，不影响主流程
    }
  }

  // L4: 生成 Handoff 文档（仅当 autoHandoff 启用时）
  if (level >= 4) {
    if (autoHandoff && thread && context.workspacePath) {
      try {
        const handoff = await generateHandoffDocument(thread.id, thread.messages, context.workspacePath)
        store.setHandoffDocument(handoff)
        EventBus.emit({ type: 'context:handoff', document: handoff })
      } catch {
        // Handoff 生成失败，不影响主流程
      }
    }

    const { language } = useStore.getState()
    const msg = language === 'zh'
      ? '⚠️ **上下文已满**\n\n当前对话已达到上下文限制。我已保存对话摘要，您可以开始新会话继续。'
      : '⚠️ **Context Limit Reached**\n\nI have saved a summary of our conversation. Please start a new session to continue.'
    store.appendToAssistant(assistantId, msg)
    store.setHandoffRequired(true)
  }

  // 更新压缩统计（使用配置中的轮次设置）
  const agentConfig = getAgentConfig()
  const keptTurns = Math.min(
    userTurns, 
    level === 0 ? userTurns 
      : level === 1 ? agentConfig.keepRecentTurns * 2  // L1: 保留更多
      : level === 2 ? agentConfig.keepRecentTurns      // L2: 使用 keepRecentTurns
      : level === 3 ? agentConfig.deepCompressionTurns // L3: 使用 deepCompressionTurns
      : agentConfig.deepCompressionTurns               // L4: 最少保留
  )
  const compactedTurns = Math.max(0, userTurns - keptTurns)

  // 计算原始 token 数（当前使用 + 已节省的）
  const originalTokens = totalUsed + totalSavedTokens
  // 当前 token 数就是 LLM 返回的真实使用量
  const finalTokens = totalUsed
  // 节省百分比
  const savedPercent = totalSavedTokens > 0 ? Math.round((totalSavedTokens / originalTokens) * 100) : 0

  store.setCompressionStats({
    level,
    levelName: COMPRESSION_LEVEL_NAMES[level],
    originalTokens,
    finalTokens,
    savedPercent,
    keptTurns,
    compactedTurns,
    needsHandoff: level >= 4,
    lastOptimizedAt: Date.now(),
  })

  if (totalSavedTokens > 0) {
    logger.agent.info(`[Compression] Stats: original=${originalTokens}, final=${finalTokens}, saved=${savedPercent}%`)
  }

  EventBus.emit({ type: 'context:level', level, tokens: totalUsed, ratio })

  return { level, needsHandoff: level >= 4 }
}

// ===== 主循环 =====

export async function runLoop(
  config: LLMConfig,
  llmMessages: OpenAIMessage[],
  context: ExecutionContext,
  assistantId: string
): Promise<void> {
  const store = useAgentStore.getState()
  const mainStore = useStore.getState()
  
  // 一次性获取所有配置，避免重复调用 getState()
  const agentConfig = getAgentConfig()
  const maxIterations = mainStore.agentConfig.maxToolLoops || agentConfig.maxToolLoops
  const enableAutoFix = mainStore.agentConfig.enableAutoFix
  const enableLLMSummary = mainStore.agentConfig.enableLLMSummary
  const autoHandoff = mainStore.agentConfig.autoHandoff ?? agentConfig.autoHandoff

  // 获取模型上下文限制（默认 128k）
  const contextLimit = config.contextLimit || 128_000

  const loopDetector = new LoopDetector()
  let iteration = 0
  let shouldContinue = true

  EventBus.emit({ type: 'loop:start' })

  while (shouldContinue && iteration < maxIterations && !context.abortSignal?.aborted) {
    iteration++
    shouldContinue = false
    EventBus.emit({ type: 'loop:iteration', count: iteration })

    if (llmMessages.length === 0) {
      logger.agent.error('[Loop] No messages to send')
      store.appendToAssistant(assistantId, '\n\n❌ Error: No messages to send')
      EventBus.emit({ type: 'loop:end', reason: 'no_messages' })
      break
    }

    // 调用 LLM
    const result = await callLLMWithRetry(config, llmMessages, context.chatMode, assistantId, context.abortSignal)

    if (context.abortSignal?.aborted) {
      EventBus.emit({ type: 'loop:end', reason: 'aborted' })
      break
    }

    if (result.error) {
      logger.agent.error('[Loop] LLM error:', result.error)
      store.appendToAssistant(assistantId, `\n\n❌ Error: ${result.error}`)
      EventBus.emit({ type: 'loop:end', reason: 'error' })
      break
    }

    // 在 LLM 调用后立即检查压缩（参考 OpenCode 的 finish-step 逻辑）
    if (result.usage) {
      const usage = {
        input: result.usage.promptTokens || 0,
        output: result.usage.completionTokens || 0,
      }

      const compressionResult = await checkAndHandleCompression(
        usage,
        contextLimit,
        store,
        context,
        assistantId,
        enableLLMSummary,
        autoHandoff
      )

      // L4 需要中断循环
      if (compressionResult.needsHandoff) {
        EventBus.emit({ type: 'loop:end', reason: 'handoff_required' })
        break
      }
    }

    // 没有工具调用
    if (!result.toolCalls || result.toolCalls.length === 0) {
      // Plan 模式提醒
      if (context.chatMode === 'plan' && store.plan) {
        const readOnlyTools = getReadOnlyTools()
        const hasWriteOps = llmMessages.some(m => m.role === 'assistant' && m.tool_calls?.some((tc: any) => !readOnlyTools.includes(tc.function.name)))
        const hasUpdatePlan = llmMessages.some(m => m.role === 'assistant' && m.tool_calls?.some((tc: any) => tc.function.name === 'update_plan'))
        if (hasWriteOps && !hasUpdatePlan && iteration < maxIterations) {
          llmMessages.push({ role: 'user', content: 'Reminder: Please use `update_plan` to update the plan status before finishing.' })
          shouldContinue = true
          continue
        }
      }
      EventBus.emit({ type: 'loop:end', reason: 'complete' })
      break
    }

    // 循环检测
    const loopCheck = loopDetector.checkLoop(result.toolCalls)
    if (loopCheck.isLoop) {
      logger.agent.warn(`[Loop] Loop detected: ${loopCheck.reason}`)
      const suggestion = loopCheck.suggestion ? `\n💡 ${loopCheck.suggestion}` : ''
      store.appendToAssistant(assistantId, `\n\n⚠️ ${loopCheck.reason}${suggestion}`)
      EventBus.emit({ type: 'loop:warning', message: loopCheck.reason || 'Loop detected' })
      EventBus.emit({ type: 'loop:end', reason: 'loop_detected' })
      break
    }

    // 添加工具调用到 UI
    const currentMsg = store.getMessages().find(m => m.id === assistantId)
    if (currentMsg?.role === 'assistant') {
      const existing = (currentMsg as any).toolCalls || []
      for (const tc of result.toolCalls) {
        if (!existing.find((e: any) => e.id === tc.id)) {
          store.addToolCallPart(assistantId, { id: tc.id, name: tc.name, arguments: tc.arguments })
        }
      }
    }

    // 添加到消息历史
    llmMessages.push({
      role: 'assistant',
      content: result.content || null,
      tool_calls: result.toolCalls.map(tc => ({
        id: tc.id,
        type: 'function' as const,
        function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
      })),
    })

    // 执行工具
    const { results: toolResults, userRejected } = await executeTools(
      result.toolCalls,
      { workspacePath: context.workspacePath, currentAssistantId: assistantId },
      context.abortSignal
    )

    // 检查 ask_user
    const waitingResult = toolResults.find(r => r.result.meta?.waitingForUser)
    if (waitingResult) {
      // 从 meta 中提取 interactive 数据并设置到 store
      const interactive = waitingResult.result.meta?.interactive as import('../types').InteractiveContent | undefined
      if (interactive) {
        store.setInteractive(assistantId, interactive)
      } else {
        // 兜底：如果没有 interactive 数据，至少要 finalize
        store.finalizeAssistant(assistantId)
      }
      store.setStreamPhase('idle')
      EventBus.emit({ type: 'loop:end', reason: 'waiting_for_user' })
      break
    }

    // 添加工具结果
    for (const { toolCall, result: toolResult } of toolResults) {
      llmMessages.push({
        role: 'tool' as const,
        tool_call_id: toolCall.id,
        name: toolCall.name,
        content: toolResult.content,
      })
      const meta = toolResult.meta
      if (meta?.filePath && typeof meta.filePath === 'string' && typeof meta.newContent === 'string') {
        loopDetector.updateContentHash(meta.filePath, meta.newContent)
        
        // 添加待确认的文件变更
        store.addPendingChange({
          filePath: meta.filePath,
          toolCallId: toolCall.id,
          toolName: toolCall.name,
          changeType: meta.oldContent ? 'modify' : 'create',
          snapshot: {
            path: meta.filePath,
            content: (meta.oldContent as string) || null,
            timestamp: Date.now(),
          },
          newContent: meta.newContent,
          linesAdded: (meta.linesAdded as number) || 0,
          linesRemoved: (meta.linesRemoved as number) || 0,
        })
      }
    }

    // 自动修复（并行检查）
    if (enableAutoFix && !userRejected && context.workspacePath) {
      await autoFix(result.toolCalls, context.workspacePath, assistantId)
    }

    if (userRejected) {
      EventBus.emit({ type: 'loop:end', reason: 'user_rejected' })
      break
    }

    shouldContinue = true
    store.setStreamPhase('streaming')
  }

  if (iteration >= maxIterations) {
    store.appendToAssistant(assistantId, '\n\n⚠️ Reached maximum tool call limit.')
    EventBus.emit({ type: 'loop:warning', message: 'Max iterations reached' })
    EventBus.emit({ type: 'loop:end', reason: 'max_iterations' })
  }

  // 循环结束，finalize 由 Agent.ts 的 cleanup 处理
}
