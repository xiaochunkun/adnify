/**
 * 工作流模板库
 * 
 * 提供预定义的工作流模板，用户可以基于模板快速创建工作流
 */

import type { WorkflowTemplate } from '../types/workflow'
import { featureDevelopmentTemplate } from './feature.js'
import { bugFixTemplate } from './bugfix.js'
import { refactoringTemplate } from './refactor.js'
import { codeReviewTemplate } from './review.js'

// ===== 模板注册表 =====

export const WORKFLOW_TEMPLATES: Record<string, WorkflowTemplate> = {
  'feature-development': featureDevelopmentTemplate,
  'bug-fix': bugFixTemplate,
  'refactoring': refactoringTemplate,
  'code-review': codeReviewTemplate,
}

// ===== 模板管理函数 =====

/**
 * 获取单个模板
 */
export function getTemplate(id: string): WorkflowTemplate | undefined {
  return WORKFLOW_TEMPLATES[id]
}

/**
 * 获取所有模板
 */
export function getAllTemplates(): WorkflowTemplate[] {
  return Object.values(WORKFLOW_TEMPLATES)
}

/**
 * 按类别获取模板
 */
export function getTemplatesByCategory(category: string): WorkflowTemplate[] {
  return getAllTemplates().filter(t => t.category === category)
}

/**
 * 按标签获取模板
 */
export function getTemplatesByTag(tag: string): WorkflowTemplate[] {
  return getAllTemplates().filter(t => t.tags.includes(tag))
}

/**
 * 搜索模板
 */
export function searchTemplates(query: string): WorkflowTemplate[] {
  const lowerQuery = query.toLowerCase()
  return getAllTemplates().filter(t =>
    t.name.toLowerCase().includes(lowerQuery) ||
    t.description.toLowerCase().includes(lowerQuery) ||
    t.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
  )
}

/**
 * 应用模板参数
 */
export function applyTemplateParameters(
  template: WorkflowTemplate,
  parameters: Record<string, unknown>
): import('../types/workflow').Workflow {
  const workflow: any = { ...template.workflow }

  // 生成唯一 ID 和时间戳
  workflow.id = crypto.randomUUID()
  workflow.createdAt = Date.now()
  workflow.updatedAt = Date.now()

  // 应用参数到配置
  if (workflow.config) {
    workflow.config.variables = {
      ...workflow.config.variables,
      ...parameters,
    }
  }

  // 标记为从模板创建
  workflow.metadata = {
    ...workflow.metadata,
    isTemplate: false,
    templateId: template.id,
  }

  return workflow as import('../types/workflow').Workflow
}

/**
 * 验证模板参数
 */
export function validateTemplateParameters(
  template: WorkflowTemplate,
  parameters: Record<string, unknown>
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!template.parameters) {
    return { valid: true, errors: [] }
  }

  for (const param of template.parameters) {
    const value = parameters[param.name]

    // 检查必需参数
    if (param.required && (value === undefined || value === null)) {
      errors.push(`Missing required parameter: ${param.name}`)
      continue
    }

    // 跳过可选参数
    if (value === undefined || value === null) {
      continue
    }

    // 类型检查
    const actualType = typeof value
    if (param.type !== actualType && param.type !== 'select') {
      errors.push(`Parameter ${param.name} must be ${param.type}, got ${actualType}`)
    }

    // 选项验证
    if (param.type === 'select' && param.options) {
      const validValues = param.options.map(o => o.value)
      if (!validValues.includes(value)) {
        errors.push(`Parameter ${param.name} must be one of: ${validValues.join(', ')}`)
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

// 导出所有模板
export {
  featureDevelopmentTemplate,
  bugFixTemplate,
  refactoringTemplate,
  codeReviewTemplate,
}
