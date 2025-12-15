import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
	// Window controls
	minimize: () => ipcRenderer.send('window:minimize'),
	maximize: () => ipcRenderer.send('window:maximize'),
	close: () => ipcRenderer.send('window:close'),

	// File operations
	openFile: () => ipcRenderer.invoke('file:open'),
	openFolder: () => ipcRenderer.invoke('file:openFolder'),
	readDir: (path: string) => ipcRenderer.invoke('file:readDir', path),
	readFile: (path: string) => ipcRenderer.invoke('file:read', path),
	writeFile: (path: string, content: string) => ipcRenderer.invoke('file:write', path, content),
	saveFile: (content: string, path?: string) => ipcRenderer.invoke('file:save', content, path),
	fileExists: (path: string) => ipcRenderer.invoke('file:exists', path),
	mkdir: (path: string) => ipcRenderer.invoke('file:mkdir', path),
	deleteFile: (path: string) => ipcRenderer.invoke('file:delete', path),

	// Settings
	getSetting: (key: string) => ipcRenderer.invoke('settings:get', key),
	setSetting: (key: string, value: any) => ipcRenderer.invoke('settings:set', key, value),

	// LLM
	sendMessage: (params: any) => ipcRenderer.invoke('llm:sendMessage', params),
	abortMessage: () => ipcRenderer.send('llm:abort'),
	onLLMStream: (callback: (data: any) => void) => {
		ipcRenderer.on('llm:stream', (_, data) => callback(data))
		return () => ipcRenderer.removeAllListeners('llm:stream')
	},
	onLLMError: (callback: (error: string) => void) => {
		ipcRenderer.on('llm:error', (_, error) => callback(error))
		return () => ipcRenderer.removeAllListeners('llm:error')
	},
	onLLMDone: (callback: (data: any) => void) => {
		ipcRenderer.on('llm:done', (_, data) => callback(data))
		return () => ipcRenderer.removeAllListeners('llm:done')
	},

	// Terminal
	executeCommand: (command: string, cwd?: string) => ipcRenderer.invoke('terminal:execute', command, cwd),
	killTerminal: () => ipcRenderer.send('terminal:kill'),
	onTerminalOutput: (callback: (data: string) => void) => {
		ipcRenderer.on('terminal:output', (_, data) => callback(data))
		return () => ipcRenderer.removeAllListeners('terminal:output')
	},
})
