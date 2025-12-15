export type Language = 'en' | 'zh'

export const translations = {
	en: {
		// Title bar
		'app.name': 'Adnify',
		'settings': 'Settings',

		// Sidebar
		'explorer': 'Explorer',
		'openFolder': 'Open Folder',
		'refresh': 'Refresh',
		'noFolderOpened': 'No folder opened',

		// Editor
		'welcome': 'Welcome to Adnify',
		'welcomeDesc': 'Open a file from the sidebar or use the AI assistant',

		// Chat
		'aiAssistant': 'AI Assistant',
		'chat': 'Chat',
		'agent': 'Agent',
		'clearChat': 'Clear chat',
		'chatMode': 'Chat Mode',
		'agentMode': 'Agent Mode',
		'chatModeDesc': 'Ask me anything about your code',
		'agentModeDesc': 'I can read, edit files, and run commands for you',
		'askAnything': 'Ask me anything...',
		'configureApiKey': 'Configure API key first...',
		'apiKeyWarning': 'Please configure your API key in Settings to start chatting',
		'chatModeHint': '💬 Chat mode: Conversation only',
		'agentModeHint': '⚡ Agent mode: Can execute tools',

		// Settings
		'provider': 'Provider',
		'model': 'Model',
		'apiKey': 'API Key',
		'baseUrl': 'Base URL (Optional)',
		'baseUrlHint': 'Use custom endpoint for OpenAI-compatible APIs (e.g., Azure, local models)',
		'enterApiKey': 'Enter your {provider} API key',
		'cancel': 'Cancel',
		'saveSettings': 'Save Settings',
		'saved': 'Saved!',
		'language': 'Language',

		// Terminal
		'terminal': 'Terminal',
		'newTerminal': 'New Terminal',
		'clearTerminal': 'Clear',
		'closeTerminal': 'Close',

		// Tools
		'toolResult': 'Tool result for',

		// Diff viewer
		'acceptChanges': 'Accept Changes',
		'rejectChanges': 'Reject Changes',
		'splitView': 'Split View',
		'unifiedView': 'Unified View',
		'linesAdded': 'lines added',
		'linesRemoved': 'lines removed',

		// Code preview
		'copyCode': 'Copy code',
		'applyCode': 'Apply',
		'runCode': 'Run',

		// Auth (prepared for future)
		'login': 'Login',
		'logout': 'Logout',
		'register': 'Register',
		'email': 'Email',
		'password': 'Password',
		'forgotPassword': 'Forgot password?',
		'noAccount': "Don't have an account?",
		'hasAccount': 'Already have an account?',
		'profile': 'Profile',

		// Status
		'loading': 'Loading...',
		'error': 'Error',
		'success': 'Success',
		'saving': 'Saving...',
	},
	zh: {
		// Title bar
		'app.name': 'Adnify',
		'settings': '设置',

		// Sidebar
		'explorer': '资源管理器',
		'openFolder': '打开文件夹',
		'refresh': '刷新',
		'noFolderOpened': '未打开文件夹',

		// Editor
		'welcome': '欢迎使用 Adnify',
		'welcomeDesc': '从侧边栏打开文件或使用 AI 助手',

		// Chat
		'aiAssistant': 'AI 助手',
		'chat': '对话',
		'agent': '代理',
		'clearChat': '清空对话',
		'chatMode': '对话模式',
		'agentMode': '代理模式',
		'chatModeDesc': '问我任何关于代码的问题',
		'agentModeDesc': '我可以帮你读取、编辑文件和执行命令',
		'askAnything': '问我任何问题...',
		'configureApiKey': '请先配置 API 密钥...',
		'apiKeyWarning': '请在设置中配置 API 密钥以开始对话',
		'chatModeHint': '💬 对话模式：仅对话',
		'agentModeHint': '⚡ 代理模式：可执行工具',

		// Settings
		'provider': '服务商',
		'model': '模型',
		'apiKey': 'API 密钥',
		'baseUrl': '自定义地址（可选）',
		'baseUrlHint': '用于 OpenAI 兼容的 API（如 Azure、本地模型）',
		'enterApiKey': '输入你的 {provider} API 密钥',
		'cancel': '取消',
		'saveSettings': '保存设置',
		'saved': '已保存！',
		'language': '语言',

		// Terminal
		'terminal': '终端',
		'newTerminal': '新建终端',
		'clearTerminal': '清空',
		'closeTerminal': '关闭',

		// Tools
		'toolResult': '工具结果：',

		// Diff viewer
		'acceptChanges': '接受更改',
		'rejectChanges': '拒绝更改',
		'splitView': '分栏视图',
		'unifiedView': '统一视图',
		'linesAdded': '行添加',
		'linesRemoved': '行删除',

		// Code preview
		'copyCode': '复制代码',
		'applyCode': '应用',
		'runCode': '运行',

		// Auth (prepared for future)
		'login': '登录',
		'logout': '退出登录',
		'register': '注册',
		'email': '邮箱',
		'password': '密码',
		'forgotPassword': '忘记密码？',
		'noAccount': '还没有账号？',
		'hasAccount': '已有账号？',
		'profile': '个人资料',

		// Status
		'loading': '加载中...',
		'error': '错误',
		'success': '成功',
		'saving': '保存中...',
	}
} as const

export type TranslationKey = keyof typeof translations.en

export function t(key: TranslationKey, lang: Language, params?: Record<string, string>): string {
	let text: string = translations[lang][key] || translations.en[key] || key
	if (params) {
		Object.entries(params).forEach(([k, v]) => {
			text = text.replace(`{${k}}`, v)
		})
	}
	return text
}
