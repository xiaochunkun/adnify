/**
 * 设置相关状态切片
 */
import { StateCreator } from 'zustand'
import {
  SECURITY_DEFAULTS,
  AGENT_DEFAULTS,
} from '@/shared/constants'
import { saveEditorConfig, getEditorConfig } from '../../config/editorConfig'
import { defaultEditorConfig } from '../../config/editorConfig'

export type ProviderType = 'openai' | 'anthropic' | 'gemini' | 'deepseek' | 'groq' | 'mistral' | 'ollama' | 'custom'

// 适配器配置
export interface AdapterConfig {
  responseFormat: 'json' | 'xml' | 'mixed'
  toolCallPath: string
  toolNamePath: string
  toolArgsPath: string
  argsIsObject: boolean
  autoGenerateId: boolean
  xmlToolCallTag?: string
  xmlNameSource?: string
  xmlArgsTag?: string
}

export interface LLMConfig {
  provider: ProviderType
  model: string
  apiKey: string
  baseUrl?: string
  timeout?: number
  maxTokens?: number
  // Thinking 模式配置
  thinkingEnabled?: boolean
  thinkingBudget?: number  // thinking token 预算 (默认 16000)
  // 适配器配置
  adapterId?: string
  adapterConfig?: AdapterConfig
}

export interface AutoApproveSettings {
  terminal: boolean    // 终端命令（run_command）
  dangerous: boolean   // 危险操作（delete_file_or_folder）
}

export interface ProviderModelConfig {
  customModels: string[]
}

export interface SecuritySettings {
  enablePermissionConfirm: boolean
  enableAuditLog: boolean
  strictWorkspaceMode: boolean
  allowedShellCommands?: string[]
  showSecurityWarnings?: boolean
}

// Agent 执行配置
export interface AgentConfig {
  maxToolLoops: number          // 最大工具调用循环次数
  maxHistoryMessages: number    // 历史消息最大数量
  maxToolResultChars: number    // 工具结果最大字符数
  maxFileContentChars: number   // 单个文件内容最大字符数
  maxTotalContextChars: number  // 总上下文最大字符数
  enableAutoFix: boolean        // 是否启用自动检查和修复
  // 上下文限制（从 editorConfig.ai 迁移）
  maxContextFiles: number       // 最大上下文文件数
  maxSemanticResults: number    // 语义搜索最大结果数
  maxTerminalChars: number      // 终端输出最大字符数
  maxSingleFileChars: number    // 单文件最大字符数
}

export interface SettingsSlice {
  llmConfig: LLMConfig
  language: 'en' | 'zh'
  autoApprove: AutoApproveSettings
  promptTemplateId: string
  providerConfigs: Record<string, ProviderModelConfig>
  securitySettings: SecuritySettings
  agentConfig: AgentConfig
  editorConfig: import('../../config/editorConfig').EditorConfig
  onboardingCompleted: boolean
  hasExistingConfig: boolean

  setLLMConfig: (config: Partial<LLMConfig>) => void
  setLanguage: (lang: 'en' | 'zh') => void
  setAutoApprove: (settings: Partial<AutoApproveSettings>) => void
  setPromptTemplateId: (id: string) => void
  setProviderConfig: (providerId: string, config: ProviderModelConfig) => void
  addCustomModel: (providerId: string, model: string) => void
  removeCustomModel: (providerId: string, model: string) => void
  setSecuritySettings: (settings: Partial<SecuritySettings>) => void
  setAgentConfig: (config: Partial<AgentConfig>) => void
  setEditorConfig: (config: Partial<import('../../config/editorConfig').EditorConfig>) => void
  setOnboardingCompleted: (completed: boolean) => void
  setHasExistingConfig: (hasConfig: boolean) => void
  loadSettings: (isEmptyWindow?: boolean) => Promise<void>
}

const defaultLLMConfig: LLMConfig = {
  provider: 'openai',
  model: 'gpt-4o',
  apiKey: '',
  baseUrl: '',
  thinkingEnabled: false,
  thinkingBudget: 16000,
}

const defaultAutoApprove: AutoApproveSettings = {
  terminal: false,
  dangerous: false,
}

const defaultProviderConfigs: Record<string, ProviderModelConfig> = {
  openai: { customModels: [] },
  anthropic: { customModels: [] },
  gemini: { customModels: [] },
  deepseek: { customModels: [] },
  groq: { customModels: [] },
  mistral: { customModels: [] },
  ollama: { customModels: [] },
  custom: { customModels: [] },
}

// 使用共享常量作为默认安全设置
const defaultSecuritySettings: SecuritySettings = {
  enablePermissionConfirm: true,
  enableAuditLog: true,
  strictWorkspaceMode: true,
  allowedShellCommands: [...SECURITY_DEFAULTS.SHELL_COMMANDS],
  showSecurityWarnings: true,
}

// 默认 Agent 配置（使用 AGENT_DEFAULTS 作为默认值来源）
const defaultAgentConfig: AgentConfig = {
  maxToolLoops: AGENT_DEFAULTS.MAX_TOOL_LOOPS,
  maxHistoryMessages: 50,
  maxToolResultChars: 10000,
  maxFileContentChars: AGENT_DEFAULTS.MAX_FILE_CONTENT_CHARS,
  maxTotalContextChars: 50000,
  enableAutoFix: true,
  // 上下文限制
  maxContextFiles: 6,
  maxSemanticResults: 5,
  maxTerminalChars: 3000,
  maxSingleFileChars: 6000,
}

export const createSettingsSlice: StateCreator<SettingsSlice, [], [], SettingsSlice> = (set, get) => ({
  llmConfig: defaultLLMConfig,
  language: 'en',
  autoApprove: defaultAutoApprove,
  promptTemplateId: 'default',
  providerConfigs: defaultProviderConfigs,
  securitySettings: defaultSecuritySettings,
  agentConfig: defaultAgentConfig,
  editorConfig: defaultEditorConfig,
  onboardingCompleted: true, // 默认 true，加载后更新
  hasExistingConfig: true,

  setLLMConfig: (config) =>
    set((state) => ({
      llmConfig: { ...state.llmConfig, ...config },
    })),

  setLanguage: (lang) => set({ language: lang }),

  setAutoApprove: (settings) =>
    set((state) => ({
      autoApprove: { ...state.autoApprove, ...settings },
    })),

  setPromptTemplateId: (id) => set({ promptTemplateId: id }),

  setProviderConfig: (providerId, config) =>
    set((state) => ({
      providerConfigs: {
        ...state.providerConfigs,
        [providerId]: config,
      },
    })),

  addCustomModel: (providerId, model) =>
    set((state) => {
      const current = state.providerConfigs[providerId] || { customModels: [] }
      if (current.customModels.includes(model)) return state
      return {
        providerConfigs: {
          ...state.providerConfigs,
          [providerId]: {
            ...current,
            customModels: [...current.customModels, model],
          },
        },
      }
    }),

  removeCustomModel: (providerId, model) =>
    set((state) => {
      const current = state.providerConfigs[providerId] || { customModels: [] }
      return {
        providerConfigs: {
          ...state.providerConfigs,
          [providerId]: {
            ...current,
            customModels: current.customModels.filter((m) => m !== model),
          },
        },
      }
    }),

  setSecuritySettings: (settings) =>
    set((state) => ({
      securitySettings: { ...state.securitySettings, ...settings },
    })),

  setAgentConfig: (config) =>
    set((state) => ({
      agentConfig: { ...state.agentConfig, ...config },
    })),

  setEditorConfig: (config) =>
    set((state) => {
      const newConfig = { ...state.editorConfig, ...config }
      saveEditorConfig(newConfig)
      return { editorConfig: newConfig }
    }),

  setOnboardingCompleted: (completed) => set({ onboardingCompleted: completed }),
  setHasExistingConfig: (hasConfig) => set({ hasExistingConfig: hasConfig }),

  loadSettings: async (isEmptyWindow = false) => {
    try {
      // 从统一的 key 加载所有设置
      const settings = await window.electronAPI.getSetting('app-settings') as any

      if (settings) {
        set({
          llmConfig: settings.llmConfig || defaultLLMConfig,
          language: settings.language || 'en',
          autoApprove: settings.autoApprove || defaultAutoApprove,
          agentConfig: settings.agentConfig ? { ...defaultAgentConfig, ...settings.agentConfig } : defaultAgentConfig,
          onboardingCompleted: settings.onboardingCompleted ?? !!settings.llmConfig?.apiKey,
          hasExistingConfig: !!settings.llmConfig?.apiKey,
          editorConfig: getEditorConfig(),
        })
      } else {
        set({ onboardingCompleted: false, hasExistingConfig: false })
      }

      if (!isEmptyWindow) {
        const workspace = await window.electronAPI.restoreWorkspace()
        if (workspace) {
          ; (get() as any).setWorkspace(workspace)
        }
      }
    } catch (e) {
      console.error('Failed to load settings:', e)
    }
  },
})
