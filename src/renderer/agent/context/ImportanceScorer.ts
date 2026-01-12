/**
 * 消息重要性评分器
 */

import type { OpenAIMessage } from '../llm/MessageConverter'
import type { MessageGroup, DecisionPoint, FileChangeRecord } from './types'
import { isFileEditTool } from '@/shared/config/tools'

const WEIGHTS = {
  user: 30,
  assistantWithTools: 25,
  assistantText: 15,
  tool: 10,
  writeOp: 35,
  deleteOp: 45,
  error: 40,
  recent: 20,
}

/**
 * 计算消息组的重要性分数
 */
export function scoreMessageGroup(
  group: MessageGroup,
  messages: OpenAIMessage[],
  allGroups: MessageGroup[]
): number {
  let score = 0
  const indices = [group.userIndex, group.assistantIndex, ...group.toolIndices].filter((i): i is number => i !== null)

  for (const idx of indices) {
    const msg = messages[idx]
    if (msg.role === 'user') {
      score += WEIGHTS.user
    } else if (msg.role === 'assistant') {
      score += msg.tool_calls?.length ? WEIGHTS.assistantWithTools : WEIGHTS.assistantText
      if (msg.tool_calls) {
        for (const tc of msg.tool_calls) {
          if (isFileEditTool(tc.function.name)) {
            score += WEIGHTS.writeOp
            if (tc.function.name === 'delete_file') score += 10
          }
        }
      }
    } else if (msg.role === 'tool') {
      score += WEIGHTS.tool
      const content = typeof msg.content === 'string' ? msg.content : ''
      if (/^(Error:|❌)/.test(content)) score += WEIGHTS.error
    }
  }

  score = score / Math.max(indices.length, 1)

  if (group.hasWriteOps) score += 20
  if (group.hasErrors) score += 30
  if (group.turnIndex / Math.max(allGroups.length, 1) > 0.7) score += WEIGHTS.recent

  return Math.min(100, score)
}

/**
 * 提取关键决策点
 */
export function extractDecisionPoints(messages: OpenAIMessage[], groups: MessageGroup[]): DecisionPoint[] {
  const decisions: DecisionPoint[] = []

  for (const group of groups) {
    if (group.assistantIndex === null) continue
    const assistantMsg = messages[group.assistantIndex]
    if (!assistantMsg.tool_calls) continue

    for (const tc of assistantMsg.tool_calls) {
      const args = safeParseArgs(tc.function.arguments)
      const filePath = args.path as string | undefined
      if (!filePath) continue

      let type: DecisionPoint['type'] | null = null
      if (tc.function.name === 'create_file') type = 'file_create'
      else if (['edit_file', 'write_file', 'apply_diff'].includes(tc.function.name)) type = 'file_modify'
      else if (tc.function.name === 'delete_file') type = 'file_delete'

      if (type) {
        decisions.push({
          turnIndex: group.turnIndex,
          type,
          description: `${type.replace('file_', '').replace('_', ' ')}: ${filePath}`,
          files: [filePath],
          messageIndex: group.assistantIndex,
        })
      }
    }
  }

  return decisions
}

/**
 * 提取文件修改记录
 */
export function extractFileChanges(messages: OpenAIMessage[], groups: MessageGroup[]): FileChangeRecord[] {
  const fileHistory = new Map<string, FileChangeRecord>()

  for (const group of groups) {
    if (group.assistantIndex === null) continue
    const assistantMsg = messages[group.assistantIndex]
    if (!assistantMsg.tool_calls) continue

    for (const tc of assistantMsg.tool_calls) {
      const args = safeParseArgs(tc.function.arguments)
      const filePath = args.path as string | undefined
      if (!filePath) continue

      let action: FileChangeRecord['action'] = 'modify'
      let summary = 'Modified'

      if (tc.function.name === 'create_file') {
        action = 'create'
        summary = 'Created'
      } else if (tc.function.name === 'delete_file') {
        action = 'delete'
        summary = 'Deleted'
      } else if (['edit_file', 'write_file', 'apply_diff'].includes(tc.function.name)) {
        summary = (args.description as string) || 'Modified'
      }

      const existing = fileHistory.get(filePath)
      if (existing) {
        if (action === 'delete') {
          existing.action = 'delete'
          existing.summary = 'Created then deleted'
        } else {
          existing.summary += ` → ${summary}`
        }
        existing.turnIndex = group.turnIndex
      } else {
        fileHistory.set(filePath, { path: filePath, action, summary, turnIndex: group.turnIndex })
      }
    }
  }

  return Array.from(fileHistory.values())
}

function safeParseArgs(args: string): Record<string, unknown> {
  try {
    return JSON.parse(args)
  } catch {
    return {}
  }
}
