/**
 * Agent 模块统一导出
 */

// 类型（统一来源）
export * from './types'

// Store
export {
    useAgentStore,
    selectCurrentThread,
    selectMessages,
    selectStreamState,
    selectContextItems,
    selectIsStreaming,
    selectIsAwaitingApproval,
} from './store/AgentStore'

// 核心服务
export { AgentService } from './services/AgentService'
export type { LLMCallConfig } from './services/AgentService'

// 工具系统（只导出不与 types 冲突的）
export {
    toolRegistry,
    getToolDefinitions,
    TOOL_DISPLAY_NAMES,
} from './tools'
export { getToolApprovalType, getToolDisplayName } from '@shared/config/agentConfig'

// 其他服务
export { checkpointService } from './services/checkpointService'
export { terminalService } from './services/terminalService'
export { lintService } from './services/lintService'
export { streamingEditService } from './services/streamingEditService'
export { sessionService } from './services/sessionService'
export { rulesService } from './services/rulesService'
export { composerService } from './services/composerService'

// LLM 相关
export { buildContextContent, buildUserContent, calculateContextStats } from './llm/ContextBuilder'
export { buildLLMMessages, compressContext } from './llm/MessageBuilder'

// 工具函数
export { parseXMLToolCalls, parsePartialArgs, generateToolCallId } from './utils/XMLToolParser'
export { MentionParser, SPECIAL_MENTIONS } from './utils/MentionParser'
export type { MentionCandidate, MentionParseResult } from './utils/MentionParser'

// 配置
export { getAgentConfig, isRetryableError } from './utils/AgentConfig'

// Prompts
export { buildSystemPrompt } from './prompts/prompts'
