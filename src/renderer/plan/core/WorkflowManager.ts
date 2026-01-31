/**
 * 工作流管理器
 * 
 * 职责：
 * - 工作流的加载、保存、删除
 * - 版本控制和历史管理
 * - 导入导出功能
 * - 工作流搜索和过滤
 */

import { api } from '@/renderer/services/electronAPI'
import { logger } from '@utils/Logger'
import { PlanValidator } from './PlanValidator'
import type { Workflow, WorkflowMetadata } from '../types/workflow'

export class WorkflowManager {
  private workspacePath: string | null
  private validator: PlanValidator

  constructor(workspacePath: string | null = null) {
    this.workspacePath = workspacePath
    this.validator = new PlanValidator({} as Workflow) // 临时实例
  }

  /**
   * 获取工作流目录路径
   */
  private getWorkflowsDir(): string {
    if (!this.workspacePath) {
      throw new Error('No workspace path set')
    }
    return `${this.workspacePath}/.adnify/workflows`
  }

  /**
   * 加载工作流
   */
  async load(name: string): Promise<Workflow> {
    const dir = this.getWorkflowsDir()
    const filePath = `${dir}/${name}.json`

    try {
      const content = await api.file.read(filePath)
      if (!content) {
        throw new Error(`Workflow not found: ${name}`)
      }

      const workflow: Workflow = JSON.parse(content)

      // 验证工作流
      this.validator = new PlanValidator(workflow)
      const validation = this.validator.validate()

      if (!validation.valid) {
        logger.plan.warn('[WorkflowManager] Workflow has validation errors:', validation.errors)
      }

      logger.plan.info('[WorkflowManager] Loaded workflow:', name)
      return workflow
    } catch (error) {
      logger.plan.error('[WorkflowManager] Failed to load workflow:', error)
      throw error
    }
  }

  /**
   * 保存工作流
   */
  async save(workflow: Workflow): Promise<void> {
    const dir = this.getWorkflowsDir()
    await api.file.ensureDir(dir)

    // 验证工作流
    this.validator = new PlanValidator(workflow)
    const validation = this.validator.validate()

    if (!validation.valid) {
      throw new Error(`Invalid workflow: ${validation.errors.map(e => e.message).join(', ')}`)
    }

    // 更新时间戳
    workflow.updatedAt = Date.now()

    // 生成文件名
    const fileName = this.sanitizeFileName(workflow.name)
    const filePath = `${dir}/${fileName}.json`

    try {
      const content = JSON.stringify(workflow, null, 2)
      await api.file.write(filePath, content)

      logger.plan.info('[WorkflowManager] Saved workflow:', fileName)
    } catch (error) {
      logger.plan.error('[WorkflowManager] Failed to save workflow:', error)
      throw error
    }
  }

  /**
   * 删除工作流
   */
  async delete(name: string): Promise<void> {
    const dir = this.getWorkflowsDir()
    const jsonPath = `${dir}/${name}.json`
    const mdPath = `${dir}/${name}.md`

    try {
      // 删除 JSON 文件
      await api.file.delete(jsonPath)

      // 尝试删除 MD 文件（可能不存在）
      try {
        await api.file.delete(mdPath)
      } catch {
        // 忽略
      }

      logger.plan.info('[WorkflowManager] Deleted workflow:', name)
    } catch (error) {
      logger.plan.error('[WorkflowManager] Failed to delete workflow:', error)
      throw error
    }
  }

  /**
   * 列出所有工作流
   */
  async list(): Promise<WorkflowMetadata[]> {
    const dir = this.getWorkflowsDir()

    try {
      const files = await api.file.readDir(dir)
      if (!files) {
        return []
      }

      const jsonFiles = files.filter(f => f.endsWith('.json'))
      const workflows: WorkflowMetadata[] = []

      for (const file of jsonFiles) {
        try {
          const content = await api.file.read(`${dir}/${file}`)
          if (content) {
            const workflow: Workflow = JSON.parse(content)
            workflows.push({
              author: workflow.metadata?.author,
              tags: workflow.metadata?.tags || [],
              category: workflow.metadata?.category,
              isTemplate: workflow.metadata?.isTemplate || false,
              templateId: workflow.metadata?.templateId,
            })
          }
        } catch (error) {
          logger.plan.warn('[WorkflowManager] Failed to parse workflow:', file, error)
        }
      }

      return workflows
    } catch (error) {
      logger.plan.error('[WorkflowManager] Failed to list workflows:', error)
      return []
    }
  }

  /**
   * 搜索工作流
   */
  async search(query: string): Promise<Workflow[]> {
    const workflows = await this.listAll()
    const lowerQuery = query.toLowerCase()

    return workflows.filter(w =>
      w.name.toLowerCase().includes(lowerQuery) ||
      w.description?.toLowerCase().includes(lowerQuery) ||
      w.metadata?.tags?.some(t => t.toLowerCase().includes(lowerQuery))
    )
  }

  /**
   * 按标签过滤
   */
  async filterByTag(tag: string): Promise<Workflow[]> {
    const workflows = await this.listAll()
    return workflows.filter(w => w.metadata?.tags?.includes(tag))
  }

  /**
   * 按类别过滤
   */
  async filterByCategory(category: string): Promise<Workflow[]> {
    const workflows = await this.listAll()
    return workflows.filter(w => w.metadata?.category === category)
  }

  /**
   * 导出工作流
   */
  async export(name: string, targetPath: string): Promise<void> {
    const workflow = await this.load(name)
    const content = JSON.stringify(workflow, null, 2)

    try {
      await api.file.write(targetPath, content)
      logger.plan.info('[WorkflowManager] Exported workflow to:', targetPath)
    } catch (error) {
      logger.plan.error('[WorkflowManager] Failed to export workflow:', error)
      throw error
    }
  }

  /**
   * 导入工作流
   */
  async import(sourcePath: string): Promise<Workflow> {
    try {
      const content = await api.file.read(sourcePath)
      if (!content) {
        throw new Error('File not found')
      }

      const workflow: Workflow = JSON.parse(content)

      // 验证
      this.validator = new PlanValidator(workflow)
      const validation = this.validator.validate()

      if (!validation.valid) {
        throw new Error(`Invalid workflow: ${validation.errors.map(e => e.message).join(', ')}`)
      }

      // 生成新 ID 和时间戳
      workflow.id = crypto.randomUUID()
      workflow.createdAt = Date.now()
      workflow.updatedAt = Date.now()

      // 保存
      await this.save(workflow)

      logger.plan.info('[WorkflowManager] Imported workflow:', workflow.name)
      return workflow
    } catch (error) {
      logger.plan.error('[WorkflowManager] Failed to import workflow:', error)
      throw error
    }
  }

  /**
   * 复制工作流
   */
  async duplicate(name: string, newName: string): Promise<Workflow> {
    const workflow = await this.load(name)

    // 创建副本
    const duplicate: Workflow = {
      ...workflow,
      id: crypto.randomUUID(),
      name: newName,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    await this.save(duplicate)

    logger.plan.info('[WorkflowManager] Duplicated workflow:', name, '->', newName)
    return duplicate
  }

  /**
   * 创建工作流版本
   */
  async createVersion(name: string, versionTag: string): Promise<void> {
    const workflow = await this.load(name)
    const dir = this.getWorkflowsDir()
    const versionsDir = `${dir}/.versions/${name}`

    await api.file.ensureDir(versionsDir)

    const versionFile = `${versionsDir}/${versionTag}.json`
    const content = JSON.stringify(workflow, null, 2)

    try {
      await api.file.write(versionFile, content)
      logger.plan.info('[WorkflowManager] Created version:', name, versionTag)
    } catch (error) {
      logger.plan.error('[WorkflowManager] Failed to create version:', error)
      throw error
    }
  }

  /**
   * 列出工作流版本
   */
  async listVersions(name: string): Promise<string[]> {
    const dir = this.getWorkflowsDir()
    const versionsDir = `${dir}/.versions/${name}`

    try {
      const files = await api.file.readDir(versionsDir)
      if (!files) {
        return []
      }

      return files
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace('.json', ''))
        .sort()
        .reverse()
    } catch {
      return []
    }
  }

  /**
   * 恢复到指定版本
   */
  async restoreVersion(name: string, versionTag: string): Promise<Workflow> {
    const dir = this.getWorkflowsDir()
    const versionFile = `${dir}/.versions/${name}/${versionTag}.json`

    try {
      const content = await api.file.read(versionFile)
      if (!content) {
        throw new Error(`Version not found: ${versionTag}`)
      }

      const workflow: Workflow = JSON.parse(content)

      // 更新时间戳
      workflow.updatedAt = Date.now()

      // 保存为当前版本
      await this.save(workflow)

      logger.plan.info('[WorkflowManager] Restored version:', name, versionTag)
      return workflow
    } catch (error) {
      logger.plan.error('[WorkflowManager] Failed to restore version:', error)
      throw error
    }
  }

  // ===== 辅助方法 =====

  /**
   * 列出所有工作流（完整数据）
   */
  private async listAll(): Promise<Workflow[]> {
    const dir = this.getWorkflowsDir()

    try {
      const files = await api.file.readDir(dir)
      if (!files) {
        return []
      }

      const jsonFiles = files.filter(f => f.endsWith('.json'))
      const workflows: Workflow[] = []

      for (const file of jsonFiles) {
        try {
          const content = await api.file.read(`${dir}/${file}`)
          if (content) {
            workflows.push(JSON.parse(content))
          }
        } catch (error) {
          logger.plan.warn('[WorkflowManager] Failed to parse workflow:', file)
        }
      }

      return workflows
    } catch {
      return []
    }
  }

  /**
   * 清理文件名
   */
  private sanitizeFileName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  /**
   * 设置工作区路径
   */
  setWorkspacePath(path: string): void {
    this.workspacePath = path
  }
}

// 导出单例
export const workflowManager = new WorkflowManager()
