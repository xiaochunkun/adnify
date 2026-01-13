/**
 * 工具执行模块
 * 
 * 职责：
 * - 工具审批流程
 * - 智能并行执行
 * - 文件快照保存（用于撤销）
 * - 发布事件到 EventBus
 */

import { api } from '@/renderer/services/electronAPI'
import { logger } from '@utils/Logger'
import { useAgentStore } from '../store/AgentStore'
import { toolRegistry } from '../tools/registry'
import { getToolApprovalType, isFileEditTool } from '@/shared/config/tools'
import { pathStartsWith, joinPath } from '@shared/utils/pathUtils'
import { useStore } from '@store'
import { EventBus } from './EventBus'
import type { ToolCall } from '@/shared/types'
import type { ToolExecutionContext, ToolExecutionResult } from './types'

// ===== 审批服务 =====

class ApprovalServiceClass {
  private pendingResolve: ((approved: boolean) => void) | null = null

  async waitForApproval(): Promise<boolean> {
    return new Promise((resolve) => {
      this.pendingResolve = resolve
    })
  }

  approve(): void {
    if (this.pendingResolve) {
      this.pendingResolve(true)
      this.pendingResolve = null
    }
  }

  reject(): void {
    if (this.pendingResolve) {
      this.pendingResolve(false)
      this.pendingResolve = null
    }
  }
}

export const approvalService = new ApprovalServiceClass()

// ===== 文件快照 =====

/**
 * 在工具执行前保存文件快照到检查点
 * 用于支持撤销功能
 */
async function saveFileSnapshots(
  toolCalls: ToolCall[],
  context: ToolExecutionContext
): Promise<void> {
  const store = useAgentStore.getState()
  const { workspacePath } = context

  // 找出所有文件编辑工具
  const editTools = toolCalls.filter(tc => isFileEditTool(tc.name))
  if (editTools.length === 0) return

  // 并行读取所有文件的当前内容
  const snapshotPromises = editTools.map(async (tc) => {
    const path = tc.arguments?.path as string
    if (!path) return null

    const fullPath = workspacePath && !pathStartsWith(path, workspacePath)
      ? joinPath(workspacePath, path)
      : path

    try {
      const content = await api.file.read(fullPath)
      return { filePath: fullPath, content }
    } catch {
      // 文件不存在，content 为 null（新建文件）
      return { filePath: fullPath, content: null }
    }
  })

  const snapshots = await Promise.all(snapshotPromises)

  // 保存到检查点
  for (const snapshot of snapshots) {
    if (snapshot) {
      store.addSnapshotToCurrentCheckpoint(snapshot.filePath, snapshot.content)
    }
  }
}

// ===== 工具执行 =====

/**
 * 检查工具是否需要审批
 * 基于 TOOL_CONFIGS 中的 approvalType 配置
 */
function needsApproval(toolName: string): boolean {
  const { agentConfig } = useStore.getState()
  // 检查 autoApprove 设置
  if ((agentConfig as any)?.autoApprove) return false
  
  // 使用工具配置中的 approvalType
  const approvalType = getToolApprovalType(toolName)
  return approvalType !== 'none'
}

/**
 * 分析工具依赖关系
 */
function analyzeToolDependencies(toolCalls: ToolCall[]): Map<string, Set<string>> {
  const deps = new Map<string, Set<string>>()
  const fileWriters = new Map<string, string>() // path -> toolCallId

  for (const tc of toolCalls) {
    deps.set(tc.id, new Set())
    
    if (isFileEditTool(tc.name)) {
      const path = tc.arguments?.path as string
      if (path) {
        // 如果之前有工具写过这个文件，建立依赖
        const prevWriter = fileWriters.get(path)
        if (prevWriter) {
          deps.get(tc.id)!.add(prevWriter)
        }
        fileWriters.set(path, tc.id)
      }
    }
  }

  return deps
}

/**
 * 执行单个工具
 */
async function executeSingle(
  toolCall: ToolCall,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const store = useAgentStore.getState()
  const mainStore = useStore.getState()
  const { currentAssistantId, workspacePath } = context
  const startTime = Date.now()

  // 更新状态为运行中
  if (currentAssistantId) {
    store.updateToolCall(currentAssistantId, toolCall.id, { status: 'running' })
  }
  EventBus.emit({ type: 'tool:running', id: toolCall.id })

  // 记录请求日志
  mainStore.addToolCallLog({
    type: 'request',
    toolName: toolCall.name,
    data: toolCall.arguments,
  })

  try {
    const result = await toolRegistry.execute(
      toolCall.name,
      toolCall.arguments,
      { workspacePath: workspacePath ?? null, currentAssistantId: currentAssistantId ?? null }
    )

    const duration = Date.now() - startTime
    const content = result.success
      ? (result.result || 'Success')
      : `Error: ${result.error || 'Unknown error'}`

    // 记录响应日志
    mainStore.addToolCallLog({
      type: 'response',
      toolName: toolCall.name,
      data: content,
      duration,
      success: result.success,
      error: result.success ? undefined : result.error,
    })

    // 更新状态
    if (currentAssistantId) {
      store.updateToolCall(currentAssistantId, toolCall.id, {
        status: result.success ? 'success' : 'error',
        result: content,
      })
      store.addToolResult(toolCall.id, toolCall.name, content, result.success ? 'success' : 'tool_error')
    }

    const meta = result.meta || {}
    EventBus.emit({
      type: result.success ? 'tool:completed' : 'tool:error',
      id: toolCall.id,
      ...(result.success ? { result: content, meta } : { error: content }),
    } as any)

    return { toolCall, result: { content, meta } }
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMsg = error instanceof Error ? error.message : String(error)

    // 记录错误日志
    mainStore.addToolCallLog({
      type: 'response',
      toolName: toolCall.name,
      data: errorMsg,
      duration,
      success: false,
      error: errorMsg,
    })
    
    if (currentAssistantId) {
      store.updateToolCall(currentAssistantId, toolCall.id, { status: 'error', result: errorMsg })
      store.addToolResult(toolCall.id, toolCall.name, `Error: ${errorMsg}`, 'tool_error')
    }
    EventBus.emit({ type: 'tool:error', id: toolCall.id, error: errorMsg })

    return { toolCall, result: { content: `Error: ${errorMsg}` } }
  }
}

/**
 * 执行工具列表（智能并行）
 */
export async function executeTools(
  toolCalls: ToolCall[],
  context: ToolExecutionContext,
  abortSignal?: AbortSignal
): Promise<{ results: ToolExecutionResult[]; userRejected: boolean }> {
  const store = useAgentStore.getState()
  const results: ToolExecutionResult[] = []
  let userRejected = false

  // 分析依赖
  const deps = analyzeToolDependencies(toolCalls)
  const completed = new Set<string>()
  const pending = new Set(toolCalls.map(tc => tc.id))

  // 检查是否需要审批
  const needsApprovalTools = toolCalls.filter(tc => needsApproval(tc.name))
  
  if (needsApprovalTools.length > 0) {
    // 设置待审批状态
    store.setStreamPhase('tool_pending')
    for (const tc of needsApprovalTools) {
      if (context.currentAssistantId) {
        store.updateToolCall(context.currentAssistantId, tc.id, { status: 'awaiting' })
      }
      EventBus.emit({ type: 'tool:pending', id: tc.id, name: tc.name, args: tc.arguments })
    }

    // 等待审批
    const approved = await approvalService.waitForApproval()
    
    if (!approved || abortSignal?.aborted) {
      userRejected = true
      for (const tc of toolCalls) {
        if (context.currentAssistantId) {
          store.updateToolCall(context.currentAssistantId, tc.id, { status: 'rejected' })
        }
        EventBus.emit({ type: 'tool:rejected', id: tc.id })
        results.push({ toolCall: tc, result: { content: 'Rejected by user' } })
      }
      store.setStreamPhase('idle')
      return { results, userRejected }
    }
  }

  store.setStreamPhase('tool_running')

  // 在执行前保存文件快照（用于撤销）
  await saveFileSnapshots(toolCalls, context)

  // 执行工具（考虑依赖关系）
  while (pending.size > 0 && !abortSignal?.aborted) {
    // 找出可以执行的工具（依赖已完成）
    const ready = toolCalls.filter(tc => 
      pending.has(tc.id) && 
      Array.from(deps.get(tc.id) || []).every(dep => completed.has(dep))
    )

    if (ready.length === 0) {
      logger.agent.error('[Tools] Circular dependency detected')
      break
    }

    // 并行执行
    const batchResults = await Promise.all(
      ready.map(tc => executeSingle(tc, context))
    )

    for (const result of batchResults) {
      results.push(result)
      completed.add(result.toolCall.id)
      pending.delete(result.toolCall.id)
    }
  }

  return { results, userRejected }
}
