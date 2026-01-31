/**
 * Plan 模式入口
 * 
 * Plan 模式是一个完整的工作流系统：
 * 
 * **阶段 1: 创建工作流**
 * - 交互式需求收集（ask_user 工具）
 * - 工作流文件创建（create_workflow 工具）
 * - 生成两个文件：
 *   - {name}.json - 可执行的工作流定义
 *   - {name}.md - 需求文档
 * 
 * **阶段 2: 执行工作流**
 * - 加载工作流文件
 * - PlanEngine 按节点顺序执行
 * - 可视化显示执行进度
 * - 用户可以暂停/继续/修改
 * 
 * **工作流文件位置**: .adnify/workflows/
 */

// 核心引擎
export { PlanEngine } from './core/PlanEngine'
export { PlanValidator } from './core/PlanValidator'
export { WorkflowManager, workflowManager } from './core/WorkflowManager'

// Agent 工具（供 Agent 调用）
export {
  createWorkflowFile,
  updateWorkflowFile,
  listWorkflowFiles,
} from './tools/agentTools'

// Plan 专属工具注册表
export { planToolRegistry } from './tools/registry'
export type {
  PlanTool,
  ToolParameter,
  PlanToolContext,
  ToolResult,
} from './tools/registry'

// 工作流模板
export {
  WORKFLOW_TEMPLATES,
  getTemplate,
  getAllTemplates,
  getTemplatesByCategory,
  getTemplatesByTag,
  searchTemplates,
  applyTemplateParameters,
  validateTemplateParameters,
  featureDevelopmentTemplate,
  bugFixTemplate,
  refactoringTemplate,
  codeReviewTemplate,
} from './templates'

// 类型定义
export type {
  Workflow,
  WorkflowNode,
  WorkflowEdge,
  WorkflowConfig,
  WorkflowMetadata,
  WorkflowExecution,
  WorkflowTemplate,
  ExecutionContext,
  ExecutionEvent,
  NodeType,
  NodeStatus,
  ExecutionStatus,
  NodeConfig,
  ToolNodeConfig,
  AskNodeConfig,
  DecisionNodeConfig,
  ParallelNodeConfig,
  LoopNodeConfig,
  DelayNodeConfig,
  TransformNodeConfig,
  LLMNodeConfig,
  ValidationResult,
  ValidationError,
  ValidationWarning,
} from './types/workflow'
