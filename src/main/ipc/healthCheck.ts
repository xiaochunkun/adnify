/**
 * Health Check IPC Handlers
 * 在主进程中执行网络请求以避免 CORS 问题
 */

import { ipcMain } from 'electron'
import { logger } from '@shared/utils/Logger'
import { toAppError } from '@shared/utils/errorHandler'

export interface HealthCheckResult {
  provider: string
  status: 'healthy' | 'unhealthy' | 'unknown'
  latency?: number
  error?: string
  checkedAt: Date
}

/**
 * 注册健康检查 IPC handlers
 */
export function registerHealthCheckHandlers() {
  ipcMain.handle('healthCheck:check', async (_, provider: string, apiKey: string, baseUrl?: string, timeout = 10000) => {
    const startTime = Date.now()

    const defaultUrls: Record<string, string> = {
      openai: 'https://api.openai.com/v1',
      anthropic: 'https://api.anthropic.com/v1',
      deepseek: 'https://api.deepseek.com/v1',
      groq: 'https://api.groq.com/openai/v1',
      mistral: 'https://api.mistral.ai/v1',
      ollama: 'http://localhost:11434/v1',
      nvidia: 'https://integrate.api.nvidia.com/v1',
    }

    const url = baseUrl || defaultUrls[provider] || defaultUrls.openai

    try {
      logger.ipc.info(`[HealthCheck] Checking ${provider} at ${url}`)

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      const response = await fetch(`${url}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)
      const latency = Date.now() - startTime

      if (response.ok) {
        logger.ipc.info(`[HealthCheck] ${provider} is healthy (${latency}ms)`)
        const result: HealthCheckResult = {
          provider,
          status: 'healthy',
          latency,
          checkedAt: new Date(),
        }
        return result
      } else {
        logger.ipc.warn(`[HealthCheck] ${provider} returned HTTP ${response.status}`)
        const result: HealthCheckResult = {
          provider,
          status: 'unhealthy',
          latency,
          error: `HTTP ${response.status}`,
          checkedAt: new Date(),
        }
        return result
      }
    } catch (err) {
      const error = toAppError(err)
      logger.ipc.error(`[HealthCheck] ${provider} check failed:`, error.message)
      const result: HealthCheckResult = {
        provider,
        status: 'unhealthy',
        error: error.message || 'Connection failed',
        checkedAt: new Date(),
      }
      return result
    }
  })

  logger.ipc.info('[HealthCheck] Health check handlers registered')
}
