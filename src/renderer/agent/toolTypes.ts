/**
 * 工具系统类型定义（兼容层）
 * 新代码请使用 ./types/chatTypes.ts 和 ./types/toolTypes.ts
 */

// 从新类型文件重新导出
export { ToolApprovalType } from './types/chatTypes'

// 保留旧的类型定义供兼容使用
export type ToolStatus =
	| 'pending'      // 等待执行
	| 'awaiting_user' // 等待用户审批
	| 'running'      // 正在执行
	| 'success'      // 执行成功
	| 'error'        // 执行失败
	| 'rejected'     // 用户拒绝

// Lint 错误类型
export interface LintError {
	code: string
	message: string
	severity: 'error' | 'warning'
	startLine: number
	endLine: number
	file: string
}

// 文件快照（用于检查点）- 旧格式
export interface FileSnapshot {
	path: string
	content: string
	timestamp: number
}

// 检查点 - 旧格式
export interface Checkpoint {
	id: string
	type: 'user_message' | 'tool_edit'
	timestamp: number
	snapshots: Record<string, FileSnapshot>
	description: string
}

// 流式编辑状态
export interface StreamingEditState {
	filePath: string
	originalContent: string
	currentContent: string
	isComplete: boolean
	startTime: number
}
