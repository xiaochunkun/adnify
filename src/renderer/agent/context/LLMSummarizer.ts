/**
 * LLM 摘要生成器
 */

import { api } from '@/renderer/services/electronAPI'
import { logger } from '@utils/Logger'
import type { OpenAIMessage } from '../llm/MessageConverter'
import type { StructuredSummary, MessageGroup } from './types'
import { generateQuickSummary } from './SummaryGenerator'

/**
 * 使用 LLM 生成高质量摘要
 */
export async function generateLLMSummary(
  messages: OpenAIMessage[],
  groups: MessageGroup[],
  turnRange: [number, number]
): Promise<StructuredSummary> {
  const quickSummary = generateQuickSummary(messages, groups, turnRange)

  const { useAgentStore } = await import('../store/AgentStore')
  const setCompressionPhase = useAgentStore.getState().setCompressionPhase

  try {
    const { useStore } = await import('@store')
    const llmConfig = useStore.getState().llmConfig

    if (!llmConfig?.apiKey) {
      logger.agent.warn('[LLMSummarizer] No API key, using quick summary')
      return quickSummary
    }

    logger.agent.info('[LLMSummarizer] Generating LLM summary...')
    setCompressionPhase('summarizing')

    const summaryMessages = buildSummaryMessages(messages, groups, turnRange, quickSummary)

    const result = await api.llm.compactContext({
      config: {
        provider: llmConfig.provider,
        model: llmConfig.model,
        apiKey: llmConfig.apiKey,
        baseUrl: llmConfig.baseUrl,
        maxTokens: 1500,
        temperature: 0.3,
        adapterConfig: llmConfig.adapterConfig,
      },
      messages: summaryMessages as any,
      tools: [],
      systemPrompt: SUMMARY_SYSTEM_PROMPT,
    })

    if (result.error || !result.content) {
      logger.agent.warn('[LLMSummarizer] LLM call failed:', result.error)
      return quickSummary
    }

    const enhanced = parseLLMResponse(result.content, quickSummary)
    logger.agent.info('[LLMSummarizer] Generated LLM summary successfully')

    setCompressionPhase('done')
    setTimeout(() => setCompressionPhase('idle'), 500)

    return enhanced
  } catch (error) {
    logger.agent.error('[LLMSummarizer] Error:', error)
    setCompressionPhase('idle')
    return quickSummary
  }
}

function buildSummaryMessages(
  messages: OpenAIMessage[],
  groups: MessageGroup[],
  turnRange: [number, number],
  quickSummary: StructuredSummary
): OpenAIMessage[] {
  const result: OpenAIMessage[] = []

  for (const group of groups) {
    if (group.turnIndex < turnRange[0] || group.turnIndex > turnRange[1]) continue

    const userMsg = messages[group.userIndex]
    if (userMsg) {
      const content = typeof userMsg.content === 'string' ? userMsg.content : ''
      result.push({ role: 'user', content: content.slice(0, 300) })
    }

    if (group.assistantIndex !== null) {
      const assistantMsg = messages[group.assistantIndex]
      if (assistantMsg) {
        const toolSummary = assistantMsg.tool_calls
          ?.map(tc => {
            const args = safeParseArgs(tc.function.arguments)
            const path = args.path ? ` (${args.path})` : ''
            return `[${tc.function.name}${path}]`
          })
          .join(' ') || ''

        const content = typeof assistantMsg.content === 'string' ? assistantMsg.content : ''
        result.push({
          role: 'assistant',
          content: content.slice(0, 200) + (toolSummary ? `\n${toolSummary}` : ''),
        })
      }
    }
  }

  const quickSummaryText = formatQuickSummary(quickSummary)

  result.push({
    role: 'user',
    content: `Based on the conversation above, generate a structured summary.

## Quick Analysis:
${quickSummaryText}

## Output Format (JSON):
{
  "objective": "Main task/goal",
  "completedSteps": ["Step 1", "Step 2"],
  "pendingSteps": ["Next step"],
  "userInstructions": ["Important instruction"]
}

Output ONLY valid JSON.`,
  })

  return result
}

function parseLLMResponse(content: string, fallback: StructuredSummary): StructuredSummary {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return fallback

    const parsed = JSON.parse(jsonMatch[0])

    return {
      ...fallback,
      objective: parsed.objective || fallback.objective,
      completedSteps: mergeArrays(fallback.completedSteps, parsed.completedSteps),
      pendingSteps: parsed.pendingSteps || fallback.pendingSteps,
      userInstructions: mergeArrays(fallback.userInstructions, parsed.userInstructions),
    }
  } catch {
    return fallback
  }
}

function formatQuickSummary(summary: StructuredSummary): string {
  const parts: string[] = [`Objective: ${summary.objective}`]

  if (summary.completedSteps.length > 0) {
    parts.push(`Completed: ${summary.completedSteps.slice(-5).join(', ')}`)
  }

  if (summary.fileChanges.length > 0) {
    const files = summary.fileChanges.slice(-5).map(f => `${f.action}:${f.path}`).join(', ')
    parts.push(`Files: ${files}`)
  }

  if (summary.errorsAndFixes.length > 0) {
    parts.push(`Errors: ${summary.errorsAndFixes.length} encountered`)
  }

  return parts.join('\n')
}

function mergeArrays(arr1: string[], arr2?: string[]): string[] {
  if (!arr2) return arr1
  return Array.from(new Set([...arr1, ...arr2]))
}

function safeParseArgs(args: string): Record<string, unknown> {
  try {
    return JSON.parse(args)
  } catch {
    return {}
  }
}

const SUMMARY_SYSTEM_PROMPT = `You are a conversation summarizer. Create concise, structured summaries of coding conversations.

Rules:
1. Focus on actions taken, not explanations
2. List concrete file changes and decisions
3. Identify pending work clearly
4. Note user preferences or corrections
5. Output valid JSON only`
