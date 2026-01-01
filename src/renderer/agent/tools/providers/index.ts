/**
 * 工具提供者模块
 * 导出所有工具提供者相关的类型和实例
 */

// 类型
export type { ToolProvider, ToolMeta } from './types'

// 工具管理器
export { toolManager } from './ToolManager'

// 内置工具提供者
export { BuiltinToolProvider, builtinToolProvider } from './BuiltinToolProvider'

// MCP 工具提供者
export { McpToolProvider, mcpToolProvider } from './McpToolProvider'

// =================== 初始化函数 ===================

import { toolManager } from './ToolManager'
import { builtinToolProvider } from './BuiltinToolProvider'
import { mcpToolProvider } from './McpToolProvider'

let initialized = false

/**
 * 初始化工具提供者系统
 * 注册所有工具提供者到工具管理器
 */
export function initializeToolProviders(): void {
  if (initialized) return

  // 注册内置工具提供者（最高优先级）
  toolManager.registerProvider(builtinToolProvider, 0)

  // 注册 MCP 工具提供者
  toolManager.registerProvider(mcpToolProvider, 10)

  initialized = true
}

/**
 * 设置是否包含计划工具
 */
export function setIncludePlanTools(include: boolean): void {
  builtinToolProvider.setIncludePlanTools(include)
}
