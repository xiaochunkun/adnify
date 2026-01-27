/**
 * errorHandler 单元测试
 */

import { describe, it, expect } from 'vitest'
import { 
  handleError, 
  AppError, 
  ErrorCode,
  getUserFriendlyMessage,
  success,
  failure,
  wrapAsync
} from '@shared/utils/errorHandler'

describe('errorHandler', () => {
  describe('handleError', () => {
    it('should return AppError as-is', () => {
      const appError = new AppError('Test error', ErrorCode.FILE_NOT_FOUND)
      const result = handleError(appError)
      
      expect(result).toBe(appError)
      expect(result.code).toBe(ErrorCode.FILE_NOT_FOUND)
    })

    it('should convert Error to AppError', () => {
      const error = new Error('Test error')
      const result = handleError(error)
      
      expect(result).toBeInstanceOf(AppError)
      expect(result.message).toBe('Test error')
      expect(result.code).toBe(ErrorCode.UNKNOWN_ERROR)
    })

    it('should convert string to AppError', () => {
      const result = handleError('String error')
      
      expect(result).toBeInstanceOf(AppError)
      expect(result.message).toBe('String error')
      expect(result.code).toBe(ErrorCode.UNKNOWN_ERROR)
    })

    it('should handle unknown types', () => {
      const result = handleError({ foo: 'bar' })
      
      expect(result).toBeInstanceOf(AppError)
      expect(result.message).toBe('An unknown error occurred')
      expect(result.code).toBe(ErrorCode.UNKNOWN_ERROR)
    })

    it('should map ENOENT to FILE_NOT_FOUND', () => {
      const error = Object.assign(new Error('File not found'), { code: 'ENOENT' })
      const result = handleError(error)
      
      expect(result.code).toBe(ErrorCode.FILE_NOT_FOUND)
      expect(result.retryable).toBe(false)
    })

    it('should map EACCES to FILE_ACCESS_DENIED', () => {
      const error = Object.assign(new Error('Permission denied'), { code: 'EACCES' })
      const result = handleError(error)
      
      expect(result.code).toBe(ErrorCode.FILE_ACCESS_DENIED)
      expect(result.retryable).toBe(false)
    })

    it('should map ETIMEDOUT to TIMEOUT_ERROR', () => {
      const error = Object.assign(new Error('Timeout'), { code: 'ETIMEDOUT' })
      const result = handleError(error)
      
      expect(result.code).toBe(ErrorCode.TIMEOUT_ERROR)
      expect(result.retryable).toBe(true)
    })

    it('should map ECONNREFUSED to NETWORK_ERROR', () => {
      const error = Object.assign(new Error('Connection refused'), { code: 'ECONNREFUSED' })
      const result = handleError(error)
      
      expect(result.code).toBe(ErrorCode.NETWORK_ERROR)
      expect(result.retryable).toBe(true)
    })
  })

  describe('AppError', () => {
    it('should create AppError with all properties', () => {
      const error = new AppError(
        'Test message',
        ErrorCode.API_KEY_INVALID,
        { key: 'value' },
        true
      )
      
      expect(error.message).toBe('Test message')
      expect(error.code).toBe(ErrorCode.API_KEY_INVALID)
      expect(error.details).toEqual({ key: 'value' })
      expect(error.retryable).toBe(true)
      expect(error.name).toBe('AppError')
    })

    it('should have default values', () => {
      const error = new AppError('Test')
      
      expect(error.code).toBe(ErrorCode.UNKNOWN_ERROR)
      expect(error.details).toBeUndefined()
      expect(error.retryable).toBe(false)
    })

    it('should serialize to JSON', () => {
      const error = new AppError('Test', ErrorCode.FILE_NOT_FOUND, { path: '/test' })
      const json = error.toJSON()
      
      expect(json.name).toBe('AppError')
      expect(json.message).toBe('Test')
      expect(json.code).toBe(ErrorCode.FILE_NOT_FOUND)
      expect(json.details).toEqual({ path: '/test' })
      expect(json.stack).toBeDefined()
    })
  })

  describe('getUserFriendlyMessage', () => {
    it('should return English message by default', () => {
      const error = new AppError('Technical error', ErrorCode.FILE_NOT_FOUND)
      const message = getUserFriendlyMessage(error, 'en')
      
      expect(message).toBe('File not found. Please check the file path.')
    })

    it('should return Chinese message', () => {
      const error = new AppError('Technical error', ErrorCode.FILE_NOT_FOUND)
      const message = getUserFriendlyMessage(error, 'zh')
      
      expect(message).toBe('文件不存在，请检查文件路径')
    })

    it('should return original message for unknown error code', () => {
      const error = new AppError('Custom error', 'CUSTOM_CODE' as ErrorCode)
      const message = getUserFriendlyMessage(error, 'en')
      
      expect(message).toBe('Custom error')
    })

    it('should handle all error codes', () => {
      const codes = [
        ErrorCode.UNKNOWN_ERROR,
        ErrorCode.NETWORK_ERROR,
        ErrorCode.TIMEOUT_ERROR,
        ErrorCode.FILE_NOT_FOUND,
        ErrorCode.FILE_ACCESS_DENIED,
        ErrorCode.FILE_READ_ERROR,
        ErrorCode.FILE_WRITE_ERROR,
        ErrorCode.API_KEY_INVALID,
        ErrorCode.API_RATE_LIMIT,
        ErrorCode.API_REQUEST_FAILED,
        ErrorCode.LSP_NOT_INITIALIZED,
        ErrorCode.LSP_REQUEST_FAILED,
        ErrorCode.MCP_NOT_INITIALIZED,
        ErrorCode.MCP_SERVER_ERROR,
        ErrorCode.MCP_TOOL_ERROR,
      ]

      codes.forEach(code => {
        const error = new AppError('Test', code)
        const enMessage = getUserFriendlyMessage(error, 'en')
        const zhMessage = getUserFriendlyMessage(error, 'zh')
        
        expect(enMessage).toBeTruthy()
        expect(zhMessage).toBeTruthy()
        expect(enMessage).not.toBe(zhMessage) // Different languages
      })
    })
  })

  describe('success', () => {
    it('should create success result', () => {
      const result = success({ value: 42 })
      
      expect(result.success).toBe(true)
      expect(result.data).toEqual({ value: 42 })
    })

    it('should handle different data types', () => {
      expect(success('string').data).toBe('string')
      expect(success(123).data).toBe(123)
      expect(success(null).data).toBe(null)
      expect(success(undefined).data).toBe(undefined)
    })
  })

  describe('failure', () => {
    it('should create failure result', () => {
      const error = new AppError('Test error', ErrorCode.FILE_NOT_FOUND)
      const result = failure(error)
      
      expect(result.success).toBe(false)
      expect(result.error).toBe(error)
    })
  })

  describe('wrapAsync', () => {
    it('should return result on success', async () => {
      const fn = async () => 'success'
      const wrapped = wrapAsync(fn)
      const result = await wrapped()
      
      expect(result).toBe('success')
    })

    it('should return failure on error', async () => {
      const fn = async () => {
        throw new Error('Test error')
      }
      const wrapped = wrapAsync(fn)
      const result = await wrapped()
      
      expect(result).toHaveProperty('success', false)
      if ('error' in result) {
        expect(result.error).toBeInstanceOf(AppError)
        expect(result.error.message).toBe('Test error')
      }
    })

    it('should preserve function arguments', async () => {
      const fn = async (a: number, b: number) => a + b
      const wrapped = wrapAsync(fn)
      const result = await wrapped(2, 3)
      
      expect(result).toBe(5)
    })

    it('should handle AppError', async () => {
      const fn = async () => {
        throw new AppError('Custom error', ErrorCode.API_KEY_INVALID)
      }
      const wrapped = wrapAsync(fn)
      const result = await wrapped()
      
      if ('error' in result) {
        expect(result.error.code).toBe(ErrorCode.API_KEY_INVALID)
      }
    })
  })
})
