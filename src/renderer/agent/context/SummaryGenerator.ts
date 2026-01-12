/**
 * 摘要生成器
 */

import type { OpenAIMessage } from '../llm/MessageConverter'
import type { StructuredSummary, MessageGroup, HandoffDocument } from './types'
import { extractDecisionPoints, extractFileChanges } from './ImportanceScorer'
import { isWriteTool } from '@/shared/config/tools'

/**
 * 快速生成摘要（不调用 LLM）
 */
export function generateQuickSummary(
  messages: OpenAIMessage[],
  groups: MessageGroup[],
  turnRange: [number, number]
): StructuredSummary {
  const firstUserMsg = messages.find(m => m.role === 'user')
  const objective = firstUserMsg
    ? extractObjective(typeof firstUserMsg.content === 'string' ? firstUserMsg.content : '')
    : 'Unknown objective'

  return {
    objective,
    completedSteps: extractCompletedSteps(messages, groups),
    pendingSteps: extractPendingSteps(messages),
    decisions: extractDecisionPoints(messages, groups),
    fileChanges: extractFileChanges(messages, groups),
    errorsAndFixes: extractErrorsAndFixes(messages, groups),
    userInstructions: extractUserInstructions(messages, groups),
    generatedAt: Date.now(),
    turnRange,
  }
}

/**
 * 生成 Handoff 文档
 */
export function generateHandoffDocument(
  sessionId: string,
  messages: OpenAIMessage[],
  _groups: MessageGroup[],
  summary: StructuredSummary,
  workingDirectory: string
): HandoffDocument {
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')
  const lastUserRequest = lastUserMsg
    ? (typeof lastUserMsg.content === 'string' ? lastUserMsg.content : 'Continue the task')
    : 'Continue the task'

  const recentFiles = summary.fileChanges
    .filter(f => f.action !== 'delete')
    .slice(-5)
    .map(f => ({ path: f.path, content: '', reason: f.summary }))

  return {
    fromSessionId: sessionId,
    createdAt: Date.now(),
    summary,
    workingDirectory,
    keyFileSnapshots: recentFiles,
    lastUserRequest: lastUserRequest.slice(0, 500),
    suggestedNextSteps: generateSuggestedNextSteps(summary),
  }
}

/**
 * 将 Handoff 文档转换为 System Prompt
 */
export function handoffToSystemPrompt(handoff: HandoffDocument): string {
  const fileChanges = handoff.summary.fileChanges
    .map(f => `- [${f.action.toUpperCase()}] ${f.path}: ${f.summary}`)
    .join('\n')

  const decisions = handoff.summary.decisions
    .slice(-10)
    .map(d => `- ${d.description}`)
    .join('\n')

  return `## Session Handoff Context

### Objective
${handoff.summary.objective}

### Completed Steps
${handoff.summary.completedSteps.map(s => `✓ ${s}`).join('\n') || 'None'}

### Pending Steps
${handoff.summary.pendingSteps.map(s => `○ ${s}`).join('\n') || 'None'}

### File Changes
${fileChanges || 'None'}

### Key Decisions
${decisions || 'None'}

### Last User Request
"${handoff.lastUserRequest}"

---
Continue from where we left off.`
}

/**
 * 生成 LLM 摘要的 prompt
 */
export function buildSummaryPrompt(_messages: OpenAIMessage[], quickSummary: StructuredSummary): string {
  const fileChangesList = quickSummary.fileChanges
    .map(f => `- ${f.action}: ${f.path}`)
    .join('\n')

  return `Generate a structured summary for continuing this task.

## Quick Analysis:
- Objective: ${quickSummary.objective}
- File Changes:
${fileChangesList || '  None'}
- Errors: ${quickSummary.errorsAndFixes.length}

## Output Format (JSON):
{
  "objective": "Main task/goal",
  "completedSteps": ["Step 1", "Step 2"],
  "pendingSteps": ["Next step"],
  "keyInsights": ["Important insight"]
}

Output ONLY valid JSON.`
}

// ===== 辅助函数 =====

function extractObjective(content: string): string {
  const firstSentence = content.match(/^[^.!?。！？]+[.!?。！？]?/)?.[0]
  if (firstSentence && firstSentence.length > 20) return firstSentence.slice(0, 200)
  return content.slice(0, 200)
}

function extractCompletedSteps(messages: OpenAIMessage[], groups: MessageGroup[]): string[] {
  const steps: string[] = []
  for (const group of groups) {
    if (!group.hasWriteOps || group.assistantIndex === null) continue
    const assistantMsg = messages[group.assistantIndex]
    if (!assistantMsg.tool_calls) continue

    for (const tc of assistantMsg.tool_calls) {
      if (isWriteTool(tc.function.name)) {
        const args = safeParseArgs(tc.function.arguments)
        if (args.path) steps.push(`${tc.function.name}: ${args.path}`)
      }
    }
  }
  return [...new Set(steps)].slice(-20)
}

function extractPendingSteps(messages: OpenAIMessage[]): string[] {
  const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant')
  if (!lastAssistant) return []

  const content = typeof lastAssistant.content === 'string' ? lastAssistant.content : ''
  const listItems = content.match(/(?:^|\n)\s*[-*•]\s*(.+)/g) || []
  const numberedItems = content.match(/(?:^|\n)\s*\d+[.)]\s*(.+)/g) || []

  return [...listItems, ...numberedItems]
    .map(item => item.replace(/^[\s\-*•\d.)]+/, '').trim())
    .filter(item => item.length > 10 && item.length < 200)
    .slice(0, 5)
}

function extractErrorsAndFixes(messages: OpenAIMessage[], groups: MessageGroup[]): { error: string; fix: string }[] {
  const results: { error: string; fix: string }[] = []

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i]
    if (!group.hasErrors) continue

    for (const toolIdx of group.toolIndices) {
      const content = typeof messages[toolIdx].content === 'string' ? messages[toolIdx].content : ''
      if (/^(Error:|❌)/.test(content)) {
        const errorLine = content.split('\n').find(l => /error|failed/i.test(l)) || content.slice(0, 100)
        const nextGroup = groups[i + 1]
        results.push({
          error: errorLine.slice(0, 100),
          fix: nextGroup?.hasWriteOps ? 'Fixed in subsequent changes' : 'Not yet fixed',
        })
      }
    }
  }

  return results.slice(-5)
}

function extractUserInstructions(messages: OpenAIMessage[], groups: MessageGroup[]): string[] {
  const instructions: string[] = []
  const patterns = [/请|要|必须|不要|别|应该|需要/, /please|must|should|don't|always|never/i, /记住|注意|重要/, /remember|note|important/i]

  for (const group of groups) {
    const msgContent = messages[group.userIndex].content
    const content = typeof msgContent === 'string' ? msgContent : ''
    if (patterns.some(p => p.test(content))) {
      instructions.push(content.slice(0, 150))
    }
  }

  return instructions.slice(-5)
}

function generateSuggestedNextSteps(summary: StructuredSummary): string[] {
  const steps: string[] = []
  if (summary.pendingSteps.length > 0) steps.push(...summary.pendingSteps.slice(0, 3))

  const unfixed = summary.errorsAndFixes.filter(e => e.fix === 'Not yet fixed')
  if (unfixed.length > 0) steps.push(`Fix error: ${unfixed[0].error.slice(0, 50)}`)

  if (steps.length === 0) {
    steps.push('Review changes made so far')
    steps.push('Continue with next logical step')
  }

  return steps.slice(0, 5)
}

function safeParseArgs(args: string): Record<string, unknown> {
  try {
    return JSON.parse(args)
  } catch {
    return {}
  }
}
