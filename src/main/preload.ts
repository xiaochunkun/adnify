/**
 * Preload Script
 * 在渲染进程中暴露安全的 API
 */

import { contextBridge, ipcRenderer } from 'electron'

// 定义 API 类型
export interface ElectronAPI {
	// Window controls
	minimize: () => void
	maximize: () => void
	close: () => void

	// File operations
	openFile: () => Promise<{ path: string; content: string } | null>
	openFolder: () => Promise<string | null>
	restoreWorkspace: () => Promise<string | null>
	readDir: (path: string) => Promise<{ name: string; path: string; isDirectory: boolean }[]>
	readFile: (path: string) => Promise<string | null>
	writeFile: (path: string, content: string) => Promise<boolean>
	saveFile: (content: string, path?: string) => Promise<string | null>
	fileExists: (path: string) => Promise<boolean>
	mkdir: (path: string) => Promise<boolean>
	deleteFile: (path: string) => Promise<boolean>
	renameFile: (oldPath: string, newPath: string) => Promise<boolean>
	searchFiles: (query: string, rootPath: string, options?: any) => Promise<any>

	// Settings
	getSetting: (key: string) => Promise<any>
	setSetting: (key: string, value: any) => Promise<boolean>

	// LLM
	sendMessage: (params: any) => Promise<void>
	abortMessage: () => void
	onLLMStream: (callback: (data: any) => void) => () => void
	onLLMToolCall: (callback: (toolCall: any) => void) => () => void
	onLLMError: (callback: (error: { message: string; code: string; retryable: boolean }) => void) => () => void
	onLLMDone: (callback: (data: any) => void) => () => void

	// Terminal
	createTerminal: (options?: { cwd?: string }) => Promise<void>
	writeTerminal: (data: string) => Promise<void>
	resizeTerminal: (cols: number, rows: number) => Promise<void>
	killTerminal: () => void
	onTerminalData: (callback: (data: string) => void) => () => void
}

contextBridge.exposeInMainWorld('electronAPI', {
	// Window controls
	minimize: () => ipcRenderer.send('window:minimize'),
	maximize: () => ipcRenderer.send('window:maximize'),
	close: () => ipcRenderer.send('window:close'),

	// File operations
	openFile: () => ipcRenderer.invoke('file:open'),
	openFolder: () => ipcRenderer.invoke('file:openFolder'),
    restoreWorkspace: () => ipcRenderer.invoke('workspace:restore'),
	readDir: (path: string) => ipcRenderer.invoke('file:readDir', path),
	readFile: (path: string) => ipcRenderer.invoke('file:read', path),
	writeFile: (path: string, content: string) => ipcRenderer.invoke('file:write', path, content),
	saveFile: (content: string, path?: string) => ipcRenderer.invoke('file:save', content, path),
	fileExists: (path: string) => ipcRenderer.invoke('file:exists', path),
	mkdir: (path: string) => ipcRenderer.invoke('file:mkdir', path),
	deleteFile: (path: string) => ipcRenderer.invoke('file:delete', path),
	renameFile: (oldPath: string, newPath: string) => ipcRenderer.invoke('file:rename', oldPath, newPath),
	searchFiles: (query: string, rootPath: string, options?: any) => ipcRenderer.invoke('file:search', query, rootPath, options),

	// Settings
	getSetting: (key: string) => ipcRenderer.invoke('settings:get', key),
	setSetting: (key: string, value: any) => ipcRenderer.invoke('settings:set', key, value),

	// LLM
	sendMessage: (params: any) => ipcRenderer.invoke('llm:sendMessage', params),
	abortMessage: () => ipcRenderer.send('llm:abort'),

	onLLMStream: (callback: (data: any) => void) => {
		const handler = (_: any, data: any) => callback(data)
		ipcRenderer.on('llm:stream', handler)
		return () => ipcRenderer.removeListener('llm:stream', handler)
	},

	onLLMToolCall: (callback: (toolCall: any) => void) => {
		const handler = (_: any, toolCall: any) => callback(toolCall)
		ipcRenderer.on('llm:toolCall', handler)
		return () => ipcRenderer.removeListener('llm:toolCall', handler)
	},

	onLLMError: (callback: (error: { message: string; code: string; retryable: boolean }) => void) => {
		const handler = (_: any, error: any) => callback(error)
		ipcRenderer.on('llm:error', handler)
		return () => ipcRenderer.removeListener('llm:error', handler)
	},

	onLLMDone: (callback: (data: any) => void) => {
		const handler = (_: any, data: any) => callback(data)
		ipcRenderer.on('llm:done', handler)
		return () => ipcRenderer.removeListener('llm:done', handler)
	},

	// Terminal
    createTerminal: (options?: { cwd?: string }) => ipcRenderer.invoke('terminal:create', options),
    writeTerminal: (data: string) => ipcRenderer.invoke('terminal:input', data),
    resizeTerminal: (cols: number, rows: number) => ipcRenderer.invoke('terminal:resize', cols, rows),
	killTerminal: () => ipcRenderer.send('terminal:kill'),
    // Background Shell
    executeCommand: (command: string, cwd?: string) => ipcRenderer.invoke('shell:execute', command, cwd),
	onTerminalData: (callback: (data: string) => void) => {
		const handler = (_: any, data: string) => callback(data)
		ipcRenderer.on('terminal:data', handler)
		return () => ipcRenderer.removeListener('terminal:data', handler)
	},
} as ElectronAPI)
