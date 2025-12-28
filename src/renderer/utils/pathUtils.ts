/**
 * 路径处理工具函数
 * 统一处理跨平台路径操作
 */

import {
  isSensitivePath as sharedIsSensitivePath,
  hasPathTraversal as sharedHasPathTraversal,
} from '@shared/constants'

// ============ 安全验证函数 ============

/**
 * 检查路径是否包含目录遍历攻击
 */
export const hasPathTraversal = sharedHasPathTraversal

/**
 * 检查路径是否为敏感文件/目录
 */
export const isSensitivePath = sharedIsSensitivePath

/**
 * 验证路径是否在工作区内（防止目录遍历）
 */
export function isPathInWorkspace(path: string, workspacePath: string): boolean {
  if (!workspacePath) return false
  
  // 规范化路径
  const normalizedPath = normalizePath(path)
  const normalizedWorkspace = normalizePath(workspacePath)
  
  // 解析相对路径
  const resolvedPath = normalizedPath.startsWith(normalizedWorkspace)
    ? normalizedPath
    : normalizePath(toFullPath(path, workspacePath))
  
  // 检查解析后的路径是否仍在工作区内
  return resolvedPath.startsWith(normalizedWorkspace)
}

/**
 * 安全路径验证结果
 */
export interface PathValidationResult {
  valid: boolean
  error?: string
  sanitizedPath?: string
}

/**
 * 完整的路径安全验证
 */
export function validatePath(
  path: string,
  workspacePath: string | null,
  options?: {
    allowSensitive?: boolean
    allowOutsideWorkspace?: boolean
  }
): PathValidationResult {
  const { allowSensitive = false, allowOutsideWorkspace = false } = options || {}
  
  // 1. 检查空路径
  if (!path || typeof path !== 'string') {
    return { valid: false, error: 'Invalid path: empty or not a string' }
  }
  
  // 2. 检查目录遍历
  if (hasPathTraversal(path)) {
    return { valid: false, error: 'Path traversal detected' }
  }
  
  // 3. 检查敏感路径
  if (!allowSensitive && isSensitivePath(path)) {
    return { valid: false, error: 'Access to sensitive path denied' }
  }
  
  // 4. 检查工作区边界
  if (!allowOutsideWorkspace && workspacePath) {
    if (!isPathInWorkspace(path, workspacePath)) {
      return { valid: false, error: 'Path is outside workspace' }
    }
  }
  
  // 5. 返回清理后的路径
  const sanitizedPath = toFullPath(path, workspacePath)
  return { valid: true, sanitizedPath }
}

// ============ 基础路径函数 ============

/**
 * 检测路径分隔符
 */
export function getPathSeparator(path: string): string {
  return path.includes('\\') ? '\\' : '/'
}

/**
 * 拼接路径
 */
export function joinPath(...parts: string[]): string {
  if (parts.length === 0) return ''
  const sep = getPathSeparator(parts[0])
  return parts
    .filter(Boolean)
    .join(sep)
    .replace(/[/\\]+/g, sep)
}

/**
 * 将相对路径转换为完整路径
 */
export function toFullPath(relativePath: string, workspacePath: string | null): string {
  if (!workspacePath) return relativePath
  // 已经是绝对路径
  if (relativePath.startsWith('/') || /^[a-zA-Z]:/.test(relativePath)) {
    return relativePath
  }
  const sep = getPathSeparator(workspacePath)
  return `${workspacePath}${sep}${relativePath}`
}

/**
 * 将完整路径转换为相对路径
 */
export function toRelativePath(fullPath: string, workspacePath: string | null): string {
  if (!workspacePath) return fullPath
  const normalizedFull = normalizePath(fullPath)
  const normalizedWorkspace = normalizePath(workspacePath)
  if (normalizedFull.startsWith(normalizedWorkspace)) {
    let relative = fullPath.slice(workspacePath.length)
    // 移除开头的分隔符
    if (relative.startsWith('/') || relative.startsWith('\\')) {
      relative = relative.slice(1)
    }
    return relative
  }
  return fullPath
}

/**
 * 规范化路径（用于比较）
 */
export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').toLowerCase()
}

/**
 * 获取文件名
 */
export function getFileName(path: string): string {
  return path.split(/[/\\]/).pop() || ''
}

/**
 * 获取目录路径
 */
export function getDirPath(path: string): string {
  const lastSepIndex = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return lastSepIndex > 0 ? path.substring(0, lastSepIndex) : ''
}

/**
 * 获取文件扩展名
 */
export function getExtension(path: string): string {
  const fileName = getFileName(path)
  const dotIndex = fileName.lastIndexOf('.')
  return dotIndex > 0 ? fileName.slice(dotIndex + 1).toLowerCase() : ''
}

/**
 * 检查路径是否匹配（支持通配符）
 */
export function pathMatches(path: string, pattern: string): boolean {
  const normalizedPath = normalizePath(path)
  const normalizedPattern = normalizePath(pattern)
  
  // 简单的通配符匹配
  if (normalizedPattern.includes('*')) {
    const regex = new RegExp(
      '^' + normalizedPattern.replace(/\*/g, '.*') + '$'
    )
    return regex.test(normalizedPath)
  }
  
  return normalizedPath === normalizedPattern || 
         normalizedPath.endsWith('/' + normalizedPattern)
}

/**
 * 解析 import 路径为实际文件路径
 */
export function resolveImportPath(
  importPath: string,
  currentFilePath: string,
  workspacePath: string
): string {
  const sep = getPathSeparator(currentFilePath)
  const currentDir = getDirPath(currentFilePath)
  
  // 相对路径
  if (importPath.startsWith('./') || importPath.startsWith('../')) {
    const parts = [...currentDir.split(/[/\\]/), ...importPath.split(/[/\\]/)]
    const resolved: string[] = []
    for (const part of parts) {
      if (part === '..') resolved.pop()
      else if (part !== '.' && part !== '') resolved.push(part)
    }
    return resolved.join(sep)
  }
  
  // 别名路径 @/ 或 ~/
  if (importPath.startsWith('@/') || importPath.startsWith('~/')) {
    return joinPath(workspacePath, importPath.slice(2))
  }
  
  // 尝试从 src 目录查找
  if (!importPath.startsWith('/')) {
    return joinPath(workspacePath, 'src', importPath)
  }
  
  return importPath
}
