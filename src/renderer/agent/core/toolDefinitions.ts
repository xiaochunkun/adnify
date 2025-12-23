/**
 * 统一工具定义
 * 
 * 将工具的函数调用格式和 Zod Schema 合并到一个地方
 * 
 * 支持多种 LLM 提供商：
 * - OpenAI / Azure OpenAI
 * - Anthropic Claude
 * - Google Gemini  
 * - DeepSeek
 * - Qwen (通义千问)
 * - 其他 OpenAI 兼容提供商
 * 
 * 注意：此处的 TOOL_DEFINITIONS 使用通用的函数调用格式
 * 实际发送到 LLM 时，由 MessageConverter 和 ProviderAdapter 负责转换为对应提供商的格式
 */

import { z } from 'zod'
import { ToolDefinition, ToolApprovalType } from './types'

// ===== 文件操作工具 =====

export const ReadFileSchema = z.object({
    path: z.string().min(1, 'File path is required'),
    start_line: z.number().int().positive().optional(),
    end_line: z.number().int().positive().optional()
}).refine(
    data => !data.start_line || !data.end_line || data.start_line <= data.end_line,
    { message: 'start_line must be <= end_line' }
)

export const ListDirectorySchema = z.object({
    path: z.string().min(1, 'Directory path is required')
})

export const GetDirTreeSchema = z.object({
    path: z.string().min(1, 'Directory path is required'),
    max_depth: z.number().int().min(1).max(10).optional().default(3)
})

export const SearchFilesSchema = z.object({
    path: z.string().min(1, 'Search path is required'),
    pattern: z.string().min(1, 'Search pattern is required'),
    is_regex: z.boolean().optional().default(false),
    file_pattern: z.string().optional()
})

export const ReadMultipleFilesSchema = z.object({
    paths: z.array(z.string().min(1)).min(1, 'At least one file path is required')
})

export const SearchInFileSchema = z.object({
    path: z.string().min(1, 'File path is required'),
    pattern: z.string().min(1, 'Search pattern is required'),
    is_regex: z.boolean().optional().default(false)
})

// ===== 文件编辑工具 =====

export const EditFileSchema = z.object({
    path: z.string().min(1, 'File path is required'),
    search_replace_blocks: z.string().min(1, 'SEARCH/REPLACE blocks are required')
}).refine(
    data => {
        const blocks = data.search_replace_blocks
        const hasSearch = /<{3,}\s*SEARCH/i.test(blocks)
        const hasReplace = />{3,}\s*REPLACE/i.test(blocks)
        return hasSearch && hasReplace
    },
    { message: 'Invalid SEARCH/REPLACE block format' }
)

export const WriteFileSchema = z.object({
    path: z.string().min(1, 'File path is required'),
    content: z.string()
})

export const ReplaceFileContentSchema = z.object({
    path: z.string().min(1, 'File path is required'),
    start_line: z.number().int().positive('Start line must be positive'),
    end_line: z.number().int().positive('End line must be positive'),
    content: z.string()
}).refine(
    data => data.start_line <= data.end_line,
    { message: 'start_line must be <= end_line' }
)

export const CreateFileOrFolderSchema = z.object({
    path: z.string().min(1, 'Path is required'),
    content: z.string().optional()
})

export const DeleteFileOrFolderSchema = z.object({
    path: z.string().min(1, 'Path is required'),
    recursive: z.boolean().optional().default(false)
})

// ===== 终端工具 =====

export const RunCommandSchema = z.object({
    command: z.string().min(1, 'Command is required'),
    cwd: z.string().optional(),
    timeout: z.number().int().positive().max(600).optional().default(30)
})

// ===== 搜索工具 =====

export const CodebaseSearchSchema = z.object({
    query: z.string().min(1, 'Search query is required'),
    top_k: z.number().int().positive().max(50).optional().default(10)
})

// ===== LSP 工具 =====

export const LspLocationSchema = z.object({
    path: z.string().min(1, 'File path is required'),
    line: z.number().int().positive('Line number must be positive (1-indexed)'),
    column: z.number().int().positive('Column number must be positive (1-indexed)')
})

export const GetDocumentSymbolsSchema = z.object({
    path: z.string().min(1, 'File path is required')
})

export const GetLintErrorsSchema = z.object({
    path: z.string().min(1, 'File path is required'),
    refresh: z.boolean().optional().default(false)
})

// ===== 网络工具 =====

export const WebSearchSchema = z.object({
    query: z.string().min(1, 'Search query is required'),
    max_results: z.number().int().positive().max(20).optional().default(5)
})

export const ReadUrlSchema = z.object({
    url: z.string().url('Invalid URL format'),
    timeout: z.number().int().positive().max(120).optional().default(30)
})

// ===== Plan 工具 =====

export const CreatePlanSchema = z.object({
    items: z.array(z.object({
        title: z.string().min(1, 'Title is required'),
        description: z.string().optional()
    })).min(1, 'Plan must have at least one item')
})

export const UpdatePlanSchema = z.object({
    status: z.enum(['active', 'completed', 'failed']).optional(),
    items: z.array(z.object({
        id: z.string(),
        status: z.enum(['pending', 'in_progress', 'completed', 'failed', 'skipped']).optional(),
        title: z.string().optional(),
    })).optional(),
    currentStepId: z.string().nullable().optional()
})

// ===== Schema 映射表 =====

export const toolSchemas: Record<string, z.ZodSchema> = {
    // 文件操作
    read_file: ReadFileSchema,
    list_directory: ListDirectorySchema,
    get_dir_tree: GetDirTreeSchema,
    search_files: SearchFilesSchema,
    read_multiple_files: ReadMultipleFilesSchema,
    search_in_file: SearchInFileSchema,

    // 文件编辑
    edit_file: EditFileSchema,
    write_file: WriteFileSchema,
    replace_file_content: ReplaceFileContentSchema,
    create_file_or_folder: CreateFileOrFolderSchema,
    delete_file_or_folder: DeleteFileOrFolderSchema,

    // 终端
    run_command: RunCommandSchema,

    // 搜索
    codebase_search: CodebaseSearchSchema,

    // LSP
    find_references: LspLocationSchema,
    go_to_definition: LspLocationSchema,
    get_hover_info: LspLocationSchema,
    get_document_symbols: GetDocumentSymbolsSchema,
    get_lint_errors: GetLintErrorsSchema,

    // 网络
    web_search: WebSearchSchema,
    read_url: ReadUrlSchema,

    // Plan
    create_plan: CreatePlanSchema,
    update_plan: UpdatePlanSchema
}

// ===== 通用函数调用格式的工具定义 =====
// 注意：此格式对应 OpenAI/Anthropic/Gemini 等主流提供商的通用结构
// 实际发送时由 ProviderAdapter 根据提供商类型进行转换

export const TOOL_DEFINITIONS: ToolDefinition[] = [
    // 读取类
    {
        name: 'read_file',
        description: 'Read file contents with optional line range.',
        parameters: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'File path' },
                start_line: { type: 'number', description: 'Starting line (1-indexed)' },
                end_line: { type: 'number', description: 'Ending line' },
            },
            required: ['path'],
        },
    },
    {
        name: 'list_directory',
        description: 'List files and folders in a directory.',
        parameters: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'Directory path' },
            },
            required: ['path'],
        },
    },
    {
        name: 'get_dir_tree',
        description: 'Get recursive directory tree structure.',
        parameters: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'Root directory path' },
                max_depth: { type: 'number', description: 'Maximum depth (default: 3)' },
            },
            required: ['path'],
        },
    },
    {
        name: 'search_files',
        description: 'Search for text pattern in files.',
        parameters: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'Directory to search' },
                pattern: { type: 'string', description: 'Search pattern' },
                is_regex: { type: 'boolean', description: 'Use regex' },
                file_pattern: { type: 'string', description: 'File filter (e.g., "*.ts")' },
            },
            required: ['path', 'pattern'],
        },
    },
    {
        name: 'search_in_file',
        description: 'Search for pattern within a specific file. Returns matching line numbers and content.',
        parameters: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'File path to search in' },
                pattern: { type: 'string', description: 'Search pattern' },
                is_regex: { type: 'boolean', description: 'Use regex pattern (default: false)' },
            },
            required: ['path', 'pattern'],
        },
    },
    // 编辑类
    {
        name: 'edit_file',
        description: 'Edit file using SEARCH/REPLACE blocks. Format: <<<<<<< SEARCH\\nold\\n=======\\nnew\\n>>>>>>> REPLACE',
        parameters: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'File path' },
                search_replace_blocks: { type: 'string', description: 'SEARCH/REPLACE blocks' },
            },
            required: ['path', 'search_replace_blocks'],
        },
    },
    {
        name: 'write_file',
        description: 'Write or overwrite entire file content.',
        parameters: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'File path' },
                content: { type: 'string', description: 'File content' },
            },
            required: ['path', 'content'],
        },
    },
    {
        name: 'replace_file_content',
        description: 'Replace a specific range of lines in a file with new content.',
        parameters: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'File path' },
                start_line: { type: 'number', description: 'Start line (1-indexed)' },
                end_line: { type: 'number', description: 'End line (inclusive)' },
                content: { type: 'string', description: 'New content' },
            },
            required: ['path', 'start_line', 'end_line', 'content'],
        },
    },
    {
        name: 'create_file_or_folder',
        description: 'Create a new file or folder. Path ending with / creates folder.',
        parameters: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'Path (end with / for folder)' },
                content: { type: 'string', description: 'Initial content for files' },
            },
            required: ['path'],
        },
    },
    {
        name: 'delete_file_or_folder',
        description: 'Delete a file or folder.',
        approvalType: 'dangerous',
        parameters: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'Path to delete' },
                recursive: { type: 'boolean', description: 'Delete recursively' },
            },
            required: ['path'],
        },
    },
    // 终端类
    {
        name: 'run_command',
        description: 'Execute a shell command.',
        approvalType: 'terminal',
        parameters: {
            type: 'object',
            properties: {
                command: { type: 'string', description: 'Shell command' },
                cwd: { type: 'string', description: 'Working directory' },
                timeout: { type: 'number', description: 'Timeout in seconds (default: 30)' },
            },
            required: ['command'],
        },
    },
    {
        name: 'get_lint_errors',
        description: 'Get lint/compile errors for a file.',
        parameters: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'File path' },
            },
            required: ['path'],
        },
    },
    // 语义搜索类
    {
        name: 'codebase_search',
        description: 'Semantic search across the codebase using AI embeddings. Best for finding code by meaning/intent.',
        parameters: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Natural language search query' },
                top_k: { type: 'number', description: 'Number of results (default: 10)' },
            },
            required: ['query'],
        },
    },
    // LSP 工具类
    {
        name: 'find_references',
        description: 'Find all references to a symbol at a specific location.',
        parameters: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'File path' },
                line: { type: 'number', description: 'Line number (1-indexed)' },
                column: { type: 'number', description: 'Column number (1-indexed)' },
            },
            required: ['path', 'line', 'column'],
        },
    },
    {
        name: 'go_to_definition',
        description: 'Get the definition location of a symbol.',
        parameters: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'File path' },
                line: { type: 'number', description: 'Line number (1-indexed)' },
                column: { type: 'number', description: 'Column number (1-indexed)' },
            },
            required: ['path', 'line', 'column'],
        },
    },
    {
        name: 'get_hover_info',
        description: 'Get type information and documentation for a symbol.',
        parameters: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'File path' },
                line: { type: 'number', description: 'Line number (1-indexed)' },
                column: { type: 'number', description: 'Column number (1-indexed)' },
            },
            required: ['path', 'line', 'column'],
        },
    },
    {
        name: 'get_document_symbols',
        description: 'Get all symbols (functions, classes, variables) in a file.',
        parameters: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'File path' },
            },
            required: ['path'],
        },
    },
    // 批量操作
    {
        name: 'read_multiple_files',
        description: 'Read multiple files at once. More efficient than multiple read_file calls.',
        parameters: {
            type: 'object',
            properties: {
                paths: { type: 'array', description: 'Array of file paths to read' },
            },
            required: ['paths'],
        },
    },
    // 网络工具
    {
        name: 'web_search',
        description: 'Search the web for information. Returns top results with titles, URLs, and snippets.',
        parameters: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Search query' },
                max_results: { type: 'number', description: 'Maximum number of results (default: 5)' },
            },
            required: ['query'],
        },
    },
    {
        name: 'read_url',
        description: 'Fetch and read content from a URL. Returns the page title and text content.',
        parameters: {
            type: 'object',
            properties: {
                url: { type: 'string', description: 'URL to fetch content from' },
                timeout: { type: 'number', description: 'Timeout in seconds (default: 30)' },
            },
            required: ['url'],
        },
    },
    // Plan 工具
    {
        name: 'create_plan',
        description: 'Create a new execution plan with a list of steps.',
        parameters: {
            type: 'object',
            properties: {
                items: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            title: { type: 'string' },
                            description: { type: 'string' }
                        },
                        required: ['title']
                    }
                }
            },
            required: ['items']
        }
    },
    {
        name: 'update_plan',
        description: 'Update the current plan status or specific items.',
        parameters: {
            type: 'object',
            properties: {
                status: { type: 'string', enum: ['active', 'completed', 'failed'] },
                items: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            id: { type: 'string' },
                            status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'failed', 'skipped'] },
                            title: { type: 'string' }
                        },
                        required: ['id']
                    }
                },
                currentStepId: { type: 'string' }
            },
            required: []
        }
    },
]

// ===== 工具审批类型映射 =====

const APPROVAL_TYPE_MAP: Record<string, ToolApprovalType> = {
    delete_file_or_folder: 'dangerous',
    run_command: 'terminal',
}

// ===== 辅助函数 =====

export function getToolApprovalType(toolName: string): ToolApprovalType | undefined {
    return APPROVAL_TYPE_MAP[toolName]
}

// Plan 工具名称列表
const PLAN_TOOLS = ['create_plan', 'update_plan']

export function getToolDefinitions(isPlanMode: boolean = false): ToolDefinition[] {
    // Plan 工具只在 Plan 模式下可用
    if (isPlanMode) {
        return TOOL_DEFINITIONS
    }
    return TOOL_DEFINITIONS.filter(tool => !PLAN_TOOLS.includes(tool.name))
}

export function getToolSchema(toolName: string): z.ZodSchema | undefined {
    return toolSchemas[toolName]
}

// ===== 验证函数 =====

export interface ValidationResult<T = unknown> {
    success: boolean
    data?: T
    error?: string
    hint?: string
}

export function validateToolArgs<T = unknown>(
    toolName: string,
    args: unknown
): ValidationResult<T> {
    const schema = toolSchemas[toolName]

    if (!schema) {
        return {
            success: false,
            error: `Unknown tool: ${toolName}`,
            hint: `Available tools: ${Object.keys(toolSchemas).join(', ')}`
        }
    }

    const result = schema.safeParse(args)

    if (result.success) {
        return {
            success: true,
            data: result.data as T
        }
    }

    const formattedErrors = result.error.issues
        .map(issue => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ')

    return {
        success: false,
        error: `Invalid parameters: ${formattedErrors}`,
        hint: `Check required fields and parameter types for '${toolName}'`
    }
}

export function formatValidationError(
    toolName: string,
    result: ValidationResult
): string {
    if (result.success) return ''

    return `❌ Tool call '${toolName}' failed validation.

**Error**: ${result.error}

**How to fix**: ${result.hint || 'Check the tool parameters and try again.'}

**Expected format**: Call '${toolName}' with valid parameters as defined in the tool schema.`
}

// ===== 工具显示名称 =====

export const TOOL_DISPLAY_NAMES: Record<string, string> = {
    read_file: 'Read',
    list_directory: 'List',
    get_dir_tree: 'Tree',
    search_files: 'Search',
    search_in_file: 'Search in File',
    edit_file: 'Edit',
    replace_file_content: 'Replace',
    write_file: 'Write',
    create_file_or_folder: 'Create',
    delete_file_or_folder: 'Delete',
    run_command: 'Run',
    get_lint_errors: 'Lint',
    codebase_search: 'Semantic Search',
    find_references: 'References',
    go_to_definition: 'Definition',
    get_hover_info: 'Hover',
    get_document_symbols: 'Symbols',
    read_multiple_files: 'Read Multiple',
    web_search: 'Web Search',
    read_url: 'Read URL',
    create_plan: 'Create Plan',
    update_plan: 'Update Plan',
}
