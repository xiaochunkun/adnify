/**
 * 工具系统类型定义
 * 参考 void 编辑器的 toolsServiceTypes.ts
 */

export type ToolApprovalType = 'edits' | 'terminal' | 'dangerous'

export type ToolStatus =
	| 'pending'      // 等待执行
	| 'awaiting_user' // 等待用户审批
	| 'running'      // 正在执行
	| 'success'      // 执行成功
	| 'error'        // 执行失败
	| 'rejected'     // 用户拒绝

export interface ToolDefinition {
	name: string
	description: string
	approvalType?: ToolApprovalType
	parameters: {
		type: 'object'
		properties: Record<string, {
			type: string
			description: string
			enum?: string[]
		}>
		required?: string[]
	}
}

export interface ToolCallRequest {
	id: string
	name: string
	arguments: Record<string, any>
	status: ToolStatus
	result?: string
	error?: string
	timestamp: number
}

// 分页常量
export const PAGE_SIZE = {
	FILE_CHARS: 50000,      // 单页最大字符数
	DIR_ITEMS: 100,         // 目录列表单页最大项数
	SEARCH_RESULTS: 50,     // 搜索结果单页最大数
}

// Lint 错误类型
export interface LintError {
	code: string
	message: string
	severity: 'error' | 'warning'
	startLine: number
	endLine: number
	file: string
}

// 文件快照（用于检查点）
export interface FileSnapshot {
	path: string
	content: string
	timestamp: number
}

// 检查点
export interface Checkpoint {
	id: string
	type: 'user_message' | 'tool_edit'
	timestamp: number
	snapshots: Record<string, FileSnapshot>
	description: string
}

// Search/Replace Block 格式
export interface SearchReplaceBlock {
	search: string
	replace: string
}

// 目录树节点
export interface DirTreeNode {
	name: string
	path: string
	isDirectory: boolean
	children?: DirTreeNode[]
}

// 持久化终端会话
export interface PersistentTerminal {
	id: string
	name: string
	cwd: string
	isRunning: boolean
	output: string[]
	maxOutputLines: number
	createdAt: number
}

// 终端命令结果
export interface TerminalCommandResult {
	terminalId: string
	output: string
	exitCode?: number
	isComplete: boolean
}

// 流式编辑状态
export interface StreamingEditState {
	filePath: string
	originalContent: string
	currentContent: string
	isComplete: boolean
	startTime: number
}
