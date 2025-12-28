/**
 * 并行工具执行器
 * 智能分析工具依赖关系，最大化并行执行
 */

import { logger } from '@utils/Logger'
import { LLMToolCall } from '@/renderer/types/electron'
import { toolRegistry } from '../tools'
import { getReadOnlyTools } from '@/shared/config/tools'
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
  result: { success: boolean; content: string; rejected?: boolean }
}

/**
 * 分析工具之间的依赖关系
 */
function analyzeToolDependencies(toolCalls: LLMToolCall[]): ToolDependencyAnalysis {
  const parallelTools = toolRegistry.getParallelTools()
  
  // 分类工具
  const readTools: LLMToolCall[] = []
  const writeTools: LLMToolCall[] = []
  
  // 文件路径追踪（用于检测写后读依赖）
  const writeTargets = new Set<string>()
  
  for (const tc of toolCalls) {
    const isParallel = parallelTools.includes(tc.name)
    const isReadTool = READ_ONLY_SET.has(tc.name)
    
    if (isReadTool && isParallel) {
      readTools.push(tc)
    } else {
      writeTools.push(tc)
      // 记录写操作的目标文件
      const targetPath = getToolTargetPath(tc)
      if (targetPath) {
        writeTargets.add(normalizePathForComparison(targetPath))
      }
    }
  }
  
  // 检查读工具是否依赖写工具的输出
  const independentReads: LLMToolCall[] = []
  const dependentReads: LLMToolCall[] = []
  
  for (const readTool of readTools) {
    const targetPath = getToolTargetPath(readTool)
    if (targetPath && writeTargets.has(normalizePathForComparison(targetPath))) {
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
  
  // 写操作和依赖读操作需要串行
  const serialTools = [...writeTools, ...dependentReads]
  
  return { parallelGroups, serialTools }
}



/**
 * 获取工具操作的目标路径
 */
function getToolTargetPath(toolCall: LLMToolCall): string | null {
  const args = toolCall.arguments as Record<string, unknown>
  return (args.path || args.file_path || args.directory) as string | null
}

/**
 * 标准化路径用于比较
 */
function normalizePathForComparison(path: string): string {
  return path.replace(/\\/g, '/').toLowerCase()
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
 */
export async function executeToolCallsIntelligently(
  toolCalls: LLMToolCall[],
  context: ToolExecutionContext,
  abortSignal?: AbortSignal
): Promise<{ results: ParallelExecutionResult[]; userRejected: boolean }> {
  if (toolCalls.length === 0) {
    return { results: [], userRejected: false }
  }
  
  // 单个工具直接执行
  if (toolCalls.length === 1) {
    const result = await toolExecutionService.executeToolCall(toolCalls[0], context)
    return {
      results: [{ toolCall: toolCalls[0], result }],
      userRejected: result.rejected || false
    }
  }
  
  // 分析依赖关系
  const { parallelGroups, serialTools } = analyzeToolDependencies(toolCalls)
  
  logger.agent.info(
    `[ParallelExecutor] Analysis: ${parallelGroups.length} parallel groups, ${serialTools.length} serial tools`
  )
  
  const allResults: ParallelExecutionResult[] = []
  let userRejected = false
  
  // 先执行并行组
  for (const group of parallelGroups) {
    if (abortSignal?.aborted || userRejected) break
    
    const groupResults = await executeParallelGroup(group, context)
    allResults.push(...groupResults)
    
    // 检查是否有拒绝
    if (groupResults.some(r => r.result.rejected)) {
      userRejected = true
      break
    }
  }
  
  // 再执行串行工具
  if (!userRejected && !abortSignal?.aborted && serialTools.length > 0) {
    const { results: serialResults, userRejected: serialRejected } = await executeSerialTools(
      serialTools,
      context,
      abortSignal
    )
    allResults.push(...serialResults)
    userRejected = serialRejected
  }
  
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
