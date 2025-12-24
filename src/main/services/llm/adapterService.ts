/**
 * Provider Adapter Service
 * 管理内置和自定义的 Provider 适配器
 * 提供工具格式转换和响应解析功能
 */

import {
    ProviderAdapterConfig,
    ResponseParseConfig,
    XMLParseConfig,
    ParsedToolCall,
    BuiltinAdapterId
} from '../../../shared/types/providerAdapter'
import type { ToolDefinition, LLMMessage } from './types'

// ===== 内置适配器预设 =====

const BUILTIN_ADAPTERS: Record<BuiltinAdapterId, ProviderAdapterConfig> = {
    // OpenAI 标准格式
    openai: {
        id: 'openai',
        name: 'OpenAI',
        description: 'OpenAI GPT models (standard format)',
        isBuiltin: true,
        toolFormat: {
            wrapMode: 'function',
            wrapField: 'function',
            parameterField: 'parameters',
            includeType: true
        },
        responseParse: {
            responseFormat: 'json',
            toolCallPath: 'tool_calls',
            toolNamePath: 'function.name',
            toolArgsPath: 'function.arguments',
            argsIsObject: false,
            toolIdPath: 'id',
            autoGenerateId: false
        },
        messageFormat: {
            toolResultRole: 'tool',
            toolCallIdField: 'tool_call_id',
            wrapToolResult: false
        }
    },

    // Anthropic Claude 格式
    anthropic: {
        id: 'anthropic',
        name: 'Anthropic',
        description: 'Claude models with tool_use content blocks',
        isBuiltin: true,
        toolFormat: {
            wrapMode: 'none',
            parameterField: 'input_schema',
            includeType: false
        },
        responseParse: {
            responseFormat: 'json',
            toolCallPath: 'tool_use',
            toolNamePath: 'name',
            toolArgsPath: 'input',
            argsIsObject: true,
            toolIdPath: 'id',
            autoGenerateId: false
        },
        messageFormat: {
            toolResultRole: 'user',
            toolCallIdField: 'tool_use_id',
            wrapToolResult: true,
            toolResultWrapper: 'tool_result'
        }
    },

    // 千问 Qwen
    qwen: {
        id: 'qwen',
        name: '千问 Qwen',
        description: 'Alibaba Qwen models',
        extendsFrom: 'openai',
        isBuiltin: true,
        toolFormat: {
            wrapMode: 'function',
            wrapField: 'function',
            parameterField: 'parameters',
            includeType: true
        },
        responseParse: {
            responseFormat: 'json',
            toolCallPath: 'tool_calls',
            toolNamePath: 'function.name',
            toolArgsPath: 'function.arguments',
            argsIsObject: false,
            toolIdPath: 'id',
            autoGenerateId: true
        },
        messageFormat: {
            toolResultRole: 'tool',
            toolCallIdField: 'tool_call_id',
            wrapToolResult: false
        }
    },

    // 智谱 GLM
    glm: {
        id: 'glm',
        name: '智谱 GLM',
        description: 'Zhipu GLM-4 models',
        extendsFrom: 'openai',
        isBuiltin: true,
        toolFormat: {
            wrapMode: 'function',
            wrapField: 'function',
            parameterField: 'parameters',
            includeType: true
        },
        responseParse: {
            responseFormat: 'json',
            toolCallPath: 'tool_calls',
            toolNamePath: 'function.name',
            toolArgsPath: 'function.arguments',
            argsIsObject: true,
            toolIdPath: 'id',
            autoGenerateId: false
        },
        messageFormat: {
            toolResultRole: 'tool',
            toolCallIdField: 'tool_call_id',
            wrapToolResult: false
        }
    },

    // DeepSeek
    deepseek: {
        id: 'deepseek',
        name: 'DeepSeek',
        description: 'DeepSeek models (OpenAI compatible, supports reasoning)',
        extendsFrom: 'openai',
        isBuiltin: true,
        toolFormat: {
            wrapMode: 'function',
            wrapField: 'function',
            parameterField: 'parameters',
            includeType: true
        },
        responseParse: {
            responseFormat: 'json',
            toolCallPath: 'tool_calls',
            toolNamePath: 'function.name',
            toolArgsPath: 'function.arguments',
            argsIsObject: false,
            toolIdPath: 'id',
            autoGenerateId: false
        },
        messageFormat: {
            toolResultRole: 'tool',
            toolCallIdField: 'tool_call_id',
            wrapToolResult: false
        },
        // DeepSeek 特定配置
        requestConfig: {
            // Thinking 模式参数 (DeepSeek R1 支持)
            thinkingParams: {
                reasoning_effort: 'medium'  // low/medium/high
            }
        },
        streamConfig: {
            // DeepSeek 使用 reasoning 字段返回思考过程
            reasoningField: 'reasoning'
        }
    },

    // XML 格式通用适配器
    'xml-generic': {
        id: 'xml-generic',
        name: 'XML Format',
        description: 'Models using XML tool call format (Llama, etc.)',
        isBuiltin: true,
        toolFormat: {
            wrapMode: 'function',
            wrapField: 'function',
            parameterField: 'parameters',
            includeType: true
        },
        responseParse: {
            responseFormat: 'xml',
            autoGenerateId: true,
            xmlConfig: {
                toolCallTag: 'tool_call',
                nameSource: 'name',
                argsTag: 'arguments',
                argsFormat: 'json'
            }
        },
        messageFormat: {
            toolResultRole: 'user',
            toolCallIdField: 'tool_call_id',
            wrapToolResult: true,
            toolResultWrapper: 'tool_result'
        }
    },

    // 混合格式 (JSON + XML fallback)
    mixed: {
        id: 'mixed',
        name: 'Mixed Format',
        description: 'Try JSON first, fallback to XML parsing',
        isBuiltin: true,
        toolFormat: {
            wrapMode: 'function',
            wrapField: 'function',
            parameterField: 'parameters',
            includeType: true
        },
        responseParse: {
            responseFormat: 'mixed',
            toolCallPath: 'tool_calls',
            toolNamePath: 'function.name',
            toolArgsPath: 'function.arguments',
            argsIsObject: false,
            toolIdPath: 'id',
            autoGenerateId: true,
            xmlConfig: {
                toolCallTag: 'tool_call',
                nameSource: 'name',
                argsTag: 'arguments',
                argsFormat: 'json'
            }
        },
        messageFormat: {
            toolResultRole: 'tool',
            toolCallIdField: 'tool_call_id',
            wrapToolResult: false
        }
    }
}

// ===== 适配器服务类 =====

class ProviderAdapterServiceClass {
    private customAdapters: Map<string, ProviderAdapterConfig> = new Map()

    getAdapter(adapterId: string): ProviderAdapterConfig | null {
        if (this.customAdapters.has(adapterId)) {
            return this.customAdapters.get(adapterId)!
        }
        if (adapterId in BUILTIN_ADAPTERS) {
            return BUILTIN_ADAPTERS[adapterId as BuiltinAdapterId]
        }
        return null
    }

    getAllAdapters(): ProviderAdapterConfig[] {
        const all = [...Object.values(BUILTIN_ADAPTERS)]
        this.customAdapters.forEach(adapter => all.push(adapter))
        return all
    }

    registerAdapter(adapter: ProviderAdapterConfig): void {
        this.customAdapters.set(adapter.id, adapter)
    }

    removeAdapter(adapterId: string): boolean {
        return this.customAdapters.delete(adapterId)
    }

    convertTools(tools: ToolDefinition[], adapterId: string): unknown[] {
        const adapter = this.getAdapter(adapterId) || BUILTIN_ADAPTERS.openai
        const config = adapter.toolFormat

        return tools.map(tool => {
            const toolDef: Record<string, unknown> = {
                name: tool.name,
                description: tool.description,
                [config.parameterField]: tool.parameters
            }

            if (config.wrapMode === 'function' && config.wrapField) {
                const wrapped: Record<string, unknown> = {
                    [config.wrapField]: toolDef
                }
                if (config.includeType) {
                    wrapped.type = 'function'
                }
                return wrapped
            }

            if (config.includeType && config.wrapMode === 'tool') {
                return { type: 'tool', ...toolDef }
            }

            return toolDef
        })
    }

    parseToolCalls(response: unknown, adapterId: string): ParsedToolCall[] {
        const adapter = this.getAdapter(adapterId) || BUILTIN_ADAPTERS.openai
        const config = adapter.responseParse

        if (config.responseFormat === 'xml') {
            return this.parseXMLToolCalls(response as string, config.xmlConfig!)
        }

        if (config.responseFormat === 'mixed') {
            const jsonCalls = this.parseJSONToolCalls(response, config)
            if (jsonCalls.length > 0) return jsonCalls
            if (typeof response === 'string' && config.xmlConfig) {
                return this.parseXMLToolCalls(response, config.xmlConfig)
            }
        }

        return this.parseJSONToolCalls(response, config)
    }

    private parseJSONToolCalls(response: unknown, config: ResponseParseConfig): ParsedToolCall[] {
        const results: ParsedToolCall[] = []
        const toolCalls = this.getByPath(response, config.toolCallPath || 'tool_calls')
        if (!toolCalls) return results

        const callArray = Array.isArray(toolCalls) ? toolCalls : [toolCalls]

        for (const tc of callArray) {
            const name = this.getByPath(tc, config.toolNamePath || 'function.name') as string
            const rawArgs = this.getByPath(tc, config.toolArgsPath || 'function.arguments')
            const id = this.getByPath(tc, config.toolIdPath || 'id') as string ||
                (config.autoGenerateId ? this.generateId() : '')

            if (!name) continue

            let args: Record<string, unknown>
            if (config.argsIsObject) {
                args = rawArgs as Record<string, unknown> || {}
            } else {
                try {
                    args = JSON.parse(rawArgs as string || '{}')
                } catch {
                    args = {}
                }
            }

            results.push({ id, name, arguments: args })
        }

        return results
    }

    private parseXMLToolCalls(content: string, config: XMLParseConfig): ParsedToolCall[] {
        const results: ParsedToolCall[] = []
        const tagPattern = new RegExp(`<${config.toolCallTag}[^>]*>([\\s\\S]*?)</${config.toolCallTag}>`, 'gi')

        let match
        while ((match = tagPattern.exec(content)) !== null) {
            const innerContent = match[1]
            let name = ''
            let args: Record<string, unknown> = {}

            if (config.nameSource.startsWith('@')) {
                const attrName = config.nameSource.slice(1)
                const attrPattern = new RegExp(`${attrName}=["']([^"']+)["']`)
                const attrMatch = match[0].match(attrPattern)
                if (attrMatch) name = attrMatch[1]
            } else {
                const namePattern = new RegExp(`<${config.nameSource}>([^<]+)</${config.nameSource}>`)
                const nameMatch = innerContent.match(namePattern)
                if (nameMatch) name = nameMatch[1].trim()
            }

            const argsPattern = new RegExp(`<${config.argsTag}>([\\s\\S]*?)</${config.argsTag}>`)
            const argsMatch = innerContent.match(argsPattern)
            if (argsMatch) {
                const argsContent = argsMatch[1].trim()
                if (config.argsFormat === 'json') {
                    try {
                        args = JSON.parse(argsContent)
                    } catch {
                        args = {}
                    }
                } else if (config.argsFormat === 'key-value') {
                    const kvPattern = /<(\w+)>([^<]*)<\/\1>/g
                    let kvMatch
                    while ((kvMatch = kvPattern.exec(argsContent)) !== null) {
                        args[kvMatch[1]] = kvMatch[2]
                    }
                }
            }

            if (name) {
                results.push({ id: this.generateId(), name, arguments: args })
            }
        }

        return results
    }

    formatToolResultMessage(
        toolCallId: string,
        _toolName: string, // 保留以支持未来扩展（如日志记录）
        result: string,
        adapterId: string
    ): LLMMessage {
        const adapter = this.getAdapter(adapterId) || BUILTIN_ADAPTERS.openai
        const config = adapter.messageFormat

        const msg: LLMMessage = {
            role: config.toolResultRole as 'tool' | 'user',
            content: result,
            [config.toolCallIdField]: toolCallId
        }

        if (config.wrapToolResult && config.toolResultWrapper) {
            msg.content = [{
                type: config.toolResultWrapper,
                content: result,
                tool_use_id: toolCallId
            }] as unknown as string
        }

        return msg
    }

    private getByPath(obj: unknown, path: string): unknown {
        if (!obj || !path) return undefined
        const parts = path.split('.')
        let current: unknown = obj
        for (const part of parts) {
            if (current && typeof current === 'object' && part in (current as object)) {
                current = (current as Record<string, unknown>)[part]
            } else {
                return undefined
            }
        }
        return current
    }

    private generateId(): string {
        return `call_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    }
}

export const adapterService = new ProviderAdapterServiceClass()
export { BUILTIN_ADAPTERS }
