/**
 * 模式状态管理
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { WorkMode } from './types'

interface ModeState {
    /** 当前工作模式 */
    currentMode: WorkMode
    /** 上一个模式（用于切换回去） */
    previousMode: WorkMode | null
}

interface ModeActions {
    /** 设置当前模式 */
    setMode: (mode: WorkMode) => void
    /** 切换回上一个模式 */
    restorePreviousMode: () => void
    /** 检查是否为指定模式 */
    isMode: (mode: WorkMode) => boolean
}

type ModeStore = ModeState & ModeActions

export const useModeStore = create<ModeStore>()(
    persist(
        (set, get) => ({
            currentMode: 'agent', // 默认 Agent 模式
            previousMode: null,

            setMode: (mode) => {
                const current = get().currentMode
                if (current !== mode) {
                    set({
                        currentMode: mode,
                        previousMode: current
                    })
                }
            },

            restorePreviousMode: () => {
                const previous = get().previousMode
                if (previous) {
                    set({
                        currentMode: previous,
                        previousMode: null
                    })
                }
            },

            isMode: (mode) => get().currentMode === mode
        }),
        {
            name: 'adnify-mode-store',
            partialize: (state) => ({
                currentMode: state.currentMode
            })
        }
    )
)
