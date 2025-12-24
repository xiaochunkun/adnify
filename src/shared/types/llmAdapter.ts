/**
 * LLM 适配器配置类型
 * 完全可视化自定义的配置系统
 */

// 请求配置
export interface RequestConfig {
    endpoint: string              // API 端点 (不包含 baseUrl)
    method: 'POST' | 'GET'
    headers: Record<string, string>
    bodyTemplate: Record<string, unknown>  // 请求体模板
}

// 响应解析配置
export interface ResponseConfig {
    // 流式响应字段路径
    contentField: string          // 内容字段 'delta.content'
    reasoningField?: string       // 思考字段 'delta.reasoning' | 'delta.reasoning_content'
    toolCallField?: string        // 工具调用 'delta.tool_calls'
    finishReasonField?: string    // 完成原因 'finish_reason'

    // 工具调用解析
    toolNamePath?: string         // 工具名 'function.name'
    toolArgsPath?: string         // 参数 'function.arguments'
    toolIdPath?: string           // ID 'id'
    argsIsObject?: boolean        // 参数是否已是对象

    // 结束标记
    doneMarker?: string           // 流结束标记 '[DONE]'
}

// 完整适配器配置
export interface LLMAdapterConfig {
    id: string
    name: string
    description?: string

    request: RequestConfig
    response: ResponseConfig

    // 是否为内置预设
    isBuiltin?: boolean
}

// ============ 内置预设 ============

export const BUILTIN_ADAPTERS: Record<string, LLMAdapterConfig> = {
    // OpenAI / GPT
    openai: {
        id: 'openai',
        name: 'OpenAI',
        description: 'GPT-4, GPT-3.5 系列',
        isBuiltin: true,
        request: {
            endpoint: '/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            bodyTemplate: {
                model: '{{model}}',
                messages: '{{messages}}',
                stream: true,
                max_tokens: 8192,
            }
        },
        response: {
            contentField: 'delta.content',
            toolCallField: 'delta.tool_calls',
            toolNamePath: 'function.name',
            toolArgsPath: 'function.arguments',
            toolIdPath: 'id',
            argsIsObject: false,
            finishReasonField: 'finish_reason',
            doneMarker: '[DONE]',
        }
    },

    // Anthropic / Claude
    anthropic: {
        id: 'anthropic',
        name: 'Anthropic',
        description: 'Claude 系列',
        isBuiltin: true,
        request: {
            endpoint: '/messages',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'anthropic-version': '2023-06-01',
            },
            bodyTemplate: {
                model: '{{model}}',
                messages: '{{messages}}',
                stream: true,
                max_tokens: 8192,
            }
        },
        response: {
            contentField: 'delta.text',
            toolCallField: 'content_block',
            toolNamePath: 'name',
            toolArgsPath: 'input',
            toolIdPath: 'id',
            argsIsObject: true,
            finishReasonField: 'stop_reason',
            doneMarker: 'message_stop',
        }
    },

    // DeepSeek
    deepseek: {
        id: 'deepseek',
        name: 'DeepSeek',
        description: 'DeepSeek V3, R1 系列 (支持 Reasoning)',
        isBuiltin: true,
        request: {
            endpoint: '/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            bodyTemplate: {
                model: '{{model}}',
                messages: '{{messages}}',
                stream: true,
                max_tokens: 8192,
                // DeepSeek R1 Thinking 参数
                // reasoning_effort: 'medium',  // low/medium/high
            }
        },
        response: {
            contentField: 'delta.content',
            reasoningField: 'delta.reasoning',  // DeepSeek R1 思考字段
            toolCallField: 'delta.tool_calls',
            toolNamePath: 'function.name',
            toolArgsPath: 'function.arguments',
            toolIdPath: 'id',
            argsIsObject: false,
            finishReasonField: 'finish_reason',
            doneMarker: '[DONE]',
        }
    },

    // 智谱 GLM
    zhipu: {
        id: 'zhipu',
        name: '智谱 GLM',
        description: 'GLM-4.7, GLM-4.5 系列 (支持 Thinking)',
        isBuiltin: true,
        request: {
            endpoint: '/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            bodyTemplate: {
                model: '{{model}}',
                messages: '{{messages}}',
                stream: true,
                max_tokens: 8192,
                // 智谱 Thinking 参数
                // thinking: { type: 'enabled' },
            }
        },
        response: {
            contentField: 'delta.content',
            reasoningField: 'delta.reasoning_content',  // 智谱思考字段
            toolCallField: 'delta.tool_calls',
            toolNamePath: 'function.name',
            toolArgsPath: 'function.arguments',
            toolIdPath: 'id',
            argsIsObject: true,
            finishReasonField: 'finish_reason',
            doneMarker: '[DONE]',
        }
    },

    // Google Gemini
    gemini: {
        id: 'gemini',
        name: 'Google Gemini',
        description: 'Gemini Pro, Flash 系列',
        isBuiltin: true,
        request: {
            endpoint: '/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            bodyTemplate: {
                model: '{{model}}',
                messages: '{{messages}}',
                stream: true,
                max_tokens: 8192,
            }
        },
        response: {
            contentField: 'delta.content',
            toolCallField: 'delta.tool_calls',
            toolNamePath: 'function.name',
            toolArgsPath: 'function.arguments',
            toolIdPath: 'id',
            argsIsObject: false,
            finishReasonField: 'finish_reason',
            doneMarker: '[DONE]',
        }
    },

    // 阿里 Qwen
    qwen: {
        id: 'qwen',
        name: '阿里 Qwen',
        description: 'Qwen 系列 (OpenAI 兼容)',
        isBuiltin: true,
        request: {
            endpoint: '/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            bodyTemplate: {
                model: '{{model}}',
                messages: '{{messages}}',
                stream: true,
                max_tokens: 8192,
            }
        },
        response: {
            contentField: 'delta.content',
            toolCallField: 'delta.tool_calls',
            toolNamePath: 'function.name',
            toolArgsPath: 'function.arguments',
            toolIdPath: 'id',
            argsIsObject: false,
            finishReasonField: 'finish_reason',
            doneMarker: '[DONE]',
        }
    },

    // Ollama (本地)
    ollama: {
        id: 'ollama',
        name: 'Ollama',
        description: '本地模型',
        isBuiltin: true,
        request: {
            endpoint: '/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            bodyTemplate: {
                model: '{{model}}',
                messages: '{{messages}}',
                stream: true,
            }
        },
        response: {
            contentField: 'delta.content',
            toolCallField: 'delta.tool_calls',
            toolNamePath: 'function.name',
            toolArgsPath: 'function.arguments',
            toolIdPath: 'id',
            argsIsObject: false,
            finishReasonField: 'finish_reason',
            doneMarker: '[DONE]',
        }
    },
}

// 获取所有内置预设
export function getBuiltinAdapters(): LLMAdapterConfig[] {
    return Object.values(BUILTIN_ADAPTERS)
}

// 根据 ID 获取预设
export function getBuiltinAdapter(id: string): LLMAdapterConfig | undefined {
    return BUILTIN_ADAPTERS[id]
}

// 创建自定义适配器（基于预设）
export function createCustomAdapter(baseId: string, overrides: Partial<LLMAdapterConfig>): LLMAdapterConfig {
    const base = BUILTIN_ADAPTERS[baseId] || BUILTIN_ADAPTERS.openai
    return {
        ...base,
        ...overrides,
        id: overrides.id || `custom-${Date.now()}`,
        isBuiltin: false,
    }
}
