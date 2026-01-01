/**
 * 内置工具提供者
 * 包装现有的 toolRegistry，提供统一的 ToolProvider 接口
 */

import { toolRegistry } from '../registry'
import type { ToolProvider } from './types'
import type {
  ToolDefinition,
  ToolExecutionResult,
  ToolExecutionContext,
  ToolApprovalType,
} from '@/shared/types'

export class BuiltinToolProvider implements ToolProvider {
  readonly id = 'builtin'
  readonly name = 'Built-in Tools'

  private includePlanTools = false

  /** 设置是否包含计划工具 */
  setIncludePlanTools(include: boolean): void {
    this.includePlanTools = include
  }

  hasTool(toolName: string): boolean {
    // 排除 MCP 工具前缀
    if (toolName.startsWith('mcp_')) {
      return false
    }
    return toolRegistry.has(toolName)
  }

  getToolDefinitions(): ToolDefinition[] {
    return toolRegistry.getDefinitions(this.includePlanTools)
  }

  getApprovalType(toolName: string): ToolApprovalType {
    return toolRegistry.getApprovalType(toolName)
  }

  validateArgs(toolName: string, args: unknown): { valid: boolean; error?: string } {
    const result = toolRegistry.validate(toolName, args)
    return {
      valid: result.success,
      error: result.success ? undefined : result.error,
    }
  }

  async execute(
    toolName: string,
    args: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    return toolRegistry.execute(toolName, args, context)
  }
}

/** 内置工具提供者单例 */
export const builtinToolProvider = new BuiltinToolProvider()
