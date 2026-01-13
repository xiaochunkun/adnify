/**
 * XML 工具调用解析器
 * 从 AgentService 提取的 XML 格式工具调用解析逻辑
 */

import { logger } from '@/renderer/utils/Logger'

// ===== 共享的正则表达式 =====

/** 匹配 function 标签的正则 */
const FUNCTION_TAG_REGEX = /<function[=\s]+["']?([^"'>\s]+)["']?\s*>([\s\S]*?)<\/function>/gi

/** 匹配 parameter 标签的正则 */
const PARAMETER_REGEX = /<parameter[=\s]+["']?([^"'>\s]+)["']?\s*>([\s\S]*?)<\/parameter>/gi

export interface ParsedToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

/**
 * 解析 XML 格式的工具调用
 */
export function parseXMLToolCalls(content: string): ParsedToolCall[] {
    const toolCalls: ParsedToolCall[] = []

    // 匹配 <tool_call>...</tool_call> 块
    const toolCallRegex = /<tool_call>([\s\S]*?)<\/tool_call>/gi
    let toolCallMatch

    while ((toolCallMatch = toolCallRegex.exec(content)) !== null) {
        const toolCallContent = toolCallMatch[1]
        // 重置正则状态
        FUNCTION_TAG_REGEX.lastIndex = 0
        let funcMatch

        while ((funcMatch = FUNCTION_TAG_REGEX.exec(toolCallContent)) !== null) {
            const toolName = funcMatch[1]
            const paramsContent = funcMatch[2]
            const args = parseXMLParameters(paramsContent)

            toolCalls.push({
                id: generateToolCallId('xml'),
                name: toolName,
                arguments: args
            })
        }
    }

    // 支持独立的 <function> 标签
    const standaloneToolCalls = parseStandaloneFunctions(content)
    toolCalls.push(...standaloneToolCalls)

    if (toolCalls.length > 0) {
        logger.tool.debug('Parsed XML tool calls', { count: toolCalls.length })
    }

    return toolCalls
}

/**
 * 解析独立的 <function> 标签
 */
function parseStandaloneFunctions(content: string): ParsedToolCall[] {
    const toolCalls: ParsedToolCall[] = []

    // 收集 tool_call 块的位置范围
    const toolCallRanges: Array<{ start: number; end: number }> = []
    const toolCallBlockRegex = /<tool_call>[\s\S]*?<\/tool_call>/gi
    let blockMatch
    while ((blockMatch = toolCallBlockRegex.exec(content)) !== null) {
        toolCallRanges.push({ start: blockMatch.index, end: blockMatch.index + blockMatch[0].length })
    }

    // 重置正则状态
    FUNCTION_TAG_REGEX.lastIndex = 0
    let standaloneMatch
    while ((standaloneMatch = FUNCTION_TAG_REGEX.exec(content)) !== null) {
        const matchPos = standaloneMatch.index
        const isInsideToolCall = toolCallRanges.some(range => matchPos >= range.start && matchPos < range.end)
        if (isInsideToolCall) continue

        const toolName = standaloneMatch[1]
        const paramsContent = standaloneMatch[2]
        const args = parseXMLParameters(paramsContent)

        toolCalls.push({
            id: generateToolCallId('xml'),
            name: toolName,
            arguments: args
        })
    }

    return toolCalls
}

/**
 * 解析 XML 参数
 */
function parseXMLParameters(paramsContent: string): Record<string, unknown> {
    const args: Record<string, unknown> = {}
    // 重置正则状态
    PARAMETER_REGEX.lastIndex = 0
    let paramMatch

    while ((paramMatch = PARAMETER_REGEX.exec(paramsContent)) !== null) {
        const paramName = paramMatch[1]
        let paramValue: unknown = paramMatch[2].trim()

        try {
            paramValue = JSON.parse(paramValue as string)
        } catch {
            // 保持字符串格式
        }

        args[paramName] = paramValue
    }

    return args
}

/**
 * 生成工具调用 ID
 */
export function generateToolCallId(prefix: string = 'tool'): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}
