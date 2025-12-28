/**
 * Agent 配置中心
 * 
 * 将所有硬编码值外部化，支持运行时配置
 * 
 * 配置优先级：
 * 1. 用户配置 (config.json 或 UI 设置)
 * 2. 项目配置 (.adnify/agent.json)
 * 3. 默认配置 (本文件)
 */

// ============================================
// Agent 运行时配置
// ============================================

export interface AgentRuntimeConfig {
    // 循环控制
    maxToolLoops: number
    maxHistoryMessages: number

    // 上下文限制
    maxToolResultChars: number
    maxFileContentChars: number
    maxTotalContextChars: number
    maxSingleFileChars: number
    maxContextFiles: number
    maxSemanticResults: number
    maxTerminalChars: number

    // 重试配置
    maxRetries: number
    retryDelayMs: number
    retryBackoffMultiplier: number

    // 工具执行
    toolTimeoutMs: number
    enableAutoFix: boolean

    // 上下文压缩
    contextCompressThreshold: number
    keepRecentTurns: number

    // 循环检测
    loopDetection: {
        maxHistory: number
        maxExactRepeats: number
        maxSameTargetRepeats: number
    }

    // 目录忽略列表
    ignoredDirectories: string[]
}

export const DEFAULT_AGENT_CONFIG: AgentRuntimeConfig = {
    maxToolLoops: 30,
    maxHistoryMessages: 60,
    maxToolResultChars: 10000,
    maxFileContentChars: 15000,
    maxTotalContextChars: 60000,
    maxSingleFileChars: 6000,
    maxContextFiles: 6,
    maxSemanticResults: 5,
    maxTerminalChars: 3000,
    maxRetries: 3,
    retryDelayMs: 1000,
    retryBackoffMultiplier: 1.5,
    toolTimeoutMs: 60000,
    enableAutoFix: true,
    contextCompressThreshold: 40000,
    keepRecentTurns: 3,
    loopDetection: {
        maxHistory: 15,
        maxExactRepeats: 2,
        maxSameTargetRepeats: 3,
    },
    ignoredDirectories: [
        'node_modules', '.git', 'dist', 'build', '.next',
        '__pycache__', '.venv', 'venv', '.cache', 'coverage',
        '.nyc_output', 'tmp', 'temp', '.idea', '.vscode',
    ],
}
