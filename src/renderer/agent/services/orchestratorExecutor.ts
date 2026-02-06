/**
 * Orchestrator Executor - 任务执行引擎
 * 负责管理 Orchestrator 模式的执行阶段切换
 */

import { useAgentStore } from '../store/AgentStore'
import { logger } from '@utils/Logger'
import type { TaskPlan } from '../store/slices/orchestratorSlice'

/**
 * 开始执行计划
 * 切换到执行阶段，允许使用所有工具
 */
export function startPlanExecution(
    planId?: string
): { success: boolean; message: string } {
    const store = useAgentStore.getState()

    // 获取计划
    const plan = planId
        ? store.plans.find(p => p.id === planId)
        : store.getActivePlan()

    if (!plan) {
        return { success: false, message: 'No active plan found' }
    }

    // 检查计划状态
    if (plan.tasks.length === 0) {
        return { success: false, message: 'Plan has no tasks' }
    }

    // 开始执行（这会切换 phase 到 'executing'）
    store.startExecution(plan.id)

    logger.agent.info(`[OrchestratorExecutor] Started execution of plan: ${plan.name}`)

    return {
        success: true,
        message: `Started executing plan "${plan.name}" with ${plan.tasks.length} tasks.\n\nYou now have access to all tools. Execute each task in order.`
    }
}

/**
 * 停止执行并返回规划阶段
 */
export function stopPlanExecution(): void {
    const store = useAgentStore.getState()
    store.stopExecution()
    logger.agent.info('[OrchestratorExecutor] Execution stopped, returned to planning phase')
}

/**
 * 获取当前阶段
 */
export function getCurrentPhase(): 'planning' | 'executing' {
    return useAgentStore.getState().phase
}

/**
 * 获取当前执行的任务
 */
export function getCurrentTask(planId: string): { task: TaskPlan['tasks'][0] | null; index: number } {
    const store = useAgentStore.getState()
    const plan = store.plans.find(p => p.id === planId)

    if (!plan) {
        return { task: null, index: -1 }
    }

    const currentTaskId = store.currentTaskId
    if (!currentTaskId) {
        // 找到第一个 pending 任务
        const pendingTask = store.getNextPendingTask(planId)
        if (pendingTask) {
            const index = plan.tasks.findIndex(t => t.id === pendingTask.id)
            return { task: pendingTask, index }
        }
        return { task: null, index: -1 }
    }

    const index = plan.tasks.findIndex(t => t.id === currentTaskId)
    return { task: plan.tasks[index] || null, index }
}

/**
 * 标记当前任务完成
 */
export function markTaskCompleted(planId: string, taskId: string, output?: string): void {
    const store = useAgentStore.getState()

    store.updateTask(planId, taskId, {
        status: 'completed',
        completedAt: Date.now(),
        output: output || 'Task completed',
    })

    // 检查是否还有待执行的任务
    const nextTask = store.getNextPendingTask(planId)
    if (nextTask) {
        store.setCurrentTask(nextTask.id)
        store.updateTask(planId, nextTask.id, { status: 'running', startedAt: Date.now() })
    } else {
        // 所有任务完成
        store.stopExecution()
        store.updatePlan(planId, { status: 'completed' })
        logger.agent.info('[OrchestratorExecutor] All tasks completed')
    }
}

/**
 * 标记当前任务失败
 */
export function markTaskFailed(planId: string, taskId: string, error: string): void {
    const store = useAgentStore.getState()

    store.updateTask(planId, taskId, {
        status: 'failed',
        completedAt: Date.now(),
        error,
    })

    // 失败时停止执行
    store.stopExecution()
    store.updatePlan(planId, { status: 'failed' })
}
