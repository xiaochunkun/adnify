/**
 * 上下文管理模块
 */

export { contextManager, ContextManager } from './ContextManager'
export type { CompressionStats } from './ContextManager'

export { countTokens, countMessageTokens, countTotalTokens } from './TokenEstimator'
// 兼容旧 API
export { estimateTokens, estimateMessageTokens, estimateTotalTokens } from './TokenEstimator'

export { truncateToolResult, truncateMessage } from './MessageTruncator'
export { scoreMessageGroup, extractDecisionPoints, extractFileChanges } from './ImportanceScorer'
export { generateQuickSummary, generateHandoffDocument, handoffToSystemPrompt, buildSummaryPrompt } from './SummaryGenerator'
export { buildHandoffContext, buildWelcomeMessage } from './HandoffManager'

export type {
  CompressionLevel,
  LevelConfig,
  DecisionPoint,
  FileChangeRecord,
  StructuredSummary,
  HandoffDocument,
  ContextStats,
  OptimizedContext,
  MessageGroup,
} from './types'

export { COMPRESSION_LEVELS } from './types'
