import { StateCreator } from 'zustand'

export interface ToolCallLogEntry {
    id: string
    timestamp: Date
    type: 'request' | 'response'
    toolName: string
    data: unknown
    duration?: number
}

export interface LogSlice {
    toolCallLogs: ToolCallLogEntry[]
    addToolCallLog: (entry: Omit<ToolCallLogEntry, 'id' | 'timestamp'>) => void
    clearToolCallLogs: () => void
}

const MAX_LOGS = 100

export const createLogSlice: StateCreator<LogSlice> = (set) => ({
    toolCallLogs: [],
    addToolCallLog: (entry) => set((state) => {
        const newEntry: ToolCallLogEntry = {
            ...entry,
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            timestamp: new Date()
        }
        const newLogs = [newEntry, ...state.toolCallLogs].slice(0, MAX_LOGS)
        return { toolCallLogs: newLogs }
    }),
    clearToolCallLogs: () => set({ toolCallLogs: [] }),
})
