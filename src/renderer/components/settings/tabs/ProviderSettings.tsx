/**
 * Provider 设置组件
 * 
 * 逻辑说明：
 * 1. 内置 Provider（OpenAI/Anthropic/Gemini）：显示标准配置 + AdapterOverridesEditor
 * 2. 已添加的自定义 Provider：显示标准配置 + AdapterOverridesEditor（回显 adapterConfig）
 * 3. 点击"+"添加时：显示 InlineProviderEditor 表单
 */

import { useState } from 'react'
import { Plus, Trash, Eye, EyeOff, Check, AlertTriangle, X, Server, Key, Sliders, Box } from 'lucide-react'
import { useStore } from '@store'
import { PROVIDERS, getAdapterConfig, type CustomProviderConfig, type LLMAdapterConfig } from '@/shared/config/providers'
import { toast } from '@components/common/ToastProvider'
import { Button, Input, Select } from '@components/ui'
import { ProviderSettingsProps } from '../types'
import { InlineProviderEditor } from './CustomProviderEditor'
import { AdapterOverridesEditor } from '../AdapterOverridesEditor'

/** 高级配置类型 */
interface AdvancedConfig {
  request?: { endpoint?: string; bodyTemplate?: Record<string, unknown> }
  response?: { contentField?: string; reasoningField?: string; toolCallField?: string; doneMarker?: string }
}

// 内置厂商 ID
const BUILTIN_PROVIDER_IDS = ['openai', 'anthropic', 'gemini']

/**
 * 将 CustomProviderConfig.customConfig 转换为 LLMAdapterConfig
 */
function convertCustomConfigToAdapterConfig(custom: CustomProviderConfig): LLMAdapterConfig {
    const cfg = custom.customConfig!
    return {
        id: custom.id,
        name: custom.name,
        description: custom.description || '自定义适配器',
        request: {
            endpoint: cfg.request.endpoint,
            method: cfg.request.method,
            headers: { 'Content-Type': 'application/json', ...(cfg.request.headers || {}) },
            bodyTemplate: cfg.request.bodyTemplate,
        },
        response: {
            contentField: cfg.response.streaming.contentField,
            reasoningField: cfg.response.streaming.reasoningField,
            toolCallField: cfg.response.streaming.toolCallsField,
            toolNamePath: cfg.response.streaming.toolNameField || 'function.name',
            toolArgsPath: cfg.response.streaming.toolArgsField || 'function.arguments',
            toolIdPath: cfg.response.streaming.toolIdField || 'id',
            argsIsObject: cfg.response.toolCall?.argsIsObject || false,
            finishReasonField: cfg.response.streaming.finishReasonField || 'finish_reason',
            doneMarker: cfg.response.sseConfig.doneMarker,
        },
    }
}

/**
 * 将 LLMAdapterConfig 转换为 AdvancedConfig（用于回显）
 */
function adapterConfigToAdvanced(config: LLMAdapterConfig | undefined, isCustom: boolean): AdvancedConfig | undefined {
    if (!config) return undefined
    // 对于内置 Provider，只有当有自定义配置时才返回
    // 对于自定义 Provider，总是返回配置
    if (!isCustom) {
        // 内置 Provider：检查是否有非默认的 bodyTemplate
        if (!config.request?.bodyTemplate || Object.keys(config.request.bodyTemplate).length === 0) {
            return undefined
        }
    }
    return {
        request: {
            endpoint: config.request?.endpoint,
            bodyTemplate: config.request?.bodyTemplate,
        },
        response: {
            contentField: config.response?.contentField,
            reasoningField: config.response?.reasoningField,
            toolCallField: config.response?.toolCallField,
            doneMarker: config.response?.doneMarker,
        },
    }
}

function TestConnectionButton({ localConfig, language }: { localConfig: any; language: 'en' | 'zh' }) {
    const [testing, setTesting] = useState(false)
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
    const [errorMsg, setErrorMsg] = useState('')

    const handleTest = async () => {
        if (!localConfig.apiKey && localConfig.provider !== 'ollama') {
            setStatus('error')
            setErrorMsg(language === 'zh' ? '请先输入 API Key' : 'Please enter API Key first')
            return
        }
        setTesting(true)
        setStatus('idle')
        setErrorMsg('')
        try {
            const { checkProviderHealth } = await import('@/renderer/services/healthCheckService')
            const result = await checkProviderHealth(localConfig.provider, localConfig.apiKey, localConfig.baseUrl)
            if (result.status === 'healthy') {
                setStatus('success')
                toast.success(language === 'zh' ? `连接成功！延迟: ${result.latency}ms` : `Connected! Latency: ${result.latency}ms`)
            } else {
                setStatus('error')
                setErrorMsg(result.error || 'Connection failed')
            }
        } catch (err: any) {
            setStatus('error')
            setErrorMsg(err.message || 'Connection failed')
        } finally {
            setTesting(false)
        }
    }

    return (
        <div className="flex items-center gap-3 mt-2">
            <Button variant="secondary" size="sm" onClick={handleTest} disabled={testing} className="h-9 px-4 text-xs font-medium">
                {testing ? (
                    <span className="flex items-center gap-2">
                        <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        {language === 'zh' ? '测试中...' : 'Testing...'}
                    </span>
                ) : (
                    language === 'zh' ? '测试连接' : 'Test Connection'
                )}
            </Button>
            {status === 'success' && (
                <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-full border border-emerald-400/20">
                    <Check className="w-3 h-3" />
                    {language === 'zh' ? '连接成功' : 'Connected'}
                </span>
            )}
            {status === 'error' && (
                <span className="flex items-center gap-1.5 text-xs font-medium text-red-400 bg-red-400/10 px-2 py-1 rounded-full border border-red-400/20" title={errorMsg}>
                    <AlertTriangle className="w-3 h-3" />
                    {errorMsg.length > 30 ? errorMsg.slice(0, 30) + '...' : errorMsg}
                </span>
            )}
        </div>
    )
}

export function ProviderSettings({
    localConfig,
    setLocalConfig,
    localProviderConfigs,
    setLocalProviderConfigs,
    showApiKey,
    setShowApiKey,
    selectedProvider,
    providers,
    language,
}: ProviderSettingsProps) {
    const { addCustomModel, removeCustomModel, providerConfigs, customProviders, removeCustomProvider, getProviderApiKey } = useStore()
    const [newModelName, setNewModelName] = useState('')
    const [isAddingCustom, setIsAddingCustom] = useState(false)

    // 当前选中的是自定义 Provider 吗？
    const selectedCustomProvider = customProviders.find((p) => p.id === localConfig.provider)
    const isCustomSelected = !!selectedCustomProvider

    // 获取当前 Provider 的 adapterConfig（用于回显）
    const currentAdapterConfig = localProviderConfigs[localConfig.provider]?.adapterConfig

    const handleAddModel = () => {
        if (newModelName.trim()) {
            addCustomModel(localConfig.provider, newModelName.trim())
            setNewModelName('')
        }
    }

    // 选择内置 Provider
    const handleSelectBuiltinProvider = (providerId: string) => {
        // 保存当前配置
        const updatedConfigs = {
            ...localProviderConfigs,
            [localConfig.provider]: {
                ...localProviderConfigs[localConfig.provider],
                apiKey: localConfig.apiKey,
                baseUrl: localConfig.baseUrl,
                timeout: localConfig.timeout,
                adapterConfig: localConfig.adapterConfig,
                model: localConfig.model,
            },
        }
        setLocalProviderConfigs(updatedConfigs)

        // 加载新 Provider 配置
        const nextConfig = updatedConfigs[providerId] || {}
        const providerInfo = PROVIDERS[providerId]
        setLocalConfig({
            ...localConfig,
            provider: providerId as any,
            apiKey: nextConfig.apiKey || '',
            baseUrl: nextConfig.baseUrl || providerInfo?.endpoint.default || '',
            timeout: nextConfig.timeout || providerInfo?.defaults.timeout || 120000,
            adapterConfig: nextConfig.adapterConfig || getAdapterConfig(providerId),
            model: nextConfig.model || providerInfo?.models[0] || '',
        })
        setIsAddingCustom(false)
    }

    // 选择自定义 Provider
    const handleSelectCustomProvider = (custom: CustomProviderConfig) => {
        // 保存当前配置
        const updatedConfigs = {
            ...localProviderConfigs,
            [localConfig.provider]: {
                ...localProviderConfigs[localConfig.provider],
                apiKey: localConfig.apiKey,
                baseUrl: localConfig.baseUrl,
                timeout: localConfig.timeout,
                adapterConfig: localConfig.adapterConfig,
                model: localConfig.model,
            },
        }
        setLocalProviderConfigs(updatedConfigs)

        // 获取已保存的配置
        const savedConfig = updatedConfigs[custom.id] || {}
        const savedApiKey = savedConfig.apiKey || getProviderApiKey(custom.id) || ''

        // 决定适配器配置
        let adapterConfig: LLMAdapterConfig
        if (custom.mode === 'custom' && custom.customConfig) {
            adapterConfig = savedConfig.adapterConfig || convertCustomConfigToAdapterConfig(custom)
        } else {
            adapterConfig = savedConfig.adapterConfig || getAdapterConfig(custom.mode)
        }

        setLocalConfig({
            ...localConfig,
            provider: custom.id as any,
            apiKey: savedApiKey,
            baseUrl: savedConfig.baseUrl || custom.baseUrl,
            timeout: savedConfig.timeout || custom.defaults?.timeout || 120000,
            adapterConfig,
            model: savedConfig.model || custom.models[0] || '',
        })
        setIsAddingCustom(false)
    }

    // 删除自定义 Provider
    const handleDeleteCustomProvider = (e: React.MouseEvent, custom: CustomProviderConfig) => {
        e.stopPropagation()
        if (confirm(language === 'zh' ? `删除 ${custom.name}？` : `Delete ${custom.name}?`)) {
            removeCustomProvider(custom.id)
            if (localConfig.provider === custom.id) {
                handleSelectBuiltinProvider('openai')
            }
        }
    }

    // 更新 adapterOverrides 并同步到 adapterConfig
    const handleAdvancedConfigChange = (advanced: AdvancedConfig | undefined) => {
        const newConfigs = { ...localProviderConfigs }
        if (!newConfigs[localConfig.provider]) {
            newConfigs[localConfig.provider] = { customModels: [] }
        }

        // 保存 advanced 配置
        newConfigs[localConfig.provider] = {
            ...newConfigs[localConfig.provider],
            advanced: advanced,
        }

        // 同时更新 adapterConfig（无论是内置还是自定义 Provider）
        if (advanced) {
            const baseConfig = localConfig.adapterConfig || getAdapterConfig(localConfig.provider) || getAdapterConfig('openai')
            const updatedAdapterConfig: LLMAdapterConfig = {
                ...baseConfig,
                request: {
                    ...baseConfig.request,
                    endpoint: advanced.request?.endpoint || baseConfig.request.endpoint,
                    bodyTemplate: advanced.request?.bodyTemplate || baseConfig.request.bodyTemplate,
                },
                response: {
                    ...baseConfig.response,
                    contentField: advanced.response?.contentField || baseConfig.response.contentField,
                    reasoningField: advanced.response?.reasoningField,
                    toolCallField: advanced.response?.toolCallField,
                    doneMarker: advanced.response?.doneMarker || baseConfig.response.doneMarker,
                },
            }
            newConfigs[localConfig.provider].adapterConfig = updatedAdapterConfig
            setLocalConfig({ ...localConfig, adapterConfig: updatedAdapterConfig })
        } else {
            // 如果 advanced 被清空，恢复默认的 adapterConfig
            const defaultConfig = getAdapterConfig(localConfig.provider)
            newConfigs[localConfig.provider].adapterConfig = defaultConfig
            setLocalConfig({ ...localConfig, adapterConfig: defaultConfig })
        }

        setLocalProviderConfigs(newConfigs)
    }

    const builtinProviders = providers.filter((p) => BUILTIN_PROVIDER_IDS.includes(p.id))

    return (
        <div className="space-y-8 animate-fade-in pb-10">
            {/* Provider 选择器 */}
            <section>
                <div className="flex items-center gap-2 mb-4">
                    <Box className="w-4 h-4 text-accent" />
                    <h4 className="text-sm font-semibold text-text-primary uppercase tracking-wide">
                        {language === 'zh' ? '选择提供商' : 'Select Provider'}
                    </h4>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {/* 内置厂商 */}
                    {builtinProviders.map((p) => (
                        <button
                            key={p.id}
                            onClick={() => handleSelectBuiltinProvider(p.id)}
                            className={`group relative flex flex-col items-center justify-center p-4 rounded-xl border transition-all duration-200 ${
                                localConfig.provider === p.id
                                    ? 'border-accent bg-accent/5 text-accent shadow-md ring-1 ring-accent/20'
                                    : 'border-white/5 bg-surface/40 text-text-muted hover:bg-surface/60 hover:border-white/10 hover:text-text-primary'
                            }`}
                        >
                            <span className="font-medium text-sm">{p.name}</span>
                            {localConfig.provider === p.id && (
                                <div className="absolute top-2 right-2">
                                    <Check className="w-3.5 h-3.5 text-accent" />
                                </div>
                            )}
                        </button>
                    ))}

                    {/* 已添加的自定义 Provider */}
                    {customProviders.map((custom) => (
                        <div
                            key={custom.id}
                            onClick={() => handleSelectCustomProvider(custom)}
                            className={`group relative flex flex-col items-center justify-center p-4 rounded-xl border transition-all duration-200 cursor-pointer ${
                                localConfig.provider === custom.id
                                    ? 'border-accent bg-accent/5 text-accent shadow-md ring-1 ring-accent/20'
                                    : 'border-white/5 bg-surface/40 text-text-muted hover:bg-surface/60 hover:border-white/10 hover:text-text-primary'
                            }`}
                        >
                            <span className="font-medium text-sm truncate w-full text-center">{custom.name}</span>
                            {localConfig.provider === custom.id && (
                                <div className="absolute top-2 right-2">
                                    <Check className="w-3.5 h-3.5 text-accent" />
                                </div>
                            )}
                            <button
                                onClick={(e) => handleDeleteCustomProvider(e, custom)}
                                className="absolute -top-2 -right-2 p-1 rounded-full bg-surface border border-border-subtle text-text-muted shadow-sm opacity-0 group-hover:opacity-100 hover:text-red-500 hover:border-red-500/30 transition-all scale-90 hover:scale-100"
                                title={language === 'zh' ? '删除' : 'Delete'}
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    ))}

                    {/* 添加按钮 */}
                    <button
                        onClick={() => setIsAddingCustom(true)}
                        className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 border-dashed transition-all duration-200 ${
                            isAddingCustom
                                ? 'border-accent/50 bg-accent/5 text-accent'
                                : 'border-white/10 text-text-muted hover:border-accent/30 hover:text-accent hover:bg-accent/5'
                        }`}
                    >
                        <Plus className="w-5 h-5 mb-1" />
                        <span className="text-xs font-medium">{language === 'zh' ? '添加自定义' : 'Add Custom'}</span>
                    </button>
                </div>

                {/* 添加新 Provider 表单（仅点击"+"时显示） */}
                {isAddingCustom && (
                    <div className="mt-6 p-6 rounded-2xl bg-surface/30 border border-white/5 animate-slide-down">
                        <div className="flex justify-between items-center mb-4">
                            <h5 className="text-sm font-medium text-text-primary">{language === 'zh' ? '添加新提供商' : 'Add New Provider'}</h5>
                            <Button variant="ghost" size="sm" onClick={() => setIsAddingCustom(false)}>
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                        <InlineProviderEditor
                            language={language}
                            isNew
                            onSave={(newConfig) => {
                                if (newConfig.customConfig) {
                                    const adapterConfig = convertCustomConfigToAdapterConfig(newConfig)
                                    const newConfigs = { ...localProviderConfigs }
                                    newConfigs[newConfig.id] = {
                                        ...newConfigs[newConfig.id],
                                        adapterConfig,
                                        model: newConfig.defaultModel || newConfig.models[0] || '',
                                        customModels: newConfig.models,
                                    }
                                    setLocalProviderConfigs(newConfigs)
                                    setLocalConfig({ ...localConfig, provider: newConfig.id })
                                }
                                setIsAddingCustom(false)
                            }}
                            onCancel={() => setIsAddingCustom(false)}
                        />
                    </div>
                )}
            </section>

            {/* 配置区域（非添加模式时显示） */}
            {!isAddingCustom && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* 左列：基础配置 */}
                    <div className="space-y-6">
                        {/* 模型设置 */}
                        <section className="p-5 bg-surface/30 rounded-xl border border-white/5 space-y-4">
                            <div className="flex items-center gap-2 mb-1">
                                <Box className="w-4 h-4 text-accent" />
                                <h5 className="text-sm font-medium text-text-primary">{language === 'zh' ? '模型配置' : 'Model Configuration'}</h5>
                            </div>
                            
                            <div className="space-y-3">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-text-secondary">{language === 'zh' ? '选择模型' : 'Select Model'}</label>
                                    <Select
                                        value={localConfig.model}
                                        onChange={(value) => setLocalConfig({ ...localConfig, model: value })}
                                        options={(() => {
                                            const modelsSet = new Set<string>()
                                            if (isCustomSelected) {
                                                selectedCustomProvider.models.forEach((m) => modelsSet.add(m))
                                            } else if (selectedProvider) {
                                                selectedProvider.models.forEach((m) => modelsSet.add(m))
                                            }
                                            const customModels = providerConfigs[localConfig.provider]?.customModels || []
                                            customModels.forEach((m) => modelsSet.add(m))
                                            return Array.from(modelsSet).map((m) => ({ value: m, label: m }))
                                        })()}
                                        className="w-full bg-black/20 border-white/10"
                                    />
                                </div>

                                {/* 添加自定义模型 */}
                                <div className="pt-2">
                                    <div className="flex gap-2">
                                        <Input
                                            value={newModelName}
                                            onChange={(e) => setNewModelName(e.target.value)}
                                            placeholder={language === 'zh' ? '输入新模型名称...' : 'Enter new model name...'}
                                            onKeyDown={(e) => e.key === 'Enter' && handleAddModel()}
                                            className="flex-1 h-9 text-xs bg-black/20 border-white/10"
                                        />
                                        <Button variant="secondary" size="sm" onClick={handleAddModel} disabled={!newModelName.trim()} className="h-9 px-3">
                                            <Plus className="w-4 h-4" />
                                        </Button>
                                    </div>
                                    
                                    {providerConfigs[localConfig.provider]?.customModels?.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mt-3">
                                            {providerConfigs[localConfig.provider]?.customModels.map((model: string) => (
                                                <div
                                                    key={model}
                                                    className="group flex items-center gap-1.5 px-2 py-1 bg-surface/50 rounded-md border border-white/5 text-xs text-text-secondary hover:border-white/10"
                                                >
                                                    <span>{model}</span>
                                                    <button onClick={() => removeCustomModel(localConfig.provider, model)} className="text-text-muted hover:text-red-400 opacity-50 group-hover:opacity-100 transition-opacity">
                                                        <Trash className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </section>

                        {/* 认证设置 */}
                        <section className="p-5 bg-surface/30 rounded-xl border border-white/5 space-y-4">
                            <div className="flex items-center gap-2 mb-1">
                                <Key className="w-4 h-4 text-accent" />
                                <h5 className="text-sm font-medium text-text-primary">{language === 'zh' ? '认证设置' : 'Authentication'}</h5>
                            </div>

                            <div className="space-y-3">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-text-secondary">API Key</label>
                                    <Input
                                        type={showApiKey ? 'text' : 'password'}
                                        value={localConfig.apiKey}
                                        onChange={(e) => setLocalConfig({ ...localConfig, apiKey: e.target.value })}
                                        placeholder={PROVIDERS[localConfig.provider]?.auth.placeholder || 'sk-...'}
                                        className="bg-black/20 border-white/10 font-mono text-xs"
                                        rightIcon={
                                            <button onClick={() => setShowApiKey(!showApiKey)} className="text-text-muted hover:text-text-primary">
                                                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        }
                                    />
                                </div>
                                
                                <div className="flex items-center justify-between">
                                    <TestConnectionButton localConfig={localConfig} language={language} />
                                    {!isCustomSelected && PROVIDERS[localConfig.provider]?.auth.helpUrl && (
                                        <a href={PROVIDERS[localConfig.provider]?.auth.helpUrl} target="_blank" rel="noreferrer" className="text-xs text-text-muted hover:text-accent hover:underline flex items-center gap-1">
                                            {language === 'zh' ? '获取 Key' : 'Get Key'} <span className="opacity-50">↗</span>
                                        </a>
                                    )}
                                </div>
                            </div>
                        </section>
                    </div>

                    {/* 右列：高级参数 */}
                    <div className="space-y-6">
                        <section className="p-5 bg-surface/30 rounded-xl border border-white/5 space-y-5">
                            <div className="flex items-center gap-2 mb-1">
                                <Sliders className="w-4 h-4 text-accent" />
                                <h5 className="text-sm font-medium text-text-primary">{language === 'zh' ? '生成参数' : 'Generation Parameters'}</h5>
                            </div>

                            {/* Max Tokens */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs text-text-secondary">{language === 'zh' ? '最大 Token' : 'Max Tokens'}</label>
                                    <span className="text-xs font-mono bg-black/20 px-1.5 py-0.5 rounded text-accent">{localConfig.parameters?.maxTokens || 8192}</span>
                                </div>
                                <input
                                    type="range"
                                    min={1024}
                                    max={32768}
                                    step={1024}
                                    value={localConfig.parameters?.maxTokens || 8192}
                                    onChange={(e) => setLocalConfig({
                                        ...localConfig,
                                        parameters: { ...localConfig.parameters, maxTokens: parseInt(e.target.value) }
                                    })}
                                    className="w-full h-1.5 bg-surface-active rounded-full appearance-none cursor-pointer accent-accent hover:accent-accent-hover"
                                />
                            </div>

                            {/* Temperature */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs text-text-secondary">{language === 'zh' ? '随机性 (Temperature)' : 'Temperature'}</label>
                                    <span className="text-xs font-mono bg-black/20 px-1.5 py-0.5 rounded text-accent">{(localConfig.parameters?.temperature || 0.7).toFixed(1)}</span>
                                </div>
                                <input
                                    type="range"
                                    min={0}
                                    max={2}
                                    step={0.1}
                                    value={localConfig.parameters?.temperature || 0.7}
                                    onChange={(e) => setLocalConfig({
                                        ...localConfig,
                                        parameters: { ...localConfig.parameters, temperature: parseFloat(e.target.value) }
                                    })}
                                    className="w-full h-1.5 bg-surface-active rounded-full appearance-none cursor-pointer accent-accent hover:accent-accent-hover"
                                />
                                <div className="flex justify-between text-[10px] text-text-muted px-1">
                                    <span>{language === 'zh' ? '精确' : 'Precise'}</span>
                                    <span>{language === 'zh' ? '创意' : 'Creative'}</span>
                                </div>
                            </div>

                            {/* Top P */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs text-text-secondary">Top P</label>
                                    <span className="text-xs font-mono bg-black/20 px-1.5 py-0.5 rounded text-accent">{(localConfig.parameters?.topP || 1).toFixed(2)}</span>
                                </div>
                                <input
                                    type="range"
                                    min={0}
                                    max={1}
                                    step={0.05}
                                    value={localConfig.parameters?.topP || 1}
                                    onChange={(e) => setLocalConfig({
                                        ...localConfig,
                                        parameters: { ...localConfig.parameters, topP: parseFloat(e.target.value) }
                                    })}
                                    className="w-full h-1.5 bg-surface-active rounded-full appearance-none cursor-pointer accent-accent hover:accent-accent-hover"
                                />
                            </div>
                        </section>

                        {/* 网络 & 适配器 */}
                        <section className="p-5 bg-surface/30 rounded-xl border border-white/5 space-y-4">
                            <div className="flex items-center gap-2 mb-1">
                                <Server className="w-4 h-4 text-accent" />
                                <h5 className="text-sm font-medium text-text-primary">{language === 'zh' ? '网络 & 适配器' : 'Network & Adapter'}</h5>
                            </div>

                            <div className="space-y-3">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-text-secondary">{language === 'zh' ? 'API 端点' : 'API Endpoint'}</label>
                                    <Input
                                        value={localConfig.baseUrl || ''}
                                        onChange={(e) => setLocalConfig({ ...localConfig, baseUrl: e.target.value || undefined })}
                                        placeholder="https://api.example.com/v1"
                                        className="bg-black/20 border-white/10 text-xs font-mono"
                                    />
                                </div>
                                
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-text-secondary">{language === 'zh' ? '超时时间 (秒)' : 'Timeout (seconds)'}</label>
                                    <Input
                                        type="number"
                                        value={(localConfig.timeout || 120000) / 1000}
                                        onChange={(e) => setLocalConfig({ ...localConfig, timeout: (parseInt(e.target.value) || 120) * 1000 })}
                                        min={10}
                                        max={600}
                                        className="bg-black/20 border-white/10 text-xs w-32"
                                    />
                                </div>
                            </div>

                            <div className="pt-2 border-t border-white/5">
                                <details className="group">
                                    <summary className="flex items-center gap-2 text-xs font-medium text-text-muted cursor-pointer hover:text-accent transition-colors select-none py-1">
                                        <span className="group-open:rotate-90 transition-transform">▶</span>
                                        {language === 'zh' ? '适配器高级覆盖' : 'Adapter Overrides'}
                                    </summary>
                                    <div className="mt-3 pl-2 border-l border-white/10">
                                        <AdapterOverridesEditor
                                            overrides={localProviderConfigs[localConfig.provider]?.advanced || adapterConfigToAdvanced(currentAdapterConfig, isCustomSelected)}
                                            onChange={handleAdvancedConfigChange}
                                            language={language}
                                            defaultEndpoint={getAdapterConfig(localConfig.provider)?.request?.endpoint || '/chat/completions'}
                                            defaultConfig={isCustomSelected ? currentAdapterConfig : getAdapterConfig(localConfig.provider)}
                                        />
                                    </div>
                                </details>
                            </div>
                        </section>
                    </div>
                </div>
            )}
        </div>
    )
}