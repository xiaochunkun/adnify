/**
 * MCP 客户端
 * 负责与单个 MCP 服务器的通信
 */

import { spawn } from 'child_process'
import { EventEmitter } from 'events'
import { logger } from '@shared/utils/Logger'
import type { McpServerConfig, McpTool, McpResource, McpPrompt, McpServerStatus, McpContent } from '@shared/types/mcp'
import type {
  McpClientState,
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
  McpInitializeResult,
  McpToolsListResult,
  McpResourcesListResult,
  McpPromptsListResult,
  McpToolCallResponse,
} from './types'

const REQUEST_TIMEOUT = 30000 // 30 秒超时

export class McpClient extends EventEmitter {
  private state: McpClientState

  constructor(config: McpServerConfig) {
    super()
    this.state = {
      config,
      process: null,
      status: 'disconnected',
      tools: [],
      resources: [],
      prompts: [],
      requestId: 0,
      pendingRequests: new Map(),
      messageBuffer: '',
    }
  }

  get id(): string {
    return this.state.config.id
  }

  get status(): McpServerStatus {
    return this.state.status
  }

  get tools(): McpTool[] {
    return this.state.tools
  }

  get resources(): McpResource[] {
    return this.state.resources
  }

  get prompts(): McpPrompt[] {
    return this.state.prompts
  }

  get error(): string | undefined {
    return this.state.error
  }

  /** 连接到 MCP 服务器 */
  async connect(): Promise<void> {
    if (this.state.status === 'connected' || this.state.status === 'connecting') {
      return
    }

    this.updateStatus('connecting')
    const { config } = this.state

    try {
      // 创建一个 Promise 来检测进程是否过早退出
      let processExited = false
      let exitError: Error | null = null

      // 启动子进程
      const proc = spawn(config.command, config.args || [], {
        cwd: config.cwd,
        env: { ...process.env, ...config.env },
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
      })

      this.state.process = proc

      // 收集 stderr 用于错误报告
      let stderrBuffer = ''

      // 处理 stdout（JSON-RPC 消息）
      proc.stdout?.on('data', (data: Buffer) => {
        this.handleStdout(data.toString())
      })

      // 处理 stderr（日志）
      proc.stderr?.on('data', (data: Buffer) => {
        const msg = data.toString().trim()
        stderrBuffer += msg + '\n'
        logger.mcp?.warn(`[MCP:${config.id}] stderr: ${msg}`)
      })

      // 处理进程退出
      proc.on('exit', (code, signal) => {
        logger.mcp?.info(`[MCP:${config.id}] Process exited: code=${code}, signal=${signal}`)
        processExited = true
        if (this.state.status === 'connecting') {
          // 进程在连接过程中退出
          exitError = new Error(
            `Process exited during connection (code=${code})${stderrBuffer ? ': ' + stderrBuffer.trim() : ''}`
          )
        }
        this.handleDisconnect()
      })

      proc.on('error', (err) => {
        logger.mcp?.error(`[MCP:${config.id}] Process error:`, err)
        processExited = true
        exitError = err
        this.updateStatus('error', err.message)
      })

      // 等待一小段时间，检查进程是否立即退出
      await new Promise(resolve => setTimeout(resolve, 100))
      
      if (processExited) {
        throw exitError || new Error('Process exited immediately after spawn')
      }

      // 初始化 MCP 协议
      await this.initialize()
      
      // 再次检查进程状态
      if (processExited || !this.state.process?.stdin?.writable) {
        throw exitError || new Error('Process exited during initialization')
      }
      
      // 获取能力列表
      await this.refreshCapabilities()

      // 最终检查
      if (processExited) {
        throw exitError || new Error('Process exited after initialization')
      }

      this.updateStatus('connected')
      logger.mcp?.info(`[MCP:${config.id}] Connected successfully`)
    } catch (err: any) {
      logger.mcp?.error(`[MCP:${config.id}] Connection failed:`, err)
      this.updateStatus('error', err.message)
      this.cleanup()
      throw err
    }
  }

  /** 断开连接 */
  async disconnect(): Promise<void> {
    if (this.state.status === 'disconnected') {
      return
    }

    logger.mcp?.info(`[MCP:${this.id}] Disconnecting...`)
    this.cleanup()
    this.updateStatus('disconnected')
  }

  /** 调用工具 */
  async callTool(toolName: string, args: Record<string, unknown>): Promise<{ content: McpContent[]; isError?: boolean }> {
    this.ensureConnected()

    const response = await this.sendRequest<McpToolCallResponse>('tools/call', {
      name: toolName,
      arguments: args,
    })

    return {
      content: response.content.map(c => ({
        type: c.type,
        text: c.text,
        data: c.data,
        mimeType: c.mimeType,
      })),
      isError: response.isError,
    }
  }

  /** 读取资源 */
  async readResource(uri: string): Promise<{ contents: Array<{ uri: string; mimeType?: string; text?: string; blob?: string }> }> {
    this.ensureConnected()
    return this.sendRequest('resources/read', { uri })
  }

  /** 获取提示 */
  async getPrompt(name: string, args?: Record<string, string>): Promise<{
    description?: string
    messages: Array<{ role: 'user' | 'assistant'; content: McpContent }>
  }> {
    this.ensureConnected()
    return this.sendRequest('prompts/get', { name, arguments: args })
  }

  /** 刷新能力列表 */
  async refreshCapabilities(): Promise<void> {
    // 允许在 connecting 状态下调用（初始化时）
    if (this.state.status !== 'connected' && this.state.status !== 'connecting') {
      throw new Error(`MCP server ${this.id} is not connected`)
    }

    // 确保进程可用
    if (!this.state.process?.stdin?.writable) {
      throw new Error(`MCP server ${this.id} process is not available`)
    }

    try {
      // 获取工具列表
      const toolsResult = await this.sendRequest<McpToolsListResult>('tools/list', {})
      this.state.tools = toolsResult.tools || []
      this.emit('toolsUpdated', this.state.tools)

      // 获取资源列表
      try {
        const resourcesResult = await this.sendRequest<McpResourcesListResult>('resources/list', {})
        this.state.resources = resourcesResult.resources || []
        this.emit('resourcesUpdated', this.state.resources)
      } catch {
        // 资源可能不被支持
        this.state.resources = []
      }

      // 获取提示列表
      try {
        const promptsResult = await this.sendRequest<McpPromptsListResult>('prompts/list', {})
        this.state.prompts = promptsResult.prompts || []
        this.emit('promptsUpdated', this.state.prompts)
      } catch {
        // 提示可能不被支持
        this.state.prompts = []
      }

      logger.mcp?.info(`[MCP:${this.id}] Capabilities: ${this.state.tools.length} tools, ${this.state.resources.length} resources, ${this.state.prompts.length} prompts`)
    } catch (err: any) {
      logger.mcp?.error(`[MCP:${this.id}] Failed to refresh capabilities:`, err)
      throw err
    }
  }

  // =================== 私有方法 ===================

  private async initialize(): Promise<void> {
    const result = await this.sendRequest<McpInitializeResult>('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {
        roots: { listChanged: true },
      },
      clientInfo: {
        name: 'adnify',
        version: '1.0.0',
      },
    })

    logger.mcp?.info(`[MCP:${this.id}] Initialized: ${result.serverInfo.name} v${result.serverInfo.version}`)

    // 发送 initialized 通知
    this.sendNotification('notifications/initialized', {})
  }

  private handleStdout(data: string): void {
    this.state.messageBuffer += data

    // 按行分割处理
    const lines = this.state.messageBuffer.split('\n')
    this.state.messageBuffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const message = JSON.parse(line)
        this.handleMessage(message)
      } catch (err) {
        logger.mcp?.warn(`[MCP:${this.id}] Invalid JSON: ${line}`)
      }
    }
  }

  private handleMessage(message: JsonRpcResponse | JsonRpcNotification): void {
    // 响应消息
    if ('id' in message && message.id !== undefined) {
      const pending = this.state.pendingRequests.get(message.id)
      if (pending) {
        clearTimeout(pending.timeout)
        this.state.pendingRequests.delete(message.id)

        if (message.error) {
          pending.reject(new Error(message.error.message))
        } else {
          pending.resolve(message.result)
        }
      }
      return
    }

    // 通知消息
    const notification = message as JsonRpcNotification
    this.handleNotification(notification)
  }

  private handleNotification(notification: JsonRpcNotification): void {
    switch (notification.method) {
      case 'notifications/tools/list_changed':
        this.refreshCapabilities().catch(() => {})
        break
      case 'notifications/resources/list_changed':
        this.refreshCapabilities().catch(() => {})
        break
      case 'notifications/prompts/list_changed':
        this.refreshCapabilities().catch(() => {})
        break
      default:
        logger.mcp?.debug(`[MCP:${this.id}] Unknown notification: ${notification.method}`)
    }
  }

  private sendRequest<T>(method: string, params: Record<string, unknown>): Promise<T> {
    return new Promise((resolve, reject) => {
      // 检查进程是否可用
      if (!this.state.process) {
        reject(new Error('MCP server process not started'))
        return
      }
      
      if (!this.state.process.stdin?.writable) {
        reject(new Error('MCP server stdin not writable'))
        return
      }

      // 检查进程是否已退出
      if (this.state.process.exitCode !== null) {
        reject(new Error(`MCP server process has exited (code=${this.state.process.exitCode})`))
        return
      }

      const id = ++this.state.requestId
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        id,
        method,
        params,
      }

      const timeout = setTimeout(() => {
        this.state.pendingRequests.delete(id)
        reject(new Error(`Request timeout: ${method}`))
      }, REQUEST_TIMEOUT)

      this.state.pendingRequests.set(id, { resolve, reject, timeout })

      try {
        const message = JSON.stringify(request) + '\n'
        this.state.process.stdin.write(message, (err) => {
          if (err) {
            this.state.pendingRequests.delete(id)
            clearTimeout(timeout)
            reject(new Error(`Failed to write to MCP server: ${err.message}`))
          }
        })
      } catch (err: any) {
        this.state.pendingRequests.delete(id)
        clearTimeout(timeout)
        reject(new Error(`Failed to send request: ${err.message}`))
      }
    })
  }

  private sendNotification(method: string, params: Record<string, unknown>): void {
    if (!this.state.process?.stdin?.writable) {
      return
    }

    const notification: JsonRpcNotification = {
      jsonrpc: '2.0',
      method,
      params,
    }

    const message = JSON.stringify(notification) + '\n'
    this.state.process.stdin.write(message)
  }

  private handleDisconnect(): void {
    this.cleanup()
    this.updateStatus('disconnected')
    this.emit('disconnected')
  }

  private cleanup(): void {
    // 清理待处理请求
    for (const [, pending] of this.state.pendingRequests) {
      clearTimeout(pending.timeout)
      pending.reject(new Error('Connection closed'))
    }
    this.state.pendingRequests.clear()

    // 终止进程
    if (this.state.process) {
      this.state.process.kill()
      this.state.process = null
    }

    this.state.messageBuffer = ''
  }

  private updateStatus(status: McpServerStatus, error?: string): void {
    this.state.status = status
    this.state.error = error
    this.emit('statusChanged', { status, error })
  }

  private ensureConnected(): void {
    if (this.state.status !== 'connected') {
      throw new Error(`MCP server ${this.id} is not connected`)
    }
  }
}