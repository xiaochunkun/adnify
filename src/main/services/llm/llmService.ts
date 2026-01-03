/**
 * LLM 服务
 * 统一管理 LLM Provider，处理消息发送和事件分发
 * 
 * 路由规则：
 * 1. 内置 Provider (openai/anthropic/gemini) → 使用对应的原生 Provider
 * 2. 自定义 Provider → 使用 CustomProvider
 */

import { logger } from '@shared/utils/Logger'
import { BrowserWindow } from 'electron'
import { OpenAIProvider } from './providers/openai'
import { AnthropicProvider } from './providers/anthropic'
import { GeminiProvider } from './providers/gemini'
import { CustomProvider } from './providers/custom'
import { LLMProvider, LLMMessage, LLMConfig, ToolDefinition, LLMErrorCode } from './types'

// 内置 Provider ID
const BUILTIN_PROVIDER_IDS = ['openai', 'anthropic', 'gemini']

interface ProviderCacheEntry {
  provider: LLMProvider
  lastUsed: number
  useCount: number
  configHash: string
}

const CACHE_TTL_MS = 30 * 60 * 1000
const CACHE_MAX_SIZE = 10
const CACHE_CLEANUP_INTERVAL_MS = 5 * 60 * 1000

export class LLMService {
  private window: BrowserWindow
  private providerCache: Map<string, ProviderCacheEntry> = new Map()
  private currentAbortController: AbortController | null = null
  private cleanupTimer: NodeJS.Timeout | null = null

  constructor(window: BrowserWindow) {
    this.window = window
    this.startCacheCleanup()
  }

  private startCacheCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredProviders()
    }, CACHE_CLEANUP_INTERVAL_MS)
  }

  private cleanupExpiredProviders(): void {
    const now = Date.now()
    const expiredKeys: string[] = []

    for (const [key, entry] of this.providerCache) {
      if (now - entry.lastUsed > CACHE_TTL_MS) {
        expiredKeys.push(key)
      }
    }

    for (const key of expiredKeys) {
      this.providerCache.delete(key)
    }

    if (this.providerCache.size > CACHE_MAX_SIZE) {
      const entries = Array.from(this.providerCache.entries())
        .sort((a, b) => a[1].useCount - b[1].useCount)

      const toRemove = entries.slice(0, this.providerCache.size - CACHE_MAX_SIZE)
      for (const [key] of toRemove) {
        this.providerCache.delete(key)
      }
    }
  }

  private generateConfigHash(config: LLMConfig): string {
    const relevantConfig = {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      timeout: config.timeout,
    }
    return JSON.stringify(relevantConfig)
  }

  private getProviderKey(config: LLMConfig): string {
    const providerId = config.provider
    const isBuiltin = BUILTIN_PROVIDER_IDS.includes(providerId)
    return `${isBuiltin ? '' : 'custom:'}${providerId}:${config.baseUrl || 'default'}`
  }

  /**
   * 获取或创建 Provider 实例
   * 
   * 路由规则：
   * 1. provider = 'anthropic' → AnthropicProvider
   * 2. provider = 'gemini' → GeminiProvider
   * 3. provider = 'openai' → OpenAIProvider
   * 4. 其他 → CustomProvider
   */
  private getProvider(config: LLMConfig): LLMProvider {
    const key = this.getProviderKey(config)
    const configHash = this.generateConfigHash(config)
    const cached = this.providerCache.get(key)

    if (cached && cached.configHash === configHash) {
      cached.lastUsed = Date.now()
      cached.useCount++
      return cached.provider
    }

    if (cached && cached.configHash !== configHash) {
      this.providerCache.delete(key)
    }

    let provider: LLMProvider
    const providerId = config.provider

    // 路由到对应的 Provider 实现（统一传递完整 config）
    switch (providerId) {
      case 'anthropic':
        provider = new AnthropicProvider(config)
        break
      case 'gemini':
        provider = new GeminiProvider(config)
        break
      case 'openai':
        provider = new OpenAIProvider(config)
        break
      default:
        // 自定义 Provider
        if (!config.adapterConfig) {
          logger.system.warn('[LLMService] Custom provider without adapterConfig, using OpenAI adapter')
        }
        provider = new CustomProvider(
          config.adapterConfig!,
          config.apiKey,
          config.baseUrl || '',
          config.timeout
        )
        break
    }

    this.providerCache.set(key, {
      provider,
      lastUsed: Date.now(),
      useCount: 1,
      configHash,
    })

    return provider
  }

  invalidateProvider(providerId: string): void {
    const keysToDelete: string[] = []
    for (const key of this.providerCache.keys()) {
      if (key.includes(providerId)) {
        keysToDelete.push(key)
      }
    }
    for (const key of keysToDelete) {
      this.providerCache.delete(key)
    }
  }

  invalidateAllProviders(): void {
    this.providerCache.clear()
  }

  async sendMessage(params: {
    config: LLMConfig
    messages: LLMMessage[]
    tools?: ToolDefinition[]
    systemPrompt?: string
  }) {
    const { config, messages, tools, systemPrompt } = params

    logger.system.info('[LLMService] sendMessage', {
      provider: config.provider,
      model: config.model,
      messageCount: messages.length,
      hasTools: !!tools?.length,
    })

    this.currentAbortController = new AbortController()

    try {
      const provider = this.getProvider(config)

      await provider.chat({
        model: config.model,
        messages,
        tools,
        systemPrompt,
        maxTokens: config.maxTokens,
        temperature: config.temperature,
        topP: config.topP,
        signal: this.currentAbortController.signal,
        adapterConfig: config.adapterConfig,

        onStream: (chunk) => {
          if (!this.window.isDestroyed()) {
            try {
              this.window.webContents.send('llm:stream', chunk)
            } catch {
              // 忽略窗口已销毁的错误
            }
          }
        },

        onToolCall: (toolCall) => {
          if (!this.window.isDestroyed()) {
            try {
              this.window.webContents.send('llm:toolCall', toolCall)
            } catch {
              // 忽略窗口已销毁的错误
            }
          }
        },

        onComplete: (result) => {
          if (!this.window.isDestroyed()) {
            try {
              this.window.webContents.send('llm:done', result)
            } catch {
              // 忽略窗口已销毁的错误
            }
          }
        },

        onError: (error) => {
          if (error.code !== LLMErrorCode.ABORTED) {
            logger.system.error('[LLMService] Error', { code: error.code, message: error.message })
          }
          if (!this.window.isDestroyed()) {
            try {
              this.window.webContents.send('llm:error', {
                message: error.message,
                code: error.code,
                retryable: error.retryable,
              })
            } catch {
              // 忽略窗口已销毁的错误
            }
          }
        },
      })
    } catch (error: unknown) {
      const err = error as { name?: string; message?: string }
      if (err.name !== 'AbortError') {
        logger.system.error('[LLMService] Uncaught error:', error)
        if (!this.window.isDestroyed()) {
          try {
            this.window.webContents.send('llm:error', {
              message: err.message || 'Unknown error',
              code: LLMErrorCode.UNKNOWN,
              retryable: false,
            })
          } catch {
            // 忽略窗口已销毁的错误
          }
        }
      }
    }
  }

  abort() {
    if (this.currentAbortController) {
      this.currentAbortController.abort()
      this.currentAbortController = null
    }
  }

  /**
   * 同步发送消息（不使用流式，直接返回结果）
   * 用于上下文压缩等后台任务
   */
  async sendMessageSync(params: {
    config: LLMConfig
    messages: LLMMessage[]
    tools?: ToolDefinition[]
    systemPrompt?: string
  }): Promise<{ content: string; error?: string }> {
    const { config, messages, tools, systemPrompt } = params

    logger.system.info('[LLMService] sendMessageSync', {
      provider: config.provider,
      model: config.model,
      messageCount: messages.length,
    })

    const abortController = new AbortController()
    let content = ''

    try {
      const provider = this.getProvider(config)

      await provider.chat({
        model: config.model,
        messages,
        tools,
        systemPrompt,
        maxTokens: config.maxTokens || 1000,
        temperature: config.temperature ?? 0.3,
        topP: config.topP,
        signal: abortController.signal,
        adapterConfig: config.adapterConfig,

        onStream: (chunk) => {
          if (chunk.type === 'text' && chunk.content) {
            content += chunk.content
          }
        },

        onToolCall: () => {
          // 压缩任务不需要工具调用
        },

        onComplete: () => {
          // 完成
        },

        onError: (error) => {
          logger.system.error('[LLMService] Sync error:', error)
          throw new Error(error.message)
        },
      })

      return { content }
    } catch (error: unknown) {
      const err = error as { message?: string }
      logger.system.error('[LLMService] sendMessageSync error:', error)
      return { content: '', error: err.message || 'Unknown error' }
    }
  }

  clearProviders() {
    this.providerCache.clear()
  }

  destroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
    this.providerCache.clear()
  }

  getCacheStats(): { size: number; entries: Array<{ key: string; useCount: number; lastUsed: number }> } {
    return {
      size: this.providerCache.size,
      entries: Array.from(this.providerCache.entries()).map(([key, entry]) => ({
        key,
        useCount: entry.useCount,
        lastUsed: entry.lastUsed,
      })),
    }
  }
}
