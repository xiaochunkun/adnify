export interface FileItem {
	name: string
	path: string
	isDirectory: boolean
}

export interface ElectronAPI {
	// Window controls
	minimize: () => void
	maximize: () => void
	close: () => void

	// File operations
	openFile: () => Promise<{ path: string; content: string } | null>
	openFolder: () => Promise<string | null>
	readDir: (path: string) => Promise<FileItem[]>
	readFile: (path: string) => Promise<string | null>
	writeFile: (path: string, content: string) => Promise<boolean>
	saveFile: (content: string, path?: string) => Promise<string | null>
	fileExists: (path: string) => Promise<boolean>
	mkdir: (path: string) => Promise<boolean>
	deleteFile: (path: string) => Promise<boolean>

	// Settings
	getSetting: (key: string) => Promise<any>
	setSetting: (key: string, value: any) => Promise<boolean>

	// LLM
	sendMessage: (params: any) => Promise<void>
	abortMessage: () => void
	onLLMStream: (callback: (data: any) => void) => () => void
	onLLMError: (callback: (error: string) => void) => () => void
	onLLMDone: (callback: (data: any) => void) => () => void

	// Terminal
	executeCommand: (command: string, cwd?: string) => Promise<{ output: string; errorOutput: string; exitCode: number }>
	killTerminal: () => void
	onTerminalOutput: (callback: (data: string) => void) => () => void
}

declare global {
	interface Window {
		electronAPI: ElectronAPI
	}
}
