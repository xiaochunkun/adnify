/**
 * 增强版设置模态框
 * 支持多 Provider、自定义模型、编辑器设置等
 */

import { useState, useEffect } from 'react'
import {
  X, Cpu, Check, Eye, EyeOff, Terminal,
  FileEdit, AlertTriangle, Settings2, Code, Keyboard
} from 'lucide-react'
import { useStore } from '../store'
import { t, Language } from '../i18n'
import { BUILTIN_PROVIDERS, BuiltinProviderName } from '../types/provider'

type SettingsTab = 'provider' | 'editor' | 'agent' | 'keybindings'

const LANGUAGES: { id: Language; name: string }[] = [
  { id: 'en', name: 'English' },
  { id: 'zh', name: '中文' },
]

// Provider 列表（包含更多选项）
const PROVIDERS = [
  { id: 'openai', name: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1-preview', 'o1-mini'] },
  { id: 'anthropic', name: 'Anthropic', models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'] },
  { id: 'gemini', name: 'Gemini', models: ['gemini-2.0-flash-exp', 'gemini-1.5-pro', 'gemini-1.5-flash'] },
  { id: 'deepseek', name: 'DeepSeek', models: ['deepseek-chat', 'deepseek-coder'] },
  { id: 'groq', name: 'Groq', models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'] },
  { id: 'ollama', name: 'Ollama', models: ['llama3.2', 'codellama', 'deepseek-coder-v2'] },
  { id: 'custom', name: 'Custom', models: [] },
] as const

export default function SettingsModal() {
  const { llmConfig, setLLMConfig, setShowSettings, language, setLanguage, autoApprove, setAutoApprove } = useStore()
  const [activeTab, setActiveTab] = useState<SettingsTab>('provider')
  const [showApiKey, setShowApiKey] = useState(false)
  const [localConfig, setLocalConfig] = useState(llmConfig)
  const [localLanguage, setLocalLanguage] = useState(language)
  const [localAutoApprove, setLocalAutoApprove] = useState(autoApprove)
  const [saved, setSaved] = useState(false)


  // 编辑器设置
  const [editorSettings, setEditorSettings] = useState({
    fontSize: 14,
    tabSize: 2,
    wordWrap: 'on' as 'on' | 'off' | 'wordWrapColumn',
    lineNumbers: 'on' as 'on' | 'off' | 'relative',
    minimap: true,
    bracketPairColorization: true,
    formatOnSave: true,
    autoSave: 'off' as 'off' | 'afterDelay' | 'onFocusChange',
    theme: 'vs-dark',
  })

  // AI 指令
  const [aiInstructions, setAiInstructions] = useState('')

  useEffect(() => {
    setLocalConfig(llmConfig)
    setLocalLanguage(language)
    setLocalAutoApprove(autoApprove)
    // 加载编辑器设置
    window.electronAPI.getSetting('editorSettings').then(s => {
      if (s) setEditorSettings(s)
    })
    window.electronAPI.getSetting('aiInstructions').then(s => {
      if (s) setAiInstructions(s)
    })
  }, [llmConfig, language, autoApprove])

  const handleSave = async () => {
    setLLMConfig(localConfig)
    setLanguage(localLanguage)
    setAutoApprove(localAutoApprove)
    await window.electronAPI.setSetting('llmConfig', localConfig)
    await window.electronAPI.setSetting('language', localLanguage)
    await window.electronAPI.setSetting('autoApprove', localAutoApprove)
    await window.electronAPI.setSetting('editorSettings', editorSettings)
    await window.electronAPI.setSetting('aiInstructions', aiInstructions)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const selectedProvider = PROVIDERS.find(p => p.id === localConfig.provider)

  const tabs = [
    { id: 'provider' as const, label: localLanguage === 'zh' ? 'AI 模型' : 'AI Models', icon: Cpu },
    { id: 'editor' as const, label: localLanguage === 'zh' ? '编辑器' : 'Editor', icon: Code },
    { id: 'agent' as const, label: localLanguage === 'zh' ? 'Agent' : 'Agent', icon: Settings2 },
    { id: 'keybindings' as const, label: localLanguage === 'zh' ? '快捷键' : 'Keybindings', icon: Keyboard },
  ]

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-background-secondary border border-border-subtle rounded-xl w-[850px] h-[650px] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle flex-shrink-0 bg-background/50">
          <h2 className="text-lg font-semibold text-text-primary">{t('settings', localLanguage)}</h2>
          <div className="flex items-center gap-4">
            {/* Language Selector */}
            <select
              value={localLanguage}
              onChange={(e) => setLocalLanguage(e.target.value as Language)}
              className="bg-surface border border-border-subtle rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
            >
              {LANGUAGES.map(lang => (
                <option key={lang.id} value={lang.id}>{lang.name}</option>
              ))}
            </select>
            <button onClick={() => setShowSettings(false)} className="p-2 rounded-lg hover:bg-surface-hover transition-colors">
              <X className="w-5 h-5 text-text-muted hover:text-text-primary" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-48 border-r border-border-subtle p-2 flex-shrink-0 bg-background/30">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-accent/10 text-accent font-medium shadow-sm'
                    : 'text-text-muted hover:bg-surface-hover hover:text-text-primary'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 bg-background custom-scrollbar">
            {activeTab === 'provider' && (
              <ProviderSettings
                localConfig={localConfig}
                setLocalConfig={setLocalConfig}
                showApiKey={showApiKey}
                setShowApiKey={setShowApiKey}
                selectedProvider={selectedProvider}
                language={localLanguage}
              />
            )}

            {activeTab === 'editor' && (
              <EditorSettings
                settings={editorSettings}
                setSettings={setEditorSettings}
                language={localLanguage}
              />
            )}

            {activeTab === 'agent' && (
              <AgentSettings
                autoApprove={localAutoApprove}
                setAutoApprove={setLocalAutoApprove}
                aiInstructions={aiInstructions}
                setAiInstructions={setAiInstructions}
                language={localLanguage}
              />
            )}

            {activeTab === 'keybindings' && (
              <KeybindingsSettings language={localLanguage} />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border-subtle flex-shrink-0 bg-background/50">
          <button onClick={() => setShowSettings(false)} className="px-4 py-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors text-sm">
            {t('cancel', localLanguage)}
          </button>
          <button
            onClick={handleSave}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium transition-all shadow-glow ${
              saved ? 'bg-status-success text-white' : 'bg-accent hover:bg-accent-hover text-white'
            }`}
          >
            {saved ? <><Check className="w-4 h-4" />{t('saved', localLanguage)}</> : t('saveSettings', localLanguage)}
          </button>
        </div>
      </div>
    </div>
  )
}


// Provider 设置组件
function ProviderSettings({
  localConfig, setLocalConfig, showApiKey, setShowApiKey, selectedProvider, language
}: any) {
  return (
    <div className="space-y-6 text-text-primary">
      <div>
        <h3 className="text-sm font-medium mb-3">{language === 'zh' ? '选择服务商' : 'Select Provider'}</h3>
        <div className="grid grid-cols-4 gap-2">
          {PROVIDERS.map(provider => (
            <button
              key={provider.id}
              onClick={() => setLocalConfig({
                ...localConfig,
                provider: provider.id,
                model: provider.models[0] || localConfig.model
              })}
              className={`px-3 py-2.5 rounded-lg border text-sm transition-all ${
                localConfig.provider === provider.id
                  ? 'border-accent bg-accent/10 text-accent shadow-sm'
                  : 'border-border-subtle hover:border-text-muted text-text-muted hover:text-text-primary bg-surface'
              }`}
            >
              {provider.name}
            </button>
          ))}
        </div>
      </div>

      {/* Model Selection */}
      <div>
        <h3 className="text-sm font-medium mb-3">{language === 'zh' ? '选择模型' : 'Select Model'}</h3>
        {selectedProvider && selectedProvider.models.length > 0 ? (
          <select
            value={localConfig.model}
            onChange={(e) => setLocalConfig({ ...localConfig, model: e.target.value })}
            className="w-full bg-surface border border-border-subtle rounded-lg px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent"
          >
            {selectedProvider.models.map((model: string) => (
              <option key={model} value={model}>{model}</option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            value={localConfig.model}
            onChange={(e) => setLocalConfig({ ...localConfig, model: e.target.value })}
            placeholder={language === 'zh' ? '输入模型名称' : 'Enter model name'}
            className="w-full bg-surface border border-border-subtle rounded-lg px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent"
          />
        )}
      </div>

      {/* API Key */}
      <div>
        <h3 className="text-sm font-medium mb-3">API Key</h3>
        <div className="relative">
          <input
            type={showApiKey ? 'text' : 'password'}
            value={localConfig.apiKey}
            onChange={(e) => setLocalConfig({ ...localConfig, apiKey: e.target.value })}
            placeholder={`${selectedProvider?.name || 'Provider'} API Key`}
            className="w-full bg-surface border border-border-subtle rounded-lg px-4 py-2.5 pr-12 text-sm text-text-primary focus:outline-none focus:border-accent"
          />
          <button onClick={() => setShowApiKey(!showApiKey)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded hover:bg-surface-hover text-text-muted hover:text-text-primary">
            {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {localConfig.provider !== 'ollama' && (
          <p className="text-xs text-text-muted mt-2">
            {language === 'zh' ? '获取 API Key: ' : 'Get API Key: '}
            <a href={BUILTIN_PROVIDERS[localConfig.provider as BuiltinProviderName]?.apiKeyUrl || '#'}
               target="_blank" className="text-accent hover:underline">
              {BUILTIN_PROVIDERS[localConfig.provider as BuiltinProviderName]?.apiKeyUrl || 'Provider website'}
            </a>
          </p>
        )}
      </div>

      {/* Custom Endpoint */}
      <div>
        <h3 className="text-sm font-medium mb-3">{language === 'zh' ? '自定义端点 (可选)' : 'Custom Endpoint (Optional)'}</h3>
        <input
          type="text"
          value={localConfig.baseUrl || ''}
          onChange={(e) => setLocalConfig({ ...localConfig, baseUrl: e.target.value || undefined })}
          placeholder={localConfig.provider === 'ollama' ? 'http://localhost:11434' : 'https://api.example.com/v1'}
          className="w-full bg-surface border border-border-subtle rounded-lg px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent"
        />
        <p className="text-xs text-text-muted mt-2">
          {language === 'zh' ? '用于 OpenAI 兼容的 API 或本地模型' : 'For OpenAI-compatible APIs or local models'}
        </p>
      </div>
    </div>
  )
}


// 编辑器设置组件
function EditorSettings({ settings, setSettings, language }: any) {
  return (
    <div className="space-y-6 text-text-primary">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium mb-2 block">{language === 'zh' ? '字体大小' : 'Font Size'}</label>
          <input
            type="number"
            value={settings.fontSize}
            onChange={(e) => setSettings({ ...settings, fontSize: parseInt(e.target.value) || 14 })}
            min={10} max={24}
            className="w-full bg-surface border border-border-subtle rounded-lg px-4 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-2 block">{language === 'zh' ? 'Tab 大小' : 'Tab Size'}</label>
          <select
            value={settings.tabSize}
            onChange={(e) => setSettings({ ...settings, tabSize: parseInt(e.target.value) })}
            className="w-full bg-surface border border-border-subtle rounded-lg px-4 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
          >
            <option value={2}>2</option>
            <option value={4}>4</option>
            <option value={8}>8</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium mb-2 block">{language === 'zh' ? '自动换行' : 'Word Wrap'}</label>
          <select
            value={settings.wordWrap}
            onChange={(e) => setSettings({ ...settings, wordWrap: e.target.value })}
            className="w-full bg-surface border border-border-subtle rounded-lg px-4 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
          >
            <option value="on">{language === 'zh' ? '开启' : 'On'}</option>
            <option value="off">{language === 'zh' ? '关闭' : 'Off'}</option>
            <option value="wordWrapColumn">{language === 'zh' ? '按列' : 'By Column'}</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium mb-2 block">{language === 'zh' ? '行号' : 'Line Numbers'}</label>
          <select
            value={settings.lineNumbers}
            onChange={(e) => setSettings({ ...settings, lineNumbers: e.target.value })}
            className="w-full bg-surface border border-border-subtle rounded-lg px-4 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
          >
            <option value="on">{language === 'zh' ? '显示' : 'On'}</option>
            <option value="off">{language === 'zh' ? '隐藏' : 'Off'}</option>
            <option value="relative">{language === 'zh' ? '相对' : 'Relative'}</option>
          </select>
        </div>
      </div>

      <div className="space-y-3">
        <label className="flex items-center gap-3 p-3 rounded-lg border border-border-subtle hover:border-text-muted cursor-pointer bg-surface/50 transition-colors">
          <input
            type="checkbox"
            checked={settings.minimap}
            onChange={(e) => setSettings({ ...settings, minimap: e.target.checked })}
            className="w-4 h-4 rounded border-border-subtle text-accent focus:ring-accent"
          />
          <span className="text-sm">{language === 'zh' ? '显示小地图' : 'Show Minimap'}</span>
        </label>

        <label className="flex items-center gap-3 p-3 rounded-lg border border-border-subtle hover:border-text-muted cursor-pointer bg-surface/50 transition-colors">
          <input
            type="checkbox"
            checked={settings.bracketPairColorization}
            onChange={(e) => setSettings({ ...settings, bracketPairColorization: e.target.checked })}
            className="w-4 h-4 rounded border-border-subtle text-accent focus:ring-accent"
          />
          <span className="text-sm">{language === 'zh' ? '括号配对着色' : 'Bracket Pair Colorization'}</span>
        </label>

        <label className="flex items-center gap-3 p-3 rounded-lg border border-border-subtle hover:border-text-muted cursor-pointer bg-surface/50 transition-colors">
          <input
            type="checkbox"
            checked={settings.formatOnSave}
            onChange={(e) => setSettings({ ...settings, formatOnSave: e.target.checked })}
            className="w-4 h-4 rounded border-border-subtle text-accent focus:ring-accent"
          />
          <span className="text-sm">{language === 'zh' ? '保存时格式化' : 'Format on Save'}</span>
        </label>
      </div>

      <div>
        <label className="text-sm font-medium mb-2 block">{language === 'zh' ? '自动保存' : 'Auto Save'}</label>
        <select
          value={settings.autoSave}
          onChange={(e) => setSettings({ ...settings, autoSave: e.target.value })}
          className="w-full bg-surface border border-border-subtle rounded-lg px-4 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
        >
          <option value="off">{language === 'zh' ? '关闭' : 'Off'}</option>
          <option value="afterDelay">{language === 'zh' ? '延迟后' : 'After Delay'}</option>
          <option value="onFocusChange">{language === 'zh' ? '失去焦点时' : 'On Focus Change'}</option>
        </select>
      </div>
    </div>
  )
}


// Agent 设置组件
function AgentSettings({ autoApprove, setAutoApprove, aiInstructions, setAiInstructions, language }: any) {
  return (
    <div className="space-y-6 text-text-primary">
      <div>
        <h3 className="text-sm font-medium mb-3">{language === 'zh' ? '自动审批' : 'Auto Approve'}</h3>
        <p className="text-xs text-text-muted mb-3">
          {language === 'zh' ? '启用后，工具调用将自动执行' : 'When enabled, tool calls execute automatically'}
        </p>
        <div className="space-y-2">
          <label className="flex items-center gap-3 p-3 rounded-lg border border-border-subtle hover:border-text-muted cursor-pointer bg-surface/50 transition-colors">
            <input type="checkbox" checked={autoApprove.edits} onChange={(e) => setAutoApprove({ ...autoApprove, edits: e.target.checked })} className="w-4 h-4 rounded border-border-subtle text-accent focus:ring-accent" />
            <FileEdit className="w-4 h-4 text-blue-400" />
            <div className="flex-1">
              <span className="text-sm">{language === 'zh' ? '文件编辑' : 'File Edits'}</span>
              <p className="text-xs text-text-muted">{language === 'zh' ? '创建、修改文件' : 'Create, modify files'}</p>
            </div>
          </label>
          <label className="flex items-center gap-3 p-3 rounded-lg border border-border-subtle hover:border-text-muted cursor-pointer bg-surface/50 transition-colors">
            <input type="checkbox" checked={autoApprove.terminal} onChange={(e) => setAutoApprove({ ...autoApprove, terminal: e.target.checked })} className="w-4 h-4 rounded border-border-subtle text-accent focus:ring-accent" />
            <Terminal className="w-4 h-4 text-green-400" />
            <div className="flex-1">
              <span className="text-sm">{language === 'zh' ? '终端命令' : 'Terminal Commands'}</span>
              <p className="text-xs text-text-muted">{language === 'zh' ? '执行 shell 命令' : 'Execute shell commands'}</p>
            </div>
          </label>
          <label className="flex items-center gap-3 p-3 rounded-lg border border-border-subtle hover:border-text-muted cursor-pointer bg-surface/50 transition-colors">
            <input type="checkbox" checked={autoApprove.dangerous} onChange={(e) => setAutoApprove({ ...autoApprove, dangerous: e.target.checked })} className="w-4 h-4 rounded border-border-subtle text-accent focus:ring-accent" />
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <div className="flex-1">
              <span className="text-sm">{language === 'zh' ? '危险操作' : 'Dangerous Operations'}</span>
              <p className="text-xs text-text-muted">{language === 'zh' ? '删除文件等' : 'Delete files, etc.'}</p>
            </div>
          </label>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium mb-3">{language === 'zh' ? 'AI 自定义指令' : 'AI Custom Instructions'}</h3>
        <p className="text-xs text-text-muted mb-3">
          {language === 'zh' ? '这些指令会添加到每次对话的系统提示词中' : 'These instructions are added to every conversation'}
        </p>
        <textarea
          value={aiInstructions}
          onChange={(e) => setAiInstructions(e.target.value)}
          placeholder={language === 'zh' ? '例如：使用中文回复，代码注释用英文...' : 'e.g., Always use TypeScript, prefer functional components...'}
          className="w-full h-32 bg-surface border border-border-subtle rounded-lg px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-accent resize-none"
        />
      </div>
    </div>
  )
}

// 快捷键设置组件
function KeybindingsSettings({ language }: { language: Language }) {
  const shortcuts = [
    { keys: 'Ctrl+S', action: language === 'zh' ? '保存文件' : 'Save File' },
    { keys: 'Ctrl+P', action: language === 'zh' ? '快速打开' : 'Quick Open' },
    { keys: 'Ctrl+Shift+P', action: language === 'zh' ? '命令面板' : 'Command Palette' },
    { keys: 'Ctrl+`', action: language === 'zh' ? '切换终端' : 'Toggle Terminal' },
    { keys: 'Ctrl+,', action: language === 'zh' ? '打开设置' : 'Open Settings' },
    { keys: 'Ctrl+B', action: language === 'zh' ? '切换侧边栏' : 'Toggle Sidebar' },
    { keys: 'Ctrl+/', action: language === 'zh' ? '切换注释' : 'Toggle Comment' },
    { keys: 'Ctrl+D', action: language === 'zh' ? '选择下一个匹配' : 'Select Next Match' },
    { keys: 'Ctrl+F', action: language === 'zh' ? '查找' : 'Find' },
    { keys: 'Ctrl+H', action: language === 'zh' ? '替换' : 'Replace' },
    { keys: 'Ctrl+G', action: language === 'zh' ? '跳转到行' : 'Go to Line' },
    { keys: 'F12', action: language === 'zh' ? '跳转到定义' : 'Go to Definition' },
    { keys: 'Shift+F12', action: language === 'zh' ? '查找引用' : 'Find References' },
    { keys: 'Ctrl+Enter', action: language === 'zh' ? '发送消息' : 'Send Message' },
    { keys: 'Escape', action: language === 'zh' ? '停止生成' : 'Stop Generation' },
  ]

  return (
    <div className="space-y-4">
      <p className="text-xs text-text-muted">
        {language === 'zh' ? '快捷键暂不支持自定义，以下是默认快捷键列表' : 'Keybindings are not customizable yet. Here are the defaults:'}
      </p>
      <div className="space-y-1">
        {shortcuts.map((s, i) => (
          <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-surface-hover text-text-primary">
            <span className="text-sm text-text-muted">{s.action}</span>
            <kbd className="px-2 py-1 text-xs font-mono bg-surface border border-border-subtle rounded">{s.keys}</kbd>
          </div>
        ))}
      </div>
    </div>
  )
}
