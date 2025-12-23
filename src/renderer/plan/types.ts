/**
 * Plan Mode 类型定义
 */

/** Plan 步骤状态 */
export type PlanStepStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped'

/** Plan 整体状态 */
export type PlanStatus = 'draft' | 'active' | 'paused' | 'completed' | 'failed'

/** Plan 步骤 */
export interface PlanStep {
    id: string
    title: string
    description?: string
    status: PlanStepStatus
    order: number
    createdAt: number
    completedAt?: number
}

/** Plan 数据结构 */
export interface Plan {
    id: string
    title: string
    description?: string
    status: PlanStatus
    steps: PlanStep[]
    currentStepId: string | null
    createdAt: number
    lastModified: number
}

/** 创建空的 Plan */
export function createEmptyPlan(title: string = 'New Plan'): Plan {
    return {
        id: crypto.randomUUID(),
        title,
        status: 'draft',
        steps: [],
        currentStepId: null,
        createdAt: Date.now(),
        lastModified: Date.now()
    }
}

/** 创建 Plan 步骤 */
export function createPlanStep(title: string, description?: string, order: number = 0): PlanStep {
    return {
        id: crypto.randomUUID(),
        title,
        description,
        status: 'pending',
        order,
        createdAt: Date.now()
    }
}
