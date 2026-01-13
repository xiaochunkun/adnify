/**
 * Agent 核心模块导出
 */

export { Agent } from './Agent'
export { EventBus, type AgentEvent, type EventType } from './EventBus'
export { runLoop } from './loop'
export { createStreamProcessor, type StreamProcessor } from './stream'
export { executeTools, approvalService } from './tools'

export type {
  LLMConfig,
  ExecutionContext,
  ToolExecutionContext,
  LLMCallResult,
  LoopCheckResult,
  CompressionStats,
  ToolExecutionResult,
} from './types'
