/**
 * 上下文管理模块
 */

// 压缩模块
export {
  pruneMessages,
  getCompressionLevel,
  isOverflow,
  estimateTokens,
  estimateTotalTokens,
  getMessageContent,
  COMPRESSION_LEVEL_NAMES,
  getPruneMinimum,
  getPruneProtect,
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