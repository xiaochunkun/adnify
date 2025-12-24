/**
 * LLM Provider 类型定义
 * 参考 void 编辑器和 cursor 的设计
 */

// 内置 Provider 类型
export type BuiltinProviderName = 'openai' | 'anthropic' | 'gemini' | 'deepseek' | 'groq' | 'mistral' | 'ollama'

// Provider 配置
export interface ProviderConfig {
	name: string
	displayName: string
	description: string
	apiKeyPlaceholder: string
	apiKeyUrl?: string
	defaultEndpoint?: string
	supportsCustomEndpoint: boolean
	supportsStreaming: boolean
	defaultModels: string[]
	isLocal?: boolean
}

// 内置 Provider 配置
export const BUILTIN_PROVIDERS: Record<BuiltinProviderName, ProviderConfig> = {
	openai: {
		name: 'openai',
		displayName: 'OpenAI',
		description: 'GPT-4, GPT-4o, o1 等模型',
		apiKeyPlaceholder: 'sk-proj-...',
		apiKeyUrl: 'https://platform.openai.com/api-keys',
		supportsCustomEndpoint: true,
		supportsStreaming: true,
		defaultModels: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1-preview', 'o1-mini'],
	},
	anthropic: {
		name: 'anthropic',
		displayName: 'Anthropic',
		description: 'Claude 3.5, Claude 3 等模型',
		apiKeyPlaceholder: 'sk-ant-...',
		apiKeyUrl: 'https://console.anthropic.com/settings/keys',
		supportsCustomEndpoint: true,
		supportsStreaming: true,
		defaultModels: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
	},
	gemini: {
		name: 'gemini',
		displayName: 'Google Gemini',
		description: 'Gemini Pro, Gemini Flash 等模型',
		apiKeyPlaceholder: 'AIzaSy...',
		apiKeyUrl: 'https://aistudio.google.com/apikey',
		supportsCustomEndpoint: false,
		supportsStreaming: true,
		defaultModels: ['gemini-2.0-flash-exp', 'gemini-1.5-pro', 'gemini-1.5-flash'],
	},
	deepseek: {
		name: 'deepseek',
		displayName: 'DeepSeek',
		description: 'DeepSeek Coder, DeepSeek Chat',
		apiKeyPlaceholder: 'sk-...',
		apiKeyUrl: 'https://platform.deepseek.com/api_keys',
		defaultEndpoint: 'https://api.deepseek.com',
		supportsCustomEndpoint: true,
		supportsStreaming: true,
		defaultModels: ['deepseek-chat', 'deepseek-coder'],
	},
	groq: {
		name: 'groq',
		displayName: 'Groq',
		description: '超快推理，Llama, Mixtral 等',
		apiKeyPlaceholder: 'gsk_...',
		apiKeyUrl: 'https://console.groq.com/keys',
		supportsCustomEndpoint: false,
		supportsStreaming: true,
		defaultModels: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
	},
	mistral: {
		name: 'mistral',
		displayName: 'Mistral AI',
		description: 'Mistral Large, Codestral 等',
		apiKeyPlaceholder: 'api-...',
		apiKeyUrl: 'https://console.mistral.ai/api-keys',
		supportsCustomEndpoint: false,
		supportsStreaming: true,
		defaultModels: ['mistral-large-latest', 'codestral-latest', 'mistral-small-latest'],
	},
	ollama: {
		name: 'ollama',
		displayName: 'Ollama',
		description: '本地运行开源模型',
		apiKeyPlaceholder: '(无需 API Key)',
		defaultEndpoint: 'http://localhost:11434',
		supportsCustomEndpoint: true,
		supportsStreaming: true,
		isLocal: true,
		defaultModels: ['llama3.2', 'codellama', 'deepseek-coder-v2'],
	},
}

// 自定义 Provider 配置
export interface CustomProviderConfig {
	id: string
	name: string
	displayName: string
	endpoint: string
	apiKey?: string
	models: string[]
	// 请求模板
	requestTemplate: {
		method: 'POST'
		headers: Record<string, string>
		bodyTemplate: string // JSON 模板，支持变量替换
	}
	// 响应解析
	responseParser: {
		contentPath: string // JSON path to content, e.g., "choices[0].message.content"
		streamFormat: 'sse' | 'ndjson' | 'none'
		streamContentPath?: string
	}
}

// 完整的 Provider 设置
export interface ProviderModelConfig {
	enabledModels?: string[] // 启用的内置模型
	customModels: string[]  // 用户添加的模型
	baseUrl?: string
	apiKey?: string
	timeout?: number
	adapterId?: string
	adapterConfig?: import('@/shared/types/llmAdapter').LLMAdapterConfig
	model?: string
}

export interface ProviderSettings {
	// 映射 Provider ID 到配置
	configs: Record<string, ProviderModelConfig>
}

// 模型选择
export interface ModelSelection {
	providerType: 'builtin' | 'custom'
	providerName: string
	modelName: string
}

// 功能对应的模型选择
export type FeatureName = 'chat' | 'agent' | 'autocomplete' | 'apply'
export type ModelSelectionOfFeature = Record<FeatureName, ModelSelection | null>

// 默认请求模板（OpenAI 兼容）
export const DEFAULT_REQUEST_TEMPLATE = {
	method: 'POST' as const,
	headers: {
		'Content-Type': 'application/json',
		'Authorization': 'Bearer {{apiKey}}',
	},
	bodyTemplate: JSON.stringify({
		model: '{{model}}',
		messages: '{{messages}}',
		stream: '{{stream}}',
		temperature: '{{temperature}}',
		max_tokens: '{{maxTokens}}',
	}, null, 2),
}

// 默认响应解析器
export const DEFAULT_RESPONSE_PARSER = {
	contentPath: 'choices[0].message.content',
	streamFormat: 'sse' as const,
	streamContentPath: 'choices[0].delta.content',
}

// 创建默认自定义 Provider
export function createDefaultCustomProvider(): CustomProviderConfig {
	return {
		id: crypto.randomUUID(),
		name: 'custom-provider',
		displayName: 'Custom Provider',
		endpoint: 'https://api.example.com/v1/chat/completions',
		models: ['model-1'],
		requestTemplate: DEFAULT_REQUEST_TEMPLATE,
		responseParser: DEFAULT_RESPONSE_PARSER,
	}
}
