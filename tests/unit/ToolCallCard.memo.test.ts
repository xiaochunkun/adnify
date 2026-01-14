/**
 * ToolCallCard memo 比较函数测试
 * 验证工具名称变化时组件能正确重新渲染
 */

import { describe, it, expect } from 'vitest'

// 模拟 ToolCall 类型
interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
  status?: 'pending' | 'running' | 'success' | 'error' | 'rejected' | 'awaiting'
  result?: string
}

interface ToolCallCardProps {
  toolCall: ToolCall
  isAwaitingApproval?: boolean
  onApprove?: () => void
  onReject?: () => void
  defaultExpanded?: boolean
}

// 从 ToolCallCard.tsx 提取的 memo 比较函数
const memoCompare = (prevProps: ToolCallCardProps, nextProps: ToolCallCardProps): boolean => {
  // 名称变化时必须重新渲染
  if (prevProps.toolCall.name !== nextProps.toolCall.name) {
    return false
  }

  const prevStreaming = (prevProps.toolCall.arguments as Record<string, unknown>)?._streaming
  const nextStreaming = (nextProps.toolCall.arguments as Record<string, unknown>)?._streaming
  if (prevStreaming || nextStreaming) {
    return prevProps.toolCall.id === nextProps.toolCall.id && prevStreaming === nextStreaming
  }
  return (
    prevProps.toolCall.id === nextProps.toolCall.id &&
    prevProps.toolCall.status === nextProps.toolCall.status &&
    prevProps.isAwaitingApproval === nextProps.isAwaitingApproval &&
    prevProps.toolCall.result === nextProps.toolCall.result &&
    prevProps.defaultExpanded === nextProps.defaultExpanded
  )
}

describe('ToolCallCard memo comparison', () => {
  it('should re-render when name changes from placeholder to actual name', () => {
    const prev: ToolCallCardProps = {
      toolCall: {
        id: 'tool-1',
        name: '...',  // 占位符
        arguments: { _streaming: true },
        status: 'pending',
      },
    }

    const next: ToolCallCardProps = {
      toolCall: {
        id: 'tool-1',
        name: 'read_file',  // 实际名称
        arguments: { _streaming: true },
        status: 'pending',
      },
    }

    // 返回 false 表示需要重新渲染
    expect(memoCompare(prev, next)).toBe(false)
  })

  it('should re-render when name changes from unknown to actual name', () => {
    const prev: ToolCallCardProps = {
      toolCall: {
        id: 'tool-1',
        name: 'unknown',
        arguments: { path: '/test' },
        status: 'pending',
      },
    }

    const next: ToolCallCardProps = {
      toolCall: {
        id: 'tool-1',
        name: 'read_file',
        arguments: { path: '/test' },
        status: 'pending',
      },
    }

    expect(memoCompare(prev, next)).toBe(false)
  })

  it('should not re-render when streaming and only args change', () => {
    const prev: ToolCallCardProps = {
      toolCall: {
        id: 'tool-1',
        name: 'read_file',
        arguments: { _streaming: true, path: '/test' },
        status: 'pending',
      },
    }

    const next: ToolCallCardProps = {
      toolCall: {
        id: 'tool-1',
        name: 'read_file',
        arguments: { _streaming: true, path: '/test', extra: 'data' },
        status: 'pending',
      },
    }

    // 流式传输时，只要 id、name 和 _streaming 相同就不重新渲染
    expect(memoCompare(prev, next)).toBe(true)
  })

  it('should re-render when streaming ends', () => {
    const prev: ToolCallCardProps = {
      toolCall: {
        id: 'tool-1',
        name: 'read_file',
        arguments: { _streaming: true },
        status: 'pending',
      },
    }

    const next: ToolCallCardProps = {
      toolCall: {
        id: 'tool-1',
        name: 'read_file',
        arguments: { path: '/test' },  // _streaming removed
        status: 'pending',
      },
    }

    expect(memoCompare(prev, next)).toBe(false)
  })

  it('should re-render when status changes', () => {
    const prev: ToolCallCardProps = {
      toolCall: {
        id: 'tool-1',
        name: 'read_file',
        arguments: { path: '/test' },
        status: 'pending',
      },
    }

    const next: ToolCallCardProps = {
      toolCall: {
        id: 'tool-1',
        name: 'read_file',
        arguments: { path: '/test' },
        status: 'success',
      },
    }

    expect(memoCompare(prev, next)).toBe(false)
  })

  it('should re-render when result is added', () => {
    const prev: ToolCallCardProps = {
      toolCall: {
        id: 'tool-1',
        name: 'read_file',
        arguments: { path: '/test' },
        status: 'running',
      },
    }

    const next: ToolCallCardProps = {
      toolCall: {
        id: 'tool-1',
        name: 'read_file',
        arguments: { path: '/test' },
        status: 'success',
        result: 'file content',
      },
    }

    expect(memoCompare(prev, next)).toBe(false)
  })

  it('should not re-render when props are identical', () => {
    const props: ToolCallCardProps = {
      toolCall: {
        id: 'tool-1',
        name: 'read_file',
        arguments: { path: '/test' },
        status: 'success',
        result: 'content',
      },
      isAwaitingApproval: false,
      defaultExpanded: true,
    }

    expect(memoCompare(props, props)).toBe(true)
  })

  it('should re-render when isAwaitingApproval changes', () => {
    const prev: ToolCallCardProps = {
      toolCall: {
        id: 'tool-1',
        name: 'run_command',
        arguments: { command: 'ls' },
        status: 'awaiting',
      },
      isAwaitingApproval: false,
    }

    const next: ToolCallCardProps = {
      toolCall: {
        id: 'tool-1',
        name: 'run_command',
        arguments: { command: 'ls' },
        status: 'awaiting',
      },
      isAwaitingApproval: true,
    }

    expect(memoCompare(prev, next)).toBe(false)
  })
})
