/**
 * Provider 基类
 * 提供通用的错误处理和工具方法
 */

import { logger } from '@shared/utils/Logger'
import { LLMProvider, ChatParams, LLMErrorClass, LLMErrorCode } from '../types'

export abstract class BaseProvider implements LLMProvider {
  protected name: string

  constructor(name: string) {
    this.name = name
  }

  abstract chat(params: ChatParams): Promise<void>

  /**
   * 解析 API 错误，转换为统一的 LLMErrorClass
   */
  protected parseError(error: unknown): LLMErrorClass {
    // 打印完整的原始错误信息用于调试
    logger.system.error(`[${this.name}] Raw error:`, JSON.stringify(error, Object.getOwnPropertyNames(error as object), 2))
    
    const err = error as {
      message?: string
      status?: number
      statusCode?: number
      code?: string
      name?: string
      error?: { message?: string; type?: string }
      body?: unknown
      response?: { body?: unknown }
    }
    
    // 尝试从不同位置提取真实错误信息
    let message = err.message || 'Unknown error'
    if (err.error?.message) {
      message = err.error.message
    }
    if (err.body) {
      logger.system.error(`[${this.name}] Response body:`, err.body)
    }
    
    const status = err.status || err.statusCode

    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      return new LLMErrorClass(
        'Network error: Unable to connect to API',
        LLMErrorCode.NETWORK_ERROR,
        undefined,
        true
      )
    }

    if (err.code === 'ETIMEDOUT' || err.name === 'TimeoutError') {
      return new LLMErrorClass('Request timeout', LLMErrorCode.TIMEOUT, undefined, true)
    }

    if (err.name === 'AbortError') {
      return new LLMErrorClass('Request aborted', LLMErrorCode.ABORTED, undefined, false)
    }

    if (status) {
      switch (status) {
        case 401:
          return new LLMErrorClass('Invalid API key', LLMErrorCode.INVALID_API_KEY, status, false)
        case 429:
          return new LLMErrorClass(
            'Rate limit exceeded. Please try again later.',
            LLMErrorCode.RATE_LIMIT,
            status,
            true
          )
        case 402:
        case 403:
          // 403 可能是多种原因：配额、被封、地区限制等，显示原始消息
          return new LLMErrorClass(
            message.includes('blocked') ? message : `Access denied: ${message}`,
            LLMErrorCode.QUOTA_EXCEEDED,
            status,
            false
          )
        case 404:
          return new LLMErrorClass(
            'Model not found or invalid endpoint',
            LLMErrorCode.MODEL_NOT_FOUND,
            status,
            false
          )
        case 400:
          if (message.includes('context') || message.includes('token')) {
            return new LLMErrorClass(
              'Context length exceeded. Try reducing the conversation history.',
              LLMErrorCode.CONTEXT_LENGTH_EXCEEDED,
              status,
              false
            )
          }
          return new LLMErrorClass(
            `Invalid request: ${message}`,
            LLMErrorCode.INVALID_REQUEST,
            status,
            false
          )
        case 500:
        case 502:
        case 503:
          return new LLMErrorClass('Server error. Please try again.', LLMErrorCode.UNKNOWN, status, true)
      }
    }

    return new LLMErrorClass(message, LLMErrorCode.UNKNOWN, status, false, error)
  }

  /**
   * 日志输出
   */
  protected log(level: 'info' | 'warn' | 'error', message: string, data?: unknown) {
    const prefix = `[${this.name}]`
    switch (level) {
      case 'info':
        logger.system.info(prefix, message, data || '')
        break
      case 'warn':
        logger.system.warn(prefix, message, data || '')
        break
      case 'error':
        logger.system.error(prefix, message, data || '')
        break
    }
  }
}
