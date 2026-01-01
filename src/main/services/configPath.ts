/**
 * 统一配置路径管理
 * 管理用户级配置文件的存储位置
 */

import * as path from 'path'
import { app } from 'electron'
import Store from 'electron-store'

// Bootstrap store 用于存储配置路径本身（存在默认位置）
const bootstrapStore = new Store({ name: 'bootstrap' })

/**
 * 获取用户配置目录
 * 优先使用用户自定义路径，否则使用默认路径
 */
export function getUserConfigDir(): string {
  const customPath = bootstrapStore.get('customConfigPath') as string | undefined
  if (customPath) {
    return customPath
  }
  return app.getPath('userData')
}

/**
 * 设置用户配置目录
 */
export function setUserConfigDir(newPath: string): void {
  bootstrapStore.set('customConfigPath', newPath)
}

/**
 * 获取配置文件路径
 * @param filename 配置文件名，如 'config.json', 'mcp.json'
 * @param subdir 可选的子目录，如 'settings'
 */
export function getConfigFilePath(filename: string, subdir?: string): string {
  const baseDir = getUserConfigDir()
  if (subdir) {
    return path.join(baseDir, subdir, filename)
  }
  return path.join(baseDir, filename)
}

/**
 * 获取工作区配置文件路径
 * @param workspaceRoot 工作区根目录
 * @param filename 配置文件名
 * @param subdir 可选的子目录
 */
export function getWorkspaceConfigFilePath(
  workspaceRoot: string,
  filename: string,
  subdir?: string
): string {
  if (subdir) {
    return path.join(workspaceRoot, '.adnify', subdir, filename)
  }
  return path.join(workspaceRoot, '.adnify', filename)
}

/** 配置文件名常量 */
export const CONFIG_FILES = {
  /** 主配置文件 */
  MAIN: 'config.json',
  /** MCP 配置文件 */
  MCP: 'mcp.json',
  /** 设置子目录 */
  SETTINGS_DIR: 'settings',
} as const
