/**
 * Git 相关状态切片
 */
import { StateCreator } from 'zustand'
import type { GitStatus } from '@renderer/agent/services/gitService'

export interface GitSlice {
  gitStatus: GitStatus | null
  isGitRepo: boolean

  setGitStatus: (status: GitStatus | null) => void
  setIsGitRepo: (isRepo: boolean) => void
}

export const createGitSlice: StateCreator<GitSlice, [], [], GitSlice> = (set) => ({
  gitStatus: null,
  isGitRepo: false,

  setGitStatus: (status) => set({ gitStatus: status }),
  setIsGitRepo: (isRepo) => set({ isGitRepo: isRepo }),
})
