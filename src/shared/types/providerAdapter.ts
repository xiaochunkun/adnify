/**
 * Provider Adapter Types
 * 可配置的 LLM Provider 适配器类型定义
 * 支持 JSON/XML/混合格式的工具调用
 */

// ===== 工具定义转换规则 =====

export interface ToolFormatConfig {
    /** 工具包装模式: none=直接输出, function=OpenAI风格, tool=Anthropic风格 */
    wrapMode: 'none' | 'function' | 'tool'
    /** 包装字段名 (如 "function", "tool") */
    wrapField?: string
    /** 参数字段映射 */
    parameterField: 'parameters' | 'input_schema' | 'schema'
    /** 是否需要 type 字段 */
    includeType: boolean
}

// ===== XML 配置 =====

export interface XMLParseConfig {
    /** 工具调用标签名 (如 "tool_call", "function_call") */
    toolCallTag: string
    /** 工具名称来源 ("name"=子元素, "@name"=属性) */
    nameSource: string
    /** 参数标签名 */
    argsTag: string
    /** 参数内部格式 */
    argsFormat: 'json' | 'xml' | 'key-value'
}

// ===== 响应解析规则 =====

export interface ResponseParseConfig {
    /** 响应格式类型 */
    responseFormat: 'json' | 'xml' | 'mixed'

    // === JSON 格式配置 ===
    /** 工具调用的响应路径 */
    toolCallPath?: 'tool_calls' | 'function_call' | 'tool_use' | string
    /** 工具名称路径 (相对于单个工具调用) */
    toolNamePath?: 'function.name' | 'name' | string
    /** 工具参数路径 */
    toolArgsPath?: 'function.arguments' | 'arguments' | 'input' | string
    /** 参数是否已经是对象 (false = 需要 JSON.parse) */
    argsIsObject?: boolean
    /** 工具 ID 路径 */
    toolIdPath?: 'id' | 'index' | string
    /** 是否自动生成 ID (当响应中无 ID 时) */
    autoGenerateId?: boolean

    // === XML 格式配置 ===
    xmlConfig?: XMLParseConfig
}

// ===== 消息格式规则 =====

export interface MessageFormatConfig {
    /** tool 结果消息的角色名 */
    toolResultRole: 'tool' | 'user' | 'function'
    /** tool_call_id 字段名 */
    toolCallIdField: 'tool_call_id' | 'tool_use_id' | string
    /** 是否需要在 user 消息中包装 tool_result (Anthropic 风格) */
    wrapToolResult: boolean
    /** tool_result 包装标签 (用于 wrapToolResult=true) */
    toolResultWrapper?: string
}

// ===== 请求配置 =====

export interface RequestConfig {
    /** 额外的请求参数 (如 reasoning_effort, top_p 等) */
    extraParams?: Record<string, unknown>
    /** 额外的请求头 */
    extraHeaders?: Record<string, string>
    /** max_tokens 参数名 (默认 'max_tokens') */
    maxTokensParam?: string
    /** stream 参数名 (默认 'stream') */
    streamParam?: string
    /** 是否在 Thinking 模式下启用特殊参数 */
    thinkingParams?: Record<string, unknown>
}

// ===== 流式响应配置 =====

export interface StreamConfig {
    /** 增量内容字段路径 (默认 'choices[0].delta.content') */
    deltaContentPath?: string
    /** 增量工具调用字段路径 (默认 'choices[0].delta.tool_calls') */
    deltaToolCallsPath?: string
    /** 推理/思考字段名 (如 'reasoning', 'thinking') */
    reasoningField?: string
    /** 字段映射 (用于不同厂商的字段名差异) */
    fieldMappings?: Record<string, string>
}

// ===== 完整的 Provider 适配器配置 =====

export interface ProviderAdapterConfig {
    /** 唯一标识符 */
    id: string
    /** 显示名称 */
    name: string
    /** 描述 */
    description?: string
    /** 基于哪个内置适配器继承默认值 */
    extendsFrom?: 'openai' | 'anthropic' | 'gemini'
    /** 是否为内置适配器 (不可删除) */
    isBuiltin?: boolean

    /** 工具定义格式配置 */
    toolFormat: ToolFormatConfig
    /** 响应解析配置 */
    responseParse: ResponseParseConfig
    /** 消息格式配置 */
    messageFormat: MessageFormatConfig
    /** 请求配置 (可选) */
    requestConfig?: RequestConfig
    /** 流式响应配置 (可选) */
    streamConfig?: StreamConfig

    /** @deprecated 使用 requestConfig.extraHeaders */
    extraHeaders?: Record<string, string>
    /** @deprecated 使用 requestConfig.extraParams */
    extraParams?: Record<string, unknown>
}

// ===== 内置适配器 ID =====

export type BuiltinAdapterId = 'openai' | 'anthropic' | 'qwen' | 'glm' | 'deepseek' | 'xml-generic' | 'mixed'

// ===== 辅助函数类型 =====

export interface AdapterHelpers {
    /** 从对象中按路径获取值 */
    getByPath: (obj: unknown, path: string) => unknown
    /** 解析 XML 工具调用 */
    parseXMLToolCalls: (content: string, config: XMLParseConfig) => ParsedToolCall[]
    /** 生成唯一工具调用 ID */
    generateToolCallId: () => string
}

export interface ParsedToolCall {
    id: string
    name: string
    arguments: Record<string, unknown>
}
