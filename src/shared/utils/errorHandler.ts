/**
 * 统一的错误处理工具
 * 提供类型安全的错误处理和用户友好的错误消息
 */

export enum ErrorCode {
  // 通用错误
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  
  // 文件系统错误
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_ACCESS_DENIED = 'FILE_ACCESS_DENIED',
  FILE_READ_ERROR = 'FILE_READ_ERROR',
  FILE_WRITE_ERROR = 'FILE_WRITE_ERROR',
  
  // API 错误
  API_KEY_INVALID = 'API_KEY_INVALID',
  API_RATE_LIMIT = 'API_RATE_LIMIT',
  API_REQUEST_FAILED = 'API_REQUEST_FAILED',
  
  // LSP 错误
  LSP_NOT_INITIALIZED = 'LSP_NOT_INITIALIZED',
  LSP_REQUEST_FAILED = 'LSP_REQUEST_FAILED',
  
  // MCP 错误
  MCP_NOT_INITIALIZED = 'MCP_NOT_INITIALIZED',
  MCP_SERVER_ERROR = 'MCP_SERVER_ERROR',
  MCP_TOOL_ERROR = 'MCP_TOOL_ERROR',
}

export class AppError extends Error {
  constructor(
    message: string,
    public code: ErrorCode = ErrorCode.UNKNOWN_ERROR,
    public details?: unknown,
    public retryable: boolean = false
  ) {
    super(message)
    this.name = 'AppError'
    Error.captureStackTrace(this, AppError)
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      retryable: this.retryable,
      stack: this.stack,
    }
  }
}

/**
 * 将未知错误转换为 AppError
 */
export function handleError(error: unknown): AppError {
  // 已经是 AppError
  if (error instanceof AppError) {
    return error
  }

  // 标准 Error 对象
  if (error instanceof Error) {
    // 检查是否是 Node.js 系统错误
    const nodeError = error as NodeJS.ErrnoException
    if (nodeError.code) {
      return mapNodeError(nodeError)
    }
    
    return new AppError(error.message, ErrorCode.UNKNOWN_ERROR, error)
  }

  // 字符串错误
  if (typeof error === 'string') {
    return new AppError(error, ErrorCode.UNKNOWN_ERROR)
  }

  // 其他类型
  return new AppError(
    'An unknown error occurred',
    ErrorCode.UNKNOWN_ERROR,
    error
  )
}

/**
 * 映射 Node.js 系统错误到 AppError
 */
function mapNodeError(error: NodeJS.ErrnoException): AppError {
  const code = error.code || ''
  
  switch (code) {
    case 'ENOENT':
      return new AppError(
        'File or directory not found',
        ErrorCode.FILE_NOT_FOUND,
        error,
        false
      )
    
    case 'EACCES':
    case 'EPERM':
      return new AppError(
        'Permission denied',
        ErrorCode.FILE_ACCESS_DENIED,
        error,
        false
      )
    
    case 'ETIMEDOUT':
    case 'ESOCKETTIMEDOUT':
      return new AppError(
        'Operation timed out',
        ErrorCode.TIMEOUT_ERROR,
        error,
        true
      )
    
    case 'ECONNREFUSED':
    case 'ENOTFOUND':
    case 'ENETUNREACH':
      return new AppError(
        'Network connection failed',
        ErrorCode.NETWORK_ERROR,
        error,
        true
      )
    
    default:
      return new AppError(
        error.message || 'System error occurred',
        ErrorCode.UNKNOWN_ERROR,
        error,
        false
      )
  }
}

/**
 * 获取用户友好的错误消息
 */
export function getUserFriendlyMessage(error: AppError, language: 'en' | 'zh' = 'en'): string {
  const messages: Record<ErrorCode, { en: string; zh: string }> = {
    [ErrorCode.UNKNOWN_ERROR]: {
      en: 'An unexpected error occurred',
      zh: '发生了未知错误'
    },
    [ErrorCode.NETWORK_ERROR]: {
      en: 'Network connection failed. Please check your internet connection.',
      zh: '网络连接失败，请检查您的网络连接'
    },
    [ErrorCode.TIMEOUT_ERROR]: {
      en: 'Operation timed out. Please try again.',
      zh: '操作超时，请重试'
    },
    [ErrorCode.FILE_NOT_FOUND]: {
      en: 'File not found. Please check the file path.',
      zh: '文件不存在，请检查文件路径'
    },
    [ErrorCode.FILE_ACCESS_DENIED]: {
      en: 'Permission denied. Please check file permissions.',
      zh: '没有权限访问该文件，请检查文件权限'
    },
    [ErrorCode.FILE_READ_ERROR]: {
      en: 'Failed to read file',
      zh: '读取文件失败'
    },
    [ErrorCode.FILE_WRITE_ERROR]: {
      en: 'Failed to write file',
      zh: '写入文件失败'
    },
    [ErrorCode.API_KEY_INVALID]: {
      en: 'Invalid API key. Please check your settings.',
      zh: 'API Key 无效，请在设置中重新配置'
    },
    [ErrorCode.API_RATE_LIMIT]: {
      en: 'API rate limit exceeded. Please try again later.',
      zh: 'API 请求频率超限，请稍后重试'
    },
    [ErrorCode.API_REQUEST_FAILED]: {
      en: 'API request failed',
      zh: 'API 请求失败'
    },
    [ErrorCode.LSP_NOT_INITIALIZED]: {
      en: 'Language server not initialized',
      zh: '语言服务器未初始化'
    },
    [ErrorCode.LSP_REQUEST_FAILED]: {
      en: 'Language server request failed',
      zh: '语言服务器请求失败'
    },
    [ErrorCode.MCP_NOT_INITIALIZED]: {
      en: 'MCP not initialized',
      zh: 'MCP 未初始化'
    },
    [ErrorCode.MCP_SERVER_ERROR]: {
      en: 'MCP server error',
      zh: 'MCP 服务器错误'
    },
    [ErrorCode.MCP_TOOL_ERROR]: {
      en: 'MCP tool execution failed',
      zh: 'MCP 工具执行失败'
    },
  }

  const message = messages[error.code]?.[language] || error.message
  return message
}

/**
 * 创建结果对象（成功）
 */
export function success<T>(data: T): { success: true; data: T } {
  return { success: true, data }
}

/**
 * 创建结果对象（失败）
 */
export function failure(error: AppError): { success: false; error: AppError } {
  return { success: false, error }
}

/**
 * 包装异步函数，自动处理错误
 */
export function wrapAsync<T extends (...args: any[]) => Promise<any>>(
  fn: T
): (...args: Parameters<T>) => Promise<ReturnType<T> | { success: false; error: AppError }> {
  return async (...args: Parameters<T>) => {
    try {
      const result = await fn(...args)
      return result
    } catch (err) {
      const error = handleError(err)
      return failure(error)
    }
  }
}
