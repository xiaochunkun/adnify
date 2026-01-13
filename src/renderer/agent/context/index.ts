/**
 * 上下文管理模块
 */

// 压缩模块
export {
  pruneMessages,
  getCompressionLevel,
  estimateTokens,
  estimateTotalTokens,
  getMessageContent,
  markAssistantCompacted,
  COMPRESSION_LEVEL_NAMES,
  PRUNE_MINIMUM,
  PRUNE_PROTECT,
  type CompactionResult,
  type CompressionLevel,
  type CompressionStats,
} from './compaction'

// 摘要服务
export {
  generateSummary,
  generateHandoffDocument,
  type SummaryResult,
} from './summaryService'

// Handoff 管理
export { buildHandoffContext, buildWelcomeMessage } from './HandoffManager'

// 类型
export type {
  StructuredSummary,
  HandoffDocument,
  FileChangeRecord,
} from './types'
