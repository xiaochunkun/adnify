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
import { ProviderModelConfig } from '../../types/provider'

export type ProviderType = 'openai' | 'anthropic' | 'gemini' | 'deepseek' | 'groq' | 'mistral' | 'ollama' | 'custom'

// 适配器配置已统一使用 @/shared/types/llmAdapter 中的 LLMAdapterConfig

export interface LLMConfig {
  provider: ProviderType
  model: string
  apiKey: string
  baseUrl?: string
  timeout?: number
  maxTokens?: number
  // 完整适配器配置（包含请求体和响应解析）
  adapterId?: string
  adapterConfig?: import('@/shared/types/llmAdapter').LLMAdapterConfig
}

export interface AutoApproveSettings {
  terminal: boolean    // 终端命令（run_command）
  dangerous: boolean   // 危险操作（delete_file_or_folder）
}

// ProviderModelConfig 已移至 ../types/provider.ts

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
  aiInstructions: string

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
  setAiInstructions: (instructions: string) => void
  loadSettings: (isEmptyWindow?: boolean) => Promise<void>
}

import { BUILTIN_ADAPTERS } from '@/shared/types/llmAdapter'

const defaultLLMConfig: LLMConfig = {
  provider: 'openai',
  model: 'gpt-4o',
  apiKey: '',
  baseUrl: '',
  adapterId: 'openai',
  adapterConfig: BUILTIN_ADAPTERS.openai,
}

const defaultAutoApprove: AutoApproveSettings = {
  terminal: false,
  dangerous: false,
}

const defaultProviderConfigs: Record<string, ProviderModelConfig> = {
  openai: { customModels: [], adapterId: 'openai', adapterConfig: BUILTIN_ADAPTERS.openai, model: 'gpt-4o' },
  anthropic: { customModels: [], adapterId: 'anthropic', adapterConfig: BUILTIN_ADAPTERS.anthropic, model: 'claude-3-5-sonnet-20241022' },
  gemini: { customModels: [], adapterId: 'gemini', adapterConfig: BUILTIN_ADAPTERS.gemini, model: 'gemini-1.5-pro' },
  deepseek: { customModels: [], adapterId: 'openai', adapterConfig: BUILTIN_ADAPTERS.openai, model: 'deepseek-chat', baseUrl: 'https://api.deepseek.com' },
  groq: { customModels: [], adapterId: 'openai', adapterConfig: BUILTIN_ADAPTERS.openai, model: 'llama-3.3-70b-versatile', baseUrl: 'https://api.groq.com/openai/v1' },
  mistral: { customModels: [], adapterId: 'openai', adapterConfig: BUILTIN_ADAPTERS.openai, model: 'mistral-large-latest', baseUrl: 'https://api.mistral.ai/v1' },
  ollama: { customModels: [], adapterId: 'ollama', adapterConfig: BUILTIN_ADAPTERS.ollama, model: 'llama3.2', baseUrl: 'http://localhost:11434' },
  custom: { customModels: [], adapterId: 'openai', adapterConfig: BUILTIN_ADAPTERS.openai, model: '' },
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
  aiInstructions: '',

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
  setAiInstructions: (instructions) => set({ aiInstructions: instructions }),

  loadSettings: async (isEmptyWindow = false) => {
    try {
      // 从统一的 key 加载所有设置
      const settings = await window.electronAPI.getSetting('app-settings') as any

      if (settings) {
        // 确保 llmConfig 与默认值合并，adapterConfig 有默认值
        const loadedLLMConfig = settings.llmConfig
          ? { ...defaultLLMConfig, ...settings.llmConfig }
          : defaultLLMConfig

        // 如果没有 adapterConfig 但有 adapterId，使用对应的内置预设
        if (!loadedLLMConfig.adapterConfig && loadedLLMConfig.adapterId) {
          const preset = BUILTIN_ADAPTERS[loadedLLMConfig.adapterId as keyof typeof BUILTIN_ADAPTERS]
          if (preset) {
            loadedLLMConfig.adapterConfig = preset
          }
        }

        console.log('[SettingsSlice] loadSettings - llmConfig loaded:', {
          hasAdapterConfig: !!loadedLLMConfig.adapterConfig,
          adapterId: loadedLLMConfig.adapterId,
          provider: loadedLLMConfig.provider,
        })

        const mergedProviderConfigs = { ...defaultProviderConfigs }
        if (settings.providerConfigs) {
          for (const [id, config] of Object.entries(settings.providerConfigs)) {
            mergedProviderConfigs[id] = {
              ...defaultProviderConfigs[id],
              ...(config as any)
            }
          }
        }

        set({
          llmConfig: loadedLLMConfig,
          language: settings.language || 'en',
          autoApprove: settings.autoApprove || defaultAutoApprove,
          providerConfigs: mergedProviderConfigs,
          agentConfig: settings.agentConfig ? { ...defaultAgentConfig, ...settings.agentConfig } : defaultAgentConfig,
          onboardingCompleted: settings.onboardingCompleted ?? !!settings.llmConfig?.apiKey,
          hasExistingConfig: !!settings.llmConfig?.apiKey,
          aiInstructions: settings.aiInstructions || '',
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
