/**
 * 增强版工具系统
 * 参考 void 编辑器的 toolsService.ts
 */

import {
	ToolDefinition,
	ToolApprovalType,
	PAGE_SIZE,
	SearchReplaceBlock,
	DirTreeNode,
} from './toolTypes'
import { terminalService } from './terminalService'
import { lintService } from './lintService'

// 需要用户审批的工具
export const APPROVAL_REQUIRED: Record<string, ToolApprovalType> = {
	write_file: 'edits',
	edit_file: 'edits',
	create_file_or_folder: 'edits',
	delete_file_or_folder: 'dangerous',
	run_command: 'terminal',
	run_in_terminal: 'terminal',
	open_terminal: 'terminal',
}

// 完整的工具定义
export const AGENT_TOOLS: ToolDefinition[] = [
	// ===== 读取类工具 =====
	{
		name: 'read_file',
		description: 'Read file contents with optional line range and pagination for large files',
		parameters: {
			type: 'object',
			properties: {
				path: { type: 'string', description: 'Absolute path to the file' },
				start_line: { type: 'number', description: 'Starting line number (1-indexed, optional)' },
				end_line: { type: 'number', description: 'Ending line number (optional)' },
				page: { type: 'number', description: 'Page number for large files (default: 1)' },
			},
			required: ['path'],
		},
	},
	{
		name: 'list_directory',
		description: 'List files and folders in a directory with pagination',
		parameters: {
			type: 'object',
			properties: {
				path: { type: 'string', description: 'Absolute path to the directory' },
				page: { type: 'number', description: 'Page number (default: 1)' },
			},
			required: ['path'],
		},
	},
	{
		name: 'get_dir_tree',
		description: 'Get recursive directory tree structure (max depth: 3)',
		parameters: {
			type: 'object',
			properties: {
				path: { type: 'string', description: 'Root directory path' },
				max_depth: { type: 'number', description: 'Maximum depth (default: 3, max: 5)' },
			},
			required: ['path'],
		},
	},
	{
		name: 'search_files',
		description: 'Search for text pattern in files within a directory',
		parameters: {
			type: 'object',
			properties: {
				path: { type: 'string', description: 'Directory to search in' },
				pattern: { type: 'string', description: 'Text or regex pattern to search' },
				is_regex: { type: 'boolean', description: 'Treat pattern as regex (default: false)' },
				file_pattern: { type: 'string', description: 'File name pattern filter (e.g., "*.ts")' },
				page: { type: 'number', description: 'Page number (default: 1)' },
			},
			required: ['path', 'pattern'],
		},
	},
	{
		name: 'search_in_file',
		description: 'Search for pattern within a specific file, returns matching line numbers',
		parameters: {
			type: 'object',
			properties: {
				path: { type: 'string', description: 'File path to search in' },
				pattern: { type: 'string', description: 'Text or regex pattern' },
				is_regex: { type: 'boolean', description: 'Treat pattern as regex (default: false)' },
			},
			required: ['path', 'pattern'],
		},
	},

	// ===== 编辑类工具 =====
	{
		name: 'edit_file',
		description: 'Edit file using search/replace blocks. More precise than rewriting entire file. Format: <<<SEARCH\\nold_code\\n===\\nnew_code\\n>>>',
		approvalType: 'edits',
		parameters: {
			type: 'object',
			properties: {
				path: { type: 'string', description: 'File path to edit' },
				search_replace_blocks: {
					type: 'string',
					description: 'Search/replace blocks in format: <<<SEARCH\\nold_code\\n===\\nnew_code\\n>>>',
				},
			},
			required: ['path', 'search_replace_blocks'],
		},
	},
	{
		name: 'write_file',
		description: 'Write or overwrite entire file content. Use edit_file for partial changes.',
		approvalType: 'edits',
		parameters: {
			type: 'object',
			properties: {
				path: { type: 'string', description: 'File path to write' },
				content: { type: 'string', description: 'Complete file content' },
			},
			required: ['path', 'content'],
		},
	},
	{
		name: 'create_file_or_folder',
		description: 'Create a new file or folder. Path ending with / creates folder.',
		approvalType: 'edits',
		parameters: {
			type: 'object',
			properties: {
				path: { type: 'string', description: 'Path to create (end with / for folder)' },
				content: { type: 'string', description: 'Initial content for files (optional)' },
			},
			required: ['path'],
		},
	},
	{
		name: 'delete_file_or_folder',
		description: 'Delete a file or folder',
		approvalType: 'dangerous',
		parameters: {
			type: 'object',
			properties: {
				path: { type: 'string', description: 'Path to delete' },
				recursive: { type: 'boolean', description: 'Delete folder recursively (default: false)' },
			},
			required: ['path'],
		},
	},

	// ===== 终端工具 =====
	{
		name: 'run_command',
		description: 'Execute a shell command and wait for completion. For long-running commands, use open_terminal + run_in_terminal.',
		approvalType: 'terminal',
		parameters: {
			type: 'object',
			properties: {
				command: { type: 'string', description: 'Shell command to execute' },
				cwd: { type: 'string', description: 'Working directory (optional)' },
				timeout: { type: 'number', description: 'Timeout in seconds (default: 30)' },
			},
			required: ['command'],
		},
	},
	{
		name: 'open_terminal',
		description: 'Open a persistent terminal session. Returns terminal ID for use with run_in_terminal.',
		approvalType: 'terminal',
		parameters: {
			type: 'object',
			properties: {
				name: { type: 'string', description: 'Terminal name (e.g., "dev-server", "build")' },
				cwd: { type: 'string', description: 'Working directory (optional)' },
			},
			required: ['name'],
		},
	},
	{
		name: 'run_in_terminal',
		description: 'Run command in a persistent terminal. Use for long-running processes like dev servers.',
		approvalType: 'terminal',
		parameters: {
			type: 'object',
			properties: {
				terminal_id: { type: 'string', description: 'Terminal ID from open_terminal' },
				command: { type: 'string', description: 'Command to run' },
				wait: { type: 'boolean', description: 'Wait for completion (default: false for long-running)' },
			},
			required: ['terminal_id', 'command'],
		},
	},
	{
		name: 'get_terminal_output',
		description: 'Get recent output from a persistent terminal.',
		parameters: {
			type: 'object',
			properties: {
				terminal_id: { type: 'string', description: 'Terminal ID' },
				lines: { type: 'number', description: 'Number of recent lines (default: 50)' },
			},
			required: ['terminal_id'],
		},
	},
	{
		name: 'list_terminals',
		description: 'List all open persistent terminals.',
		parameters: {
			type: 'object',
			properties: {},
			required: [],
		},
	},

	// ===== Lint 工具 =====
	{
		name: 'get_lint_errors',
		description: 'Get lint/compile errors for a file. Supports TypeScript, JavaScript, Python.',
		parameters: {
			type: 'object',
			properties: {
				path: { type: 'string', description: 'File path to check' },
				refresh: { type: 'boolean', description: 'Force refresh (ignore cache)' },
			},
			required: ['path'],
		},
	},
]

export function getTools(): ToolDefinition[] {
	return AGENT_TOOLS
}

export function getToolApprovalType(toolName: string): ToolApprovalType | undefined {
	return APPROVAL_REQUIRED[toolName]
}

// ===== 工具执行函数 =====

/**
 * 解析 search/replace blocks
 */
export function parseSearchReplaceBlocks(blocksStr: string): SearchReplaceBlock[] {
	const blocks: SearchReplaceBlock[] = []
	// Robust regex: allows optional whitespace/newline after === (handles missing newline from LLM)
	const regex = /<<<SEARCH\n([\s\S]*?)\n===(?:[ \t]*\n)?([\s\S]*?)\n>>>/g
	let match

	while ((match = regex.exec(blocksStr)) !== null) {
		blocks.push({
			search: match[1],
			replace: match[2],
		})
	}

	return blocks
}

/**
 * 应用 search/replace blocks 到文件内容
 */
export function applySearchReplaceBlocks(content: string, blocks: SearchReplaceBlock[]): {
	newContent: string
	appliedCount: number
	errors: string[]
} {
	let newContent = content
	let appliedCount = 0
	const errors: string[] = []

	for (const block of blocks) {
		if (newContent.includes(block.search)) {
			newContent = newContent.replace(block.search, block.replace)
			appliedCount++
		} else {
			// 尝试模糊匹配（忽略空白差异）
			const normalizedSearch = block.search.replace(/\s+/g, ' ').trim()
			const normalizedContent = newContent.replace(/\s+/g, ' ')

			if (normalizedContent.includes(normalizedSearch)) {
				// 找到原始位置并替换
				const lines = newContent.split('\n')
				const searchLines = block.search.split('\n')
				let found = false

				for (let i = 0; i <= lines.length - searchLines.length; i++) {
					const slice = lines.slice(i, i + searchLines.length).join('\n')
					if (slice.replace(/\s+/g, ' ').trim() === normalizedSearch) {
						lines.splice(i, searchLines.length, ...block.replace.split('\n'))
						newContent = lines.join('\n')
						appliedCount++
						found = true
						break
					}
				}

				if (!found) {
					errors.push(`Could not find exact match for search block: "${block.search.slice(0, 50)}..."`)
				}
			} else {
				errors.push(`Search block not found: "${block.search.slice(0, 50)}..."`)
			}
		}
	}

	return { newContent, appliedCount, errors }
}

/**
 * 构建目录树
 */
async function buildDirTree(
	dirPath: string,
	maxDepth: number,
	currentDepth: number = 0
): Promise<DirTreeNode[]> {
	if (currentDepth >= maxDepth) return []

	const items = await window.electronAPI.readDir(dirPath)
	if (!items) return []

	const nodes: DirTreeNode[] = []

	for (const item of items) {
		// 跳过隐藏文件和 node_modules
		if (item.name.startsWith('.') || item.name === 'node_modules') continue

		const node: DirTreeNode = {
			name: item.name,
			path: item.path,
			isDirectory: item.isDirectory,
		}

		if (item.isDirectory && currentDepth < maxDepth - 1) {
			node.children = await buildDirTree(item.path, maxDepth, currentDepth + 1)
		}

		nodes.push(node)
	}

	return nodes.sort((a, b) => {
		// 文件夹优先
		if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
		return a.name.localeCompare(b.name)
	})
}

/**
 * 格式化目录树为字符串
 */
function formatDirTree(nodes: DirTreeNode[], prefix: string = ''): string {
	let result = ''

	for (let i = 0; i < nodes.length; i++) {
		const node = nodes[i]
		const isLast = i === nodes.length - 1
		const connector = isLast ? '└── ' : '├── '
		const icon = node.isDirectory ? '📁 ' : '📄 '

		result += `${prefix}${connector}${icon}${node.name}\n`

		if (node.children && node.children.length > 0) {
			const childPrefix = prefix + (isLast ? '    ' : '│   ')
			result += formatDirTree(node.children, childPrefix)
		}
	}

	return result
}

/**
 * 执行工具调用
 */
export async function executeToolCall(
	toolName: string,
	args: Record<string, unknown>,
    workspacePath?: string | null
): Promise<string> {
	// Helper to safely get string args
	const getString = (key: string): string => args[key] as string
	const getNumber = (key: string, defaultVal?: number): number => {
		const val = args[key]
		return typeof val === 'number' ? val : (defaultVal ?? 0)
	}
	const getBoolean = (key: string): boolean => Boolean(args[key])

    // Helper to resolve paths
    const resolvePath = (p: string): string => {
        if (!p) return ''
        // If absolute path (simple check for unix/win), return it
        if (p.startsWith('/') || p.match(/^[a-zA-Z]:/)) return p
        // If workspace set, join
        if (workspacePath) {
            // Simple join handling, assuming forward slashes usually from LLM
            const sep = workspacePath.includes('\\') ? '\\' : '/'
            return `${workspacePath}${sep}${p}`
        }
        return p
    }

	switch (toolName) {
		// ===== 读取类 =====
		case 'read_file': {
			const path = resolvePath(getString('path'))
			const content = await window.electronAPI.readFile(path)
			if (content === null) {
				throw new Error(`File not found: ${path}`)
			}

			const lines = content.split('\n')
			const totalLines = lines.length
			const totalChars = content.length

			// 处理行范围
			const startLine = args.start_line ? Math.max(1, getNumber('start_line')) : 1
			const endLine = args.end_line ? Math.min(totalLines, getNumber('end_line')) : totalLines

			let selectedContent = lines.slice(startLine - 1, endLine).join('\n')

			// 分页处理
			const page = getNumber('page', 1)
			const startIdx = (page - 1) * PAGE_SIZE.FILE_CHARS
			const endIdx = page * PAGE_SIZE.FILE_CHARS
			const hasNextPage = selectedContent.length > endIdx

			selectedContent = selectedContent.slice(startIdx, endIdx)

			let result = `File: ${path}\n`
			result += `Lines ${startLine}-${endLine} of ${totalLines} (${totalChars} chars total)\n`
			result += '```\n' + selectedContent + '\n```'

			if (hasNextPage) {
				result += `\n\n(More content on page ${page + 1}...)`
			}

			return result
		}

		case 'list_directory': {
			const path = resolvePath(getString('path'))
			const items = await window.electronAPI.readDir(path)
			if (!items || items.length === 0) {
				return `Directory is empty or does not exist: ${path}`
			}

			const page = getNumber('page', 1)
			const startIdx = (page - 1) * PAGE_SIZE.DIR_ITEMS
			const endIdx = page * PAGE_SIZE.DIR_ITEMS
			const pageItems = items.slice(startIdx, endIdx)
			const hasNextPage = items.length > endIdx

			const formatted = pageItems.map(item =>
				`${item.isDirectory ? '📁' : '📄'} ${item.name}`
			).join('\n')

			let result = `Contents of ${path} (${items.length} items):\n${formatted}`

			if (hasNextPage) {
				result += `\n\n(${items.length - endIdx} more items on page ${page + 1}...)`
			}

			return result
		}

		case 'get_dir_tree': {
			const path = resolvePath(getString('path'))
			const maxDepth = Math.min(getNumber('max_depth', 3), 5)
			const tree = await buildDirTree(path, maxDepth)

			if (tree.length === 0) {
				return `Directory is empty or does not exist: ${path}`
			}

			const formatted = formatDirTree(tree)
			return `Directory tree of ${path}:\n${formatted}`
		}

		case 'search_files': {
			const path = resolvePath(getString('path'))
			const pattern = getString('pattern')
			const filePatternStr = args.file_pattern as string | undefined
			const isRegex = getBoolean('is_regex')
			
			const items = await window.electronAPI.readDir(path)
			if (!items) return `Directory not found: ${path}`

			const results: { file: string; matches: { line: number; content: string }[] }[] = []
			const regexPattern = isRegex ? new RegExp(pattern, 'gi') : null
			const filePattern = filePatternStr ? new RegExp(
				filePatternStr.replace(/\*/g, '.*').replace(/\?/g, '.'),
				'i'
			) : null

			for (const item of items) {
				if (item.isDirectory) continue
				if (filePattern && !filePattern.test(item.name)) continue

				const content = await window.electronAPI.readFile(item.path)
				if (!content) continue

				const lines = content.split('\n')
				const matches: { line: number; content: string }[] = []

				for (let i = 0; i < lines.length; i++) {
					const line = lines[i]
					const isMatch = regexPattern
						? regexPattern.test(line)
						: line.toLowerCase().includes(pattern.toLowerCase())

					if (isMatch) {
						matches.push({
							line: i + 1,
							content: line.trim().slice(0, 100),
						})
					}

					// 重置 regex lastIndex
					if (regexPattern) regexPattern.lastIndex = 0
				}

				if (matches.length > 0) {
					results.push({ file: item.name, matches: matches.slice(0, 5) })
				}
			}

			if (results.length === 0) {
				return `No matches found for "${pattern}" in ${path}`
			}

			// 分页
			const searchPage = getNumber('page', 1)
			const searchStartIdx = (searchPage - 1) * PAGE_SIZE.SEARCH_RESULTS
			const searchEndIdx = searchPage * PAGE_SIZE.SEARCH_RESULTS
			const pageResults = results.slice(searchStartIdx, searchEndIdx)

			let output = `Found ${results.length} files with matches:\n\n`
			for (const r of pageResults) {
				output += `📄 ${r.file}:\n`
				for (const m of r.matches) {
					output += `  Line ${m.line}: ${m.content}\n`
				}
				output += '\n'
			}

			if (results.length > searchEndIdx) {
				output += `(${results.length - searchEndIdx} more files on page ${searchPage + 1}...)`
			}

			return output
		}

		case 'search_in_file': {
			const filePath = resolvePath(getString('path'))
			const searchPattern = getString('pattern')
			const isSearchRegex = getBoolean('is_regex')
			
			const content = await window.electronAPI.readFile(filePath)
			if (content === null) {
				throw new Error(`File not found: ${filePath}`)
			}

			const lines = content.split('\n')
			const searchRegex = isSearchRegex ? new RegExp(searchPattern, 'gi') : null
			const matches: { line: number; content: string }[] = []

			for (let i = 0; i < lines.length; i++) {
				const line = lines[i]
				const isMatch = searchRegex
					? searchRegex.test(line)
					: line.includes(searchPattern)

				if (isMatch) {
					matches.push({
						line: i + 1,
						content: line.trim().slice(0, 100),
					})
				}

				if (searchRegex) searchRegex.lastIndex = 0
			}

			if (matches.length === 0) {
				return `No matches found for "${searchPattern}" in ${filePath}`
			}

			let output = `Found ${matches.length} matches in ${filePath}:\n\n`
			for (const m of matches.slice(0, 50)) {
				output += `Line ${m.line}: ${m.content}\n`
			}

			if (matches.length > 50) {
				output += `\n(${matches.length - 50} more matches...)`
			}

			return output
		}

		// ===== 编辑类 =====
		case 'edit_file': {
			const editPath = resolvePath(getString('path'))
			const content = await window.electronAPI.readFile(editPath)
			if (content === null) {
				throw new Error(`File not found: ${editPath}`)
			}

			const blocks = parseSearchReplaceBlocks(getString('search_replace_blocks'))
			if (blocks.length === 0) {
				throw new Error('No valid search/replace blocks found. Use format: <<<SEARCH\\nold_code\\n===\\nnew_code\\n>>>')
			}

			const { newContent, appliedCount, errors } = applySearchReplaceBlocks(content, blocks)

			if (appliedCount === 0) {
				throw new Error(`No changes applied. Errors:\n${errors.join('\n')}`)
			}

			const success = await window.electronAPI.writeFile(editPath, newContent)
			if (!success) {
				throw new Error(`Failed to write file: ${editPath}`)
			}

			let result = `✅ Applied ${appliedCount}/${blocks.length} changes to ${editPath}`
			if (errors.length > 0) {
				result += `\n⚠️ Warnings:\n${errors.join('\n')}`
			}

			return result
		}

		case 'write_file': {
			const writePath = resolvePath(getString('path'))
			const writeContent = getString('content')
			const success = await window.electronAPI.writeFile(writePath, writeContent)
			if (!success) {
				throw new Error(`Failed to write file: ${writePath}`)
			}
			return `✅ Successfully wrote ${writeContent.length} chars to ${writePath}`
		}

		case 'create_file_or_folder': {
			const createPath = resolvePath(getString('path'))
			const isFolder = createPath.endsWith('/') || createPath.endsWith('\\')

			if (isFolder) {
				const success = await window.electronAPI.mkdir(createPath)
				if (!success) throw new Error(`Failed to create folder: ${createPath}`)
				return `✅ Created folder: ${createPath}`
			} else {
				const createContent = (args.content as string) || ''
				const success = await window.electronAPI.writeFile(createPath, createContent)
				if (!success) throw new Error(`Failed to create file: ${createPath}`)
				return `✅ Created file: ${createPath}`
			}
		}

		case 'delete_file_or_folder': {
			const deletePath = resolvePath(getString('path'))
			const success = await window.electronAPI.deleteFile(deletePath)
			if (!success) {
				throw new Error(`Failed to delete: ${deletePath}`)
			}
			return `✅ Deleted: ${deletePath}`
		}

		// ===== 终端 =====
		case 'run_command': {
			const command = getString('command')
			const cwd = args.cwd as string | undefined
			const timeoutSec = getNumber('timeout', 30)
			const timeout = timeoutSec * 1000
			const result = await Promise.race([
				window.electronAPI.executeCommand(command, cwd, timeout),
				new Promise<never>((_, reject) =>
					setTimeout(() => reject(new Error(`Command timed out after ${timeoutSec}s`)), timeout + 1000)
				),
			])

			let output = `$ ${command}\n`
			if (cwd) output += `(cwd: ${cwd})\n`
			output += `Exit code: ${result.exitCode}\n\n`

			if (result.output) output += result.output
			if (result.errorOutput) output += `\nStderr:\n${result.errorOutput}`
			if (!result.output && !result.errorOutput) output += '(No output)'

			return output
		}

		case 'open_terminal': {
			const termName = getString('name')
			const termCwd = args.cwd as string | undefined
			const terminal = await terminalService.openTerminal(termName, termCwd)
			return `✅ Opened terminal "${termName}"\nTerminal ID: ${terminal.id}\nWorking directory: ${terminal.cwd}`
		}

		case 'run_in_terminal': {
			const terminalId = getString('terminal_id')
			const termCommand = getString('command')
			const wait = args.wait !== undefined ? getBoolean('wait') : false
			const result = await terminalService.runCommand(terminalId, termCommand, wait)

			if (result.isComplete) {
				return `$ ${termCommand}\nExit code: ${result.exitCode}\n\n${result.output}`
			} else {
				return `$ ${termCommand}\nCommand started in background. Use get_terminal_output to check progress.`
			}
		}

		case 'get_terminal_output': {
			const termId = getString('terminal_id')
			const outputLines = getNumber('lines', 50)
			const output = terminalService.getOutput(termId, outputLines)

			if (output.length === 0) {
				return '(No output yet)'
			}

			return output.join('\n')
		}

		case 'list_terminals': {
			const terminals = terminalService.getAllTerminals()

			if (terminals.length === 0) {
				return 'No open terminals.'
			}

			let output = `Open terminals (${terminals.length}):\n\n`
			for (const t of terminals) {
				const status = t.isRunning ? '🟢 Running' : '⚪ Idle'
				output += `• ${t.name} (${t.id.slice(0, 8)}...)\n`
				output += `  Status: ${status}\n`
				output += `  CWD: ${t.cwd}\n`
				output += `  Output lines: ${t.output.length}\n\n`
			}

			return output
		}

		// ===== Lint =====
		case 'get_lint_errors': {
			const lintPath = resolvePath(getString('path'))
			const refresh = getBoolean('refresh')
			const errors = await lintService.getLintErrors(lintPath, refresh)
			return lintService.formatErrors(errors)
		}

		default:
			throw new Error(`Unknown tool: ${toolName}`)
	}
}

// ===== System Prompt =====
// 使用 prompts.ts 中的增强版提示词系统
export { buildSystemPrompt } from './prompts'
