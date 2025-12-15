import OpenAI from 'openai'
import { LLMProvider, ChatParams, ToolDefinition, ToolCall } from '../types'

export class OpenAIProvider implements LLMProvider {
	private client: OpenAI

	constructor(apiKey: string, baseUrl?: string) {
		this.client = new OpenAI({
			apiKey,
			baseURL: baseUrl,
		})
	}

	private convertTools(tools?: ToolDefinition[]): OpenAI.ChatCompletionTool[] | undefined {
		if (!tools?.length) return undefined
		return tools.map(tool => ({
			type: 'function' as const,
			function: {
				name: tool.name,
				description: tool.description,
				parameters: tool.parameters,
			}
		}))
	}

	async chat(params: ChatParams): Promise<void> {
		const { model, messages, tools, systemPrompt, signal, onStream, onToolCall, onComplete, onError } = params

		try {
			const openaiMessages: OpenAI.ChatCompletionMessageParam[] = []

			if (systemPrompt) {
				openaiMessages.push({ role: 'system', content: systemPrompt })
			}

			for (const msg of messages) {
				if (msg.role === 'tool') {
					openaiMessages.push({
						role: 'tool',
						content: msg.content,
						tool_call_id: msg.toolCallId!,
					})
				} else if (msg.role === 'assistant' && msg.toolName) {
					// This is a tool call from assistant
					openaiMessages.push({
						role: 'assistant',
						content: null,
						tool_calls: [{
							id: msg.toolCallId!,
							type: 'function',
							function: {
								name: msg.toolName,
								arguments: msg.content,
							}
						}]
					})
				} else {
					openaiMessages.push({
						role: msg.role as 'user' | 'assistant',
						content: msg.content,
					})
				}
			}

			const stream = await this.client.chat.completions.create({
				model,
				messages: openaiMessages,
				tools: this.convertTools(tools),
				stream: true,
			}, { signal })

			let fullContent = ''
			const toolCalls: ToolCall[] = []
			let currentToolCall: Partial<ToolCall> | null = null

			for await (const chunk of stream) {
				const delta = chunk.choices[0]?.delta

				if (delta?.content) {
					fullContent += delta.content
					onStream({ type: 'text', content: delta.content })
				}

				if (delta?.tool_calls) {
					for (const tc of delta.tool_calls) {
						if (tc.index !== undefined) {
							if (!currentToolCall || tc.id) {
								if (currentToolCall?.id) {
									const finalToolCall: ToolCall = {
										id: currentToolCall.id!,
										name: currentToolCall.name!,
										arguments: JSON.parse(currentToolCall.arguments as unknown as string || '{}')
									}
									toolCalls.push(finalToolCall)
									onToolCall(finalToolCall)
								}
								currentToolCall = {
									id: tc.id,
									name: tc.function?.name,
									arguments: tc.function?.arguments || ''
								}
							} else {
								if (tc.function?.name) currentToolCall.name = tc.function.name
								if (tc.function?.arguments) {
									currentToolCall.arguments = ((currentToolCall.arguments as unknown as string) || '') + tc.function.arguments
								}
							}
						}
					}
				}
			}

			// Handle last tool call
			if (currentToolCall?.id) {
				const finalToolCall: ToolCall = {
					id: currentToolCall.id!,
					name: currentToolCall.name!,
					arguments: JSON.parse(currentToolCall.arguments as unknown as string || '{}')
				}
				toolCalls.push(finalToolCall)
				onToolCall(finalToolCall)
			}

			onComplete({ content: fullContent, toolCalls: toolCalls.length > 0 ? toolCalls : undefined })
		} catch (error: any) {
			onError(error)
		}
	}
}
