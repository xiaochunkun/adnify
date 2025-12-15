import { BrowserWindow } from 'electron'
import { OpenAIProvider } from './providers/openai'
import { AnthropicProvider } from './providers/anthropic'
import { GeminiProvider } from './providers/gemini'
import { LLMProvider, LLMMessage, LLMConfig, ToolDefinition } from './types'

export class LLMService {
	private window: BrowserWindow
	private providers: Map<string, LLMProvider> = new Map()
	private currentAbortController: AbortController | null = null

	constructor(window: BrowserWindow) {
		this.window = window
	}

	private getProvider(config: LLMConfig): LLMProvider {
		const key = `${config.provider}-${config.apiKey}`

		if (!this.providers.has(key)) {
			switch (config.provider) {
				case 'openai':
					this.providers.set(key, new OpenAIProvider(config.apiKey, config.baseUrl))
					break
				case 'anthropic':
					this.providers.set(key, new AnthropicProvider(config.apiKey))
					break
				case 'gemini':
					this.providers.set(key, new GeminiProvider(config.apiKey))
					break
				default:
					throw new Error(`Unknown provider: ${config.provider}`)
			}
		}

		return this.providers.get(key)!
	}

	async sendMessage(params: {
		config: LLMConfig
		messages: LLMMessage[]
		tools?: ToolDefinition[]
		systemPrompt?: string
	}) {
		const { config, messages, tools, systemPrompt } = params

		this.currentAbortController = new AbortController()
		const provider = this.getProvider(config)

		try {
			await provider.chat({
				model: config.model,
				messages,
				tools,
				systemPrompt,
				signal: this.currentAbortController.signal,
				onStream: (chunk) => {
					this.window.webContents.send('llm:stream', chunk)
				},
				onToolCall: (toolCall) => {
					this.window.webContents.send('llm:stream', { type: 'tool_call', ...toolCall })
				},
				onComplete: (result) => {
					this.window.webContents.send('llm:done', result)
				},
				onError: (error) => {
					this.window.webContents.send('llm:error', error.message)
				}
			})
		} catch (error: any) {
			if (error.name !== 'AbortError') {
				this.window.webContents.send('llm:error', error.message)
			}
		}
	}

	abort() {
		this.currentAbortController?.abort()
		this.currentAbortController = null
	}
}
