/**
 * Agent 配置管理
 * 集中管理 Agent 运行时配置
 * 
 * 使用 src/shared/config/agentConfig.ts 作为配置源
 */

import { useStore } from '@store'
import { DEFAULT_AGENT_CONFIG, type AgentRuntimeConfig } from '@/shared/config/agentConfig'
import { getReadOnlyTools } from '@/shared/config/tools'

// 重新导出类型
export type { AgentRuntimeConfig }

/**
 * 从 store 获取动态配置
 * 合并用户配置和默认配置
 */
export function getAgentConfig(): AgentRuntimeConfig {
    const agentConfig = useStore.getState().agentConfig || {}
    return {
        // 基础配置
        maxToolLoops: agentConfig.maxToolLoops ?? DEFAULT_AGENT_CONFIG.maxToolLoops,
        maxHistoryMessages: agentConfig.maxHistoryMessages ?? DEFAULT_AGENT_CONFIG.maxHistoryMessages,

        // 上下文限制
        maxToolResultChars: agentConfig.maxToolResultChars ?? DEFAULT_AGENT_CONFIG.maxToolResultChars,
        maxFileContentChars: agentConfig.maxFileContentChars ?? DEFAULT_AGENT_CONFIG.maxFileContentChars,
        maxTotalContextChars: agentConfig.maxTotalContextChars ?? DEFAULT_AGENT_CONFIG.maxTotalContextChars,
        maxSingleFileChars: (agentConfig as any).maxSingleFileChars ?? DEFAULT_AGENT_CONFIG.maxSingleFileChars,
        maxContextFiles: (agentConfig as any).maxContextFiles ?? DEFAULT_AGENT_CONFIG.maxContextFiles,
        maxSemanticResults: (agentConfig as any).maxSemanticResults ?? DEFAULT_AGENT_CONFIG.maxSemanticResults,
        maxTerminalChars: (agentConfig as any).maxTerminalChars ?? DEFAULT_AGENT_CONFIG.maxTerminalChars,

        // 重试配置（从 store 获取）
        maxRetries: (agentConfig as any).maxRetries ?? DEFAULT_AGENT_CONFIG.maxRetries,
        retryDelayMs: (agentConfig as any).retryDelayMs ?? DEFAULT_AGENT_CONFIG.retryDelayMs,
        retryBackoffMultiplier: DEFAULT_AGENT_CONFIG.retryBackoffMultiplier,

        // 工具执行
        toolTimeoutMs: (agentConfig as any).toolTimeoutMs ?? DEFAULT_AGENT_CONFIG.toolTimeoutMs,
        enableAutoFix: (agentConfig as any).enableAutoFix ?? DEFAULT_AGENT_CONFIG.enableAutoFix,

        // 上下文压缩阈值
        contextCompressThreshold: (agentConfig as any).contextCompressThreshold ?? DEFAULT_AGENT_CONFIG.contextCompressThreshold,
        keepRecentTurns: (agentConfig as any).keepRecentTurns ?? DEFAULT_AGENT_CONFIG.keepRecentTurns,

        // 循环检测配置（从 store 获取）
        loopDetection: {
            maxHistory: (agentConfig as any).loopDetection?.maxHistory ?? DEFAULT_AGENT_CONFIG.loopDetection.maxHistory,
            maxExactRepeats: (agentConfig as any).loopDetection?.maxExactRepeats ?? DEFAULT_AGENT_CONFIG.loopDetection.maxExactRepeats,
            maxSameTargetRepeats: (agentConfig as any).loopDetection?.maxSameTargetRepeats ?? DEFAULT_AGENT_CONFIG.loopDetection.maxSameTargetRepeats,
        },

        // 忽略目录（从 store 获取）
        ignoredDirectories: (agentConfig as any).ignoredDirectories ?? DEFAULT_AGENT_CONFIG.ignoredDirectories,
    }
}

/**
 * 只读工具列表（可并行执行）
 * 从配置中心动态获取
 */
export const READ_TOOLS: readonly string[] = getReadOnlyTools()

/**
 * 可重试的错误代码
 */
export const RETRYABLE_ERROR_CODES = new Set([
  'RATE_LIMIT',
  'TIMEOUT',
  'NETWORK_ERROR',
  'SERVER_ERROR',
])

/**
 * 可重试的错误模式
 */
export const RETRYABLE_ERROR_PATTERNS = [
  /timeout/i,
  /ECONNRESET/i,
  /ETIMEDOUT/i,
  /ENOTFOUND/i,
  /network/i,
  /temporarily unavailable/i,
  /rate limit/i,
  /429/,
  /503/,
  /502/,
]

/**
 * 判断错误是否可重试
 */
export function isRetryableError(error: string): boolean {
  return RETRYABLE_ERROR_PATTERNS.some(pattern => pattern.test(error))
}

// 循环检测器已移至 ./LoopDetector.ts
