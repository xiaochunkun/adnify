/**
 * MCP 工具提供者
 * 将 MCP 服务器的工具集成到统一的工具系统
 */

import { useStore } from '@store'
import { mcpService } from '@services/mcpService'
import { logger } from '@utils/Logger'
import type { ToolProvider } from './types'
import type {
  ToolDefinition,
  ToolExecutionResult,
  ToolExecutionContext,
  ToolApprovalType,
} from '@/shared/types'
import type { McpTool, McpServerState } from '@shared/types/mcp'

/** MCP 工具名称前缀 */
const MCP_TOOL_PREFIX = 'mcp_'

/** MCP 工具名称分隔符 */
const MCP_TOOL_SEPARATOR = '__'

export class McpToolProvider implements ToolProvider {
  readonly id = 'mcp'
  readonly name = 'MCP Tools'

  /** 生成 MCP 工具的完整名称 */
  static getFullToolName(serverId: string, toolName: string): string {
    return `${MCP_TOOL_PREFIX}${serverId}${MCP_TOOL_SEPARATOR}${toolName}`
  }

  /** 解析 MCP 工具名称 */
  static parseToolName(fullName: string): { serverId: string; toolName: string } | null {
    if (!fullName.startsWith(MCP_TOOL_PREFIX)) {
      return null
    }
    const rest = fullName.slice(MCP_TOOL_PREFIX.length)
    const separatorIndex = rest.indexOf(MCP_TOOL_SEPARATOR)
    if (separatorIndex === -1) {
      return null
    }
    return {
      serverId: rest.slice(0, separatorIndex),
      toolName: rest.slice(separatorIndex + MCP_TOOL_SEPARATOR.length),
    }
  }

  /** 检查是否为 MCP 工具 */
  static isMcpTool(toolName: string): boolean {
    return toolName.startsWith(MCP_TOOL_PREFIX)
  }

  hasTool(toolName: string): boolean {
    if (!McpToolProvider.isMcpTool(toolName)) {
      return false
    }
    
    const parsed = McpToolProvider.parseToolName(toolName)
    if (!parsed) {
      return false
    }

    const server = this.getServer(parsed.serverId)
    if (!server || server.status !== 'connected') {
      return false
    }

    return server.tools.some(t => t.name === parsed.toolName)
  }

  getToolDefinitions(): ToolDefinition[] {
    const servers = this.getConnectedServers()
    const definitions: ToolDefinition[] = []

    for (const server of servers) {
      for (const tool of server.tools) {
        definitions.push(this.convertToDefinition(server, tool))
      }
    }

    return definitions
  }

  getApprovalType(toolName: string): ToolApprovalType {
    const parsed = McpToolProvider.parseToolName(toolName)
    if (!parsed) {
      return 'dangerous' // 未知工具需要审批
    }

    const server = this.getServer(parsed.serverId)
    if (!server) {
      return 'dangerous'
    }

    // 检查是否在自动批准列表中
    const autoApprove = server.config.autoApprove || []
    if (autoApprove.includes(parsed.toolName)) {
      return 'none'
    }

    // MCP 工具默认需要审批
    return 'dangerous'
  }

  validateArgs(toolName: string, args: unknown): { valid: boolean; error?: string } {
    const parsed = McpToolProvider.parseToolName(toolName)
    if (!parsed) {
      return { valid: false, error: 'Invalid MCP tool name' }
    }

    const server = this.getServer(parsed.serverId)
    if (!server) {
      return { valid: false, error: `MCP server ${parsed.serverId} not found` }
    }

    const tool = server.tools.find(t => t.name === parsed.toolName)
    if (!tool) {
      return { valid: false, error: `Tool ${parsed.toolName} not found on server ${parsed.serverId}` }
    }

    // 基本类型检查
    if (args !== null && typeof args !== 'object') {
      return { valid: false, error: 'Arguments must be an object' }
    }

    // 检查必填参数
    const required = tool.inputSchema.required || []
    const argObj = (args || {}) as Record<string, unknown>
    
    for (const key of required) {
      if (!(key in argObj)) {
        return { valid: false, error: `Missing required parameter: ${key}` }
      }
    }

    return { valid: true }
  }

  async execute(
    toolName: string,
    args: Record<string, unknown>,
    _context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const parsed = McpToolProvider.parseToolName(toolName)
    if (!parsed) {
      return {
        success: false,
        result: '',
        error: `Invalid MCP tool name: ${toolName}`,
      }
    }

    const { serverId, toolName: actualToolName } = parsed

    logger.agent.info(`[McpToolProvider] Executing ${actualToolName} on server ${serverId}`)

    try {
      const result = await mcpService.callTool({
        serverId,
        toolName: actualToolName,
        arguments: args,
      })

      if (!result.success) {
        return {
          success: false,
          result: '',
          error: result.error || 'MCP tool execution failed',
        }
      }

      // 将 MCP 内容转换为字符串结果
      const resultText = this.formatContent(result.content || [])

      return {
        success: !result.isError,
        result: resultText || 'Tool executed successfully',
        error: result.isError ? 'Tool returned an error' : undefined,
      }
    } catch (err: any) {
      logger.agent.error(`[McpToolProvider] Execution failed:`, err)
      return {
        success: false,
        result: '',
        error: err.message,
      }
    }
  }

  // =================== 私有方法 ===================

  private getConnectedServers(): McpServerState[] {
    const servers = useStore.getState().mcpServers
    return servers.filter(s => s.status === 'connected')
  }

  private getServer(serverId: string): McpServerState | undefined {
    return useStore.getState().mcpServers.find(s => s.id === serverId)
  }

  private convertToDefinition(server: McpServerState, tool: McpTool): ToolDefinition {
    const fullName = McpToolProvider.getFullToolName(server.id, tool.name)

    // 转换 inputSchema 到 parameters 格式
    const properties: Record<string, any> = {}
    if (tool.inputSchema.properties) {
      for (const [key, prop] of Object.entries(tool.inputSchema.properties)) {
        properties[key] = {
          type: prop.type,
          description: prop.description || '',
          ...(prop.enum && { enum: prop.enum }),
        }
      }
    }

    return {
      name: fullName,
      description: `[MCP: ${server.config.name}] ${tool.description || tool.name}`,
      parameters: {
        type: 'object',
        properties,
        required: tool.inputSchema.required,
      },
    }
  }

  private formatContent(content: Array<{ type: string; text?: string; mimeType?: string; uri?: string }>): string {
    const parts: string[] = []
    
    for (const item of content) {
      if (item.type === 'text' && item.text) {
        parts.push(item.text)
      } else if (item.type === 'image') {
        parts.push(`[Image: ${item.mimeType || 'unknown'}]`)
      } else if (item.type === 'resource') {
        parts.push(`[Resource: ${item.uri}]`)
      }
    }

    return parts.join('\n').trim()
  }
}

/** MCP 工具提供者单例 */
export const mcpToolProvider = new McpToolProvider()
