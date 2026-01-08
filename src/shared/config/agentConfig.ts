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
    maxContextTokens: number
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
    // 核心执行限制
    maxToolLoops: 20,                    // 从 30 降低到 20，提供更快的反馈
    maxHistoryMessages: 60,

    // 上下文大小限制（字符数）
    maxToolResultChars: 15000,           // 从 10000 提升到 15000，保留更多上下文
    maxFileContentChars: 20000,          // 从 15000 提升到 20000
    maxTotalContextChars: 80000,         // 从 60000 提升到 80000
    maxContextTokens: 128000,
    maxSingleFileChars: 8000,            // 从 6000 提升到 8000
    maxContextFiles: 8,                  // 从 6 提升到 8
    maxSemanticResults: 5,
    maxTerminalChars: 5000,              // 从 3000 提升到 5000

    // 重试配置
    maxRetries: 3,
    retryDelayMs: 1000,
    retryBackoffMultiplier: 1.5,

    // 工具执行
    toolTimeoutMs: 60000,
    enableAutoFix: true,

    // 上下文压缩
    contextCompressThreshold: 60000,     // 从 40000 提升到 60000，减少压缩频率
    keepRecentTurns: 4,                  // 从 3 提升到 4，保留更多最近对话

    // 循环检测阈值
    loopDetection: {
        maxHistory: 20,                  // 从 15 提升到 20
        maxExactRepeats: 4,              // 关键优化：从 2 提升到 4，减少误判
        maxSameTargetRepeats: 5,         // 从 3 提升到 5
    },

    // 目录排除列表
    ignoredDirectories: [
        'node_modules', '.git', 'dist', 'build', '.next',
        '__pycache__', '.venv', 'venv', '.cache', 'coverage',
        '.nyc_output', 'tmp', 'temp', '.idea', '.vscode',
    ],
}
