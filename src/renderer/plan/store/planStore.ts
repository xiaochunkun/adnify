/**
 * Plan Mode 状态管理
 * 独立于 Agent，用于项目级别的持久化计划
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { Plan, PlanStep, PlanStatus, PlanStepStatus, createEmptyPlan, createPlanStep } from '../types'

interface PlanState {
    /** 当前活动的 Plan */
    activePlan: Plan | null
    /** 历史 Plans */
    planHistory: Plan[]
}

interface PlanActions {
    // Plan 管理
    createPlan: (title: string, description?: string) => Plan
    loadPlan: (plan: Plan) => void
    clearActivePlan: () => void
    updatePlanStatus: (status: PlanStatus) => void

    // 步骤管理
    addStep: (title: string, description?: string) => void
    updateStep: (stepId: string, updates: Partial<PlanStep>) => void
    deleteStep: (stepId: string) => void
    reorderSteps: (stepIds: string[]) => void

    // 步骤状态
    setStepStatus: (stepId: string, status: PlanStepStatus) => void
    setCurrentStep: (stepId: string | null) => void
    completeCurrentStep: () => void
    startNextStep: () => void

    // 辅助方法
    getNextPendingStep: () => PlanStep | null
    getCompletedCount: () => number
    getProgress: () => number
}

type PlanStore = PlanState & PlanActions

// 自定义存储适配器（使用 localStorage）
const planStorage = createJSONStorage<PlanState>(() => localStorage)

export const usePlanStore = create<PlanStore>()(
    persist(
        (set, get) => ({
            activePlan: null,
            planHistory: [],

            // === Plan 管理 ===

            createPlan: (title, description) => {
                const plan = createEmptyPlan(title)
                if (description) plan.description = description

                set({ activePlan: plan })
                return plan
            },

            loadPlan: (plan) => {
                set({ activePlan: plan })
            },

            clearActivePlan: () => {
                const { activePlan, planHistory } = get()
                if (activePlan) {
                    // 保存到历史
                    set({
                        activePlan: null,
                        planHistory: [...planHistory, activePlan]
                    })
                }
            },

            updatePlanStatus: (status) => {
                set(state => {
                    if (!state.activePlan) return state
                    return {
                        activePlan: {
                            ...state.activePlan,
                            status,
                            lastModified: Date.now()
                        }
                    }
                })
            },

            // === 步骤管理 ===

            addStep: (title, description) => {
                set(state => {
                    if (!state.activePlan) return state
                    const newStep = createPlanStep(title, description, state.activePlan.steps.length)
                    return {
                        activePlan: {
                            ...state.activePlan,
                            steps: [...state.activePlan.steps, newStep],
                            lastModified: Date.now()
                        }
                    }
                })
            },

            updateStep: (stepId, updates) => {
                set(state => {
                    if (!state.activePlan) return state
                    return {
                        activePlan: {
                            ...state.activePlan,
                            steps: state.activePlan.steps.map(s =>
                                s.id === stepId ? { ...s, ...updates } : s
                            ),
                            lastModified: Date.now()
                        }
                    }
                })
            },

            deleteStep: (stepId) => {
                set(state => {
                    if (!state.activePlan) return state
                    const steps = state.activePlan.steps
                        .filter(s => s.id !== stepId)
                        .map((s, i) => ({ ...s, order: i }))
                    return {
                        activePlan: {
                            ...state.activePlan,
                            steps,
                            currentStepId: state.activePlan.currentStepId === stepId
                                ? null
                                : state.activePlan.currentStepId,
                            lastModified: Date.now()
                        }
                    }
                })
            },

            reorderSteps: (stepIds) => {
                set(state => {
                    if (!state.activePlan) return state
                    const stepMap = new Map(state.activePlan.steps.map(s => [s.id, s]))
                    const reordered = stepIds
                        .map((id, i) => {
                            const step = stepMap.get(id)
                            return step ? { ...step, order: i } : null
                        })
                        .filter((s): s is PlanStep => s !== null)
                    return {
                        activePlan: {
                            ...state.activePlan,
                            steps: reordered,
                            lastModified: Date.now()
                        }
                    }
                })
            },

            // === 步骤状态 ===

            setStepStatus: (stepId, status) => {
                set(state => {
                    if (!state.activePlan) return state
                    return {
                        activePlan: {
                            ...state.activePlan,
                            steps: state.activePlan.steps.map(s =>
                                s.id === stepId
                                    ? {
                                        ...s,
                                        status,
                                        completedAt: status === 'completed' ? Date.now() : s.completedAt
                                    }
                                    : s
                            ),
                            lastModified: Date.now()
                        }
                    }
                })
            },

            setCurrentStep: (stepId) => {
                set(state => {
                    if (!state.activePlan) return state
                    return {
                        activePlan: {
                            ...state.activePlan,
                            currentStepId: stepId,
                            lastModified: Date.now()
                        }
                    }
                })
            },

            completeCurrentStep: () => {
                const { activePlan, setStepStatus, startNextStep } = get()
                if (!activePlan?.currentStepId) return

                setStepStatus(activePlan.currentStepId, 'completed')
                startNextStep()
            },

            startNextStep: () => {
                const { getNextPendingStep, setCurrentStep, setStepStatus } = get()
                const nextStep = getNextPendingStep()

                if (nextStep) {
                    setStepStatus(nextStep.id, 'in_progress')
                    setCurrentStep(nextStep.id)
                } else {
                    setCurrentStep(null)
                }
            },

            // === 辅助方法 ===

            getNextPendingStep: () => {
                const { activePlan } = get()
                if (!activePlan) return null

                return activePlan.steps
                    .sort((a, b) => a.order - b.order)
                    .find(s => s.status === 'pending') || null
            },

            getCompletedCount: () => {
                const { activePlan } = get()
                if (!activePlan) return 0
                return activePlan.steps.filter(s => s.status === 'completed').length
            },

            getProgress: () => {
                const { activePlan, getCompletedCount } = get()
                if (!activePlan || activePlan.steps.length === 0) return 0
                return (getCompletedCount() / activePlan.steps.length) * 100
            }
        }),
        {
            name: 'adnify-plan-store',
            storage: planStorage,
            partialize: (state) => ({
                activePlan: state.activePlan,
                planHistory: state.planHistory
            })
        }
    )
)
