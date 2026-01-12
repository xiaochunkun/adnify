/**
 * 消息截断器
 */

import { getToolTruncateConfig } from '@/shared/config/agentConfig'

/**
 * 智能截断工具结果
 */
export function truncateToolResult(content: string, toolName: string): string {
  if (!content) return content

  const config = getToolTruncateConfig(toolName)
  const maxLength = config.maxLength

  if (content.length <= maxLength) return content

  // 错误信息保留更多
  if (/^(Error:|❌)/.test(content) && content.length <= maxLength * 1.5) {
    return content
  }

  const headSize = Math.floor(maxLength * config.headRatio)
  const tailSize = Math.floor(maxLength * config.tailRatio)
  const omitted = content.length - headSize - tailSize

  return `${content.slice(0, headSize)}\n\n... [${omitted} chars omitted] ...\n\n${content.slice(-tailSize)}`
}

/**
 * 截断普通消息
 */
export function truncateMessage(content: string, maxLength: number): string {
  if (content.length <= maxLength) return content
  const headSize = Math.floor(maxLength * 0.7)
  const tailSize = Math.floor(maxLength * 0.25)
  return `${content.slice(0, headSize)}\n...[truncated]...\n${content.slice(-tailSize)}`
}
