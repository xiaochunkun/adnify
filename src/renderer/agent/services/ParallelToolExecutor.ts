/**
 * 并行工具执行器
 * 智能分析工具依赖关系，最大化并行执行
 */

import { logger } from '@utils/Logger'
import { normalizePath } from '@shared/utils/pathUtils'
import { LLMToolCall } from '@/renderer/types/electron'
import { getReadOnlyTools, getParallelTools } from '@/shared/config/tools'
import { toolExecutionService, ToolExecutionContext } from './ToolExecutionService'

// 只读工具集合（缓存以提高性能）
const READ_ONLY_SET = new Set(getReadOnlyTools())

// 工具依赖分析结果
interface ToolDependencyAnalysis {
  // 可以并行执行的工具组
  parallelGroups: LLMToolCall[][]
  // 必须串行执行的工具
  serialTools: LLMToolCall[]
}

// 执行结果
interface ParallelExecutionResult {
  toolCall: LLMToolCall
  result: { success: boolean; content: string; rejected?: boolean; meta?: Record<string, unknown> }
}

/**
 * 分析工具之间的依赖关系
 * 优化：支持不同文件的写操作并行执行
 *
 * @param toolCalls 待执行的工具调用列表
 * @returns 分析结果，包含并行组和串行工具
 */
function analyzeToolDependencies(toolCalls: LLMToolCall[]): ToolDependencyAnalysis {
  const parallelTools = getParallelTools()

  // 分类工具
  const readTools: LLMToolCall[] = []
  const writeToolsByFile = new Map<string, LLMToolCall[]>()  // 按文件分组写操作
  const otherTools: LLMToolCall[] = []

  // 文件路径追踪（用于检测写后读依赖）
  const writeTargets = new Set<string>()

  for (const tc of toolCalls) {
    const isParallel = parallelTools.includes(tc.name)
    const isReadTool = READ_ONLY_SET.has(tc.name)
    const isWriteTool = !isReadTool && ['edit_file', 'write_file', 'create_file_or_folder', 'delete_file_or_folder'].includes(tc.name)

    if (isReadTool && isParallel) {
      readTools.push(tc)
    } else if (isWriteTool) {
      // 按文件路径分组写操作
      const targetPath = getToolTargetPath(tc)
      if (targetPath) {
        const normalized = normalizePath(targetPath)
        writeTargets.add(normalized)

        if (!writeToolsByFile.has(normalized)) {
          writeToolsByFile.set(normalized, [])
        }
        writeToolsByFile.get(normalized)!.push(tc)
      } else {
        otherTools.push(tc)
      }
    } else {
      otherTools.push(tc)
    }
  }

  // 检查读工具是否依赖写工具的输出
  const independentReads: LLMToolCall[] = []
  const dependentReads: LLMToolCall[] = []

  for (const readTool of readTools) {
    const targetPath = getToolTargetPath(readTool)
    if (targetPath && writeTargets.has(normalizePath(targetPath))) {
      // 这个读操作依赖于前面的写操作
      dependentReads.push(readTool)
    } else {
      independentReads.push(readTool)
    }
  }

  // 构建并行组
  const parallelGroups: LLMToolCall[][] = []

  // 第一组：所有独立的读操作可以并行
  if (independentReads.length > 0) {
    parallelGroups.push(independentReads)
  }

  // 第二组：不同文件的写操作可以并行
  const writeFiles = Array.from(writeToolsByFile.keys())
  if (writeFiles.length > 1) {
    // 多个不同文件的写操作可以并行
    const parallelWrites = writeFiles.flatMap(file => writeToolsByFile.get(file)!)
    parallelGroups.push(parallelWrites)

    // 依赖读操作需要在写操作之后串行执行
    return { parallelGroups, serialTools: [...dependentReads, ...otherTools] }
  } else if (writeFiles.length === 1) {
    // 单个文件的多个写操作必须串行
    const singleFileWrites = writeToolsByFile.get(writeFiles[0])!
    return { parallelGroups, serialTools: [...singleFileWrites, ...dependentReads, ...otherTools] }
  }

  // 没有写操作，只有其他工具
  return { parallelGroups, serialTools: [...dependentReads, ...otherTools] }
}



/**
 * 获取工具操作的目标路径
 */
function getToolTargetPath(toolCall: LLMToolCall): string | null {
  const args = toolCall.arguments as Record<string, unknown>
  return (args.path || args.file_path || args.directory) as string | null
}


/**
 * 并行执行工具组
 */
async function executeParallelGroup(
  tools: LLMToolCall[],
  context: ToolExecutionContext
): Promise<ParallelExecutionResult[]> {
  logger.agent.info(`[ParallelExecutor] Executing ${tools.length} tools in parallel`)
  
  const results = await Promise.all(
    tools.map(async (toolCall) => {
      try {
        const result = await toolExecutionService.executeToolCall(toolCall, context)
        return { toolCall, result }
      } catch (error: any) {
        logger.agent.error(`[ParallelExecutor] Error executing ${toolCall.name}:`, error)
        return {
          toolCall,
          result: { success: false, content: `Error: ${error.message}`, rejected: false }
        }
      }
    })
  )
  
  return results
}

/**
 * 串行执行工具
 */
async function executeSerialTools(
  tools: LLMToolCall[],
  context: ToolExecutionContext,
  abortSignal?: AbortSignal
): Promise<{ results: ParallelExecutionResult[]; userRejected: boolean }> {
  const results: ParallelExecutionResult[] = []
  let userRejected = false
  
  for (const toolCall of tools) {
    if (abortSignal?.aborted || userRejected) break
    
    logger.agent.info(`[ParallelExecutor] Executing serial tool: ${toolCall.name}`)
    
    try {
      const result = await toolExecutionService.executeToolCall(toolCall, context)
      results.push({ toolCall, result })
      
      if (result.rejected) {
        userRejected = true
        break
      }
    } catch (error: any) {
      logger.agent.error(`[ParallelExecutor] Error executing ${toolCall.name}:`, error)
      results.push({
        toolCall,
        result: { success: false, content: `Error: ${error.message}`, rejected: false }
      })
    }
    
    // 让出执行权，避免阻塞 UI
    await new Promise(resolve => setTimeout(resolve, 0))
  }
  
  return { results, userRejected }
}

/**
 * 智能执行工具调用
 * 自动分析依赖关系，最大化并行执行
 * 优化：添加性能监控和统计
 *
 * @param toolCalls 待执行的工具调用列表
 * @param context 执行上下文
 * @param abortSignal 中止信号
 * @returns 执行结果和用户拒绝状态
 */
export async function executeToolCallsIntelligently(
  toolCalls: LLMToolCall[],
  context: ToolExecutionContext,
  abortSignal?: AbortSignal
): Promise<{ results: ParallelExecutionResult[]; userRejected: boolean }> {
  if (toolCalls.length === 0) {
    return { results: [], userRejected: false }
  }

  // 记录开始时间
  const startTime = Date.now()

  // 单个工具直接执行
  if (toolCalls.length === 1) {
    const result = await toolExecutionService.executeToolCall(toolCalls[0], context)
    const duration = Date.now() - startTime
    logger.agent.info(`[ParallelExecutor] Single tool executed in ${duration}ms`)
    return {
      results: [{ toolCall: toolCalls[0], result }],
      userRejected: result.rejected || false
    }
  }

  // 分析依赖关系
  const { parallelGroups, serialTools } = analyzeToolDependencies(toolCalls)

  logger.agent.info(
    `[ParallelExecutor] Analysis: ${parallelGroups.length} parallel groups (${parallelGroups.reduce((sum, g) => sum + g.length, 0)} tools), ${serialTools.length} serial tools`
  )

  const allResults: ParallelExecutionResult[] = []
  let userRejected = false
  let parallelCount = 0
  let serialCount = 0

  // 先执行并行组
  for (const group of parallelGroups) {
    if (abortSignal?.aborted || userRejected) break

    const groupStartTime = Date.now()
    const groupResults = await executeParallelGroup(group, context)
    const groupDuration = Date.now() - groupStartTime

    allResults.push(...groupResults)
    parallelCount += group.length

    logger.agent.info(`[ParallelExecutor] Parallel group (${group.length} tools) completed in ${groupDuration}ms`)

    // 检查是否有拒绝
    if (groupResults.some(r => r.result.rejected)) {
      userRejected = true
      break
    }
  }

  // 再执行串行工具
  if (!userRejected && !abortSignal?.aborted && serialTools.length > 0) {
    const serialStartTime = Date.now()
    const { results: serialResults, userRejected: serialRejected } = await executeSerialTools(
      serialTools,
      context,
      abortSignal
    )
    const serialDuration = Date.now() - serialStartTime

    allResults.push(...serialResults)
    userRejected = serialRejected
    serialCount = serialTools.length

    logger.agent.info(`[ParallelExecutor] Serial tools (${serialTools.length}) completed in ${serialDuration}ms`)
  }

  // 输出性能统计
  const totalDuration = Date.now() - startTime
  const stats = getExecutionStats(allResults)

  logger.agent.info(
    `[ParallelExecutor] Execution complete: ${stats.total} tools in ${totalDuration}ms ` +
    `(${parallelCount} parallel, ${serialCount} serial) - ` +
    `Success: ${stats.successful}, Failed: ${stats.failed}, Rejected: ${stats.rejected}`
  )

  return { results: allResults, userRejected }
}

/**
 * 获取执行统计
 */
export function getExecutionStats(results: ParallelExecutionResult[]): {
  total: number
  successful: number
  failed: number
  rejected: number
} {
  return {
    total: results.length,
    successful: results.filter(r => r.result.success).length,
    failed: results.filter(r => !r.result.success && !r.result.rejected).length,
    rejected: results.filter(r => r.result.rejected).length,
  }
}
