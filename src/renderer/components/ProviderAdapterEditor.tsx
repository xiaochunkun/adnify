/**
 * Provider Adapter Editor
 * 可视化配置 LLM Provider 的工具调用格式
 */

import { useState, useEffect, useCallback } from 'react'
import { Check, ChevronDown, Code2, FileJson, Settings2, Sparkles, Copy } from 'lucide-react'
import { Select, Switch } from './ui'

// 适配器配置接口
interface AdapterConfig {
    responseFormat: 'json' | 'xml' | 'mixed'
    toolCallPath: string
    toolNamePath: string
    toolArgsPath: string
    argsIsObject: boolean
    autoGenerateId: boolean
    // XML 配置
    xmlToolCallTag?: string
    xmlNameSource?: string
    xmlArgsTag?: string
}

// 内置适配器预设及其配置
const BUILTIN_ADAPTERS: Record<string, { name: string; description: string; config: AdapterConfig }> = {
    openai: {
        name: 'OpenAI',
        description: 'GPT-4, GPT-3.5',
        config: {
            responseFormat: 'json',
            toolCallPath: 'tool_calls',
            toolNamePath: 'function.name',
            toolArgsPath: 'function.arguments',
            argsIsObject: false,
            autoGenerateId: false
        }
    },
    anthropic: {
        name: 'Anthropic',
        description: 'Claude 系列',
        config: {
            responseFormat: 'json',
            toolCallPath: 'tool_use',
            toolNamePath: 'name',
            toolArgsPath: 'input',
            argsIsObject: true,
            autoGenerateId: false
        }
    },
    deepseek: {
        name: 'DeepSeek',
        description: 'OpenAI 兼容',
        config: {
            responseFormat: 'json',
            toolCallPath: 'tool_calls',
            toolNamePath: 'function.name',
            toolArgsPath: 'function.arguments',
            argsIsObject: false,
            autoGenerateId: false
        }
    },
    qwen: {
        name: '千问 Qwen',
        description: '阿里云',
        config: {
            responseFormat: 'json',
            toolCallPath: 'tool_calls',
            toolNamePath: 'function.name',
            toolArgsPath: 'function.arguments',
            argsIsObject: false,
            autoGenerateId: true
        }
    },
    glm: {
        name: '智谱 GLM',
        description: 'GLM-4',
        config: {
            responseFormat: 'json',
            toolCallPath: 'tool_calls',
            toolNamePath: 'function.name',
            toolArgsPath: 'function.arguments',
            argsIsObject: true,
            autoGenerateId: false
        }
    },
    'xml-generic': {
        name: 'XML 格式',
        description: 'Llama 等',
        config: {
            responseFormat: 'xml',
            toolCallPath: '',
            toolNamePath: '',
            toolArgsPath: '',
            argsIsObject: false,
            autoGenerateId: true,
            xmlToolCallTag: 'tool_call',
            xmlNameSource: 'name',
            xmlArgsTag: 'arguments'
        }
    },
    mixed: {
        name: '混合格式',
        description: 'JSON + XML',
        config: {
            responseFormat: 'mixed',
            toolCallPath: 'tool_calls',
            toolNamePath: 'function.name',
            toolArgsPath: 'function.arguments',
            argsIsObject: false,
            autoGenerateId: true,
            xmlToolCallTag: 'tool_call',
            xmlNameSource: 'name',
            xmlArgsTag: 'arguments'
        }
    },
    custom: {
        name: '自定义',
        description: '完全自定义配置',
        config: {
            responseFormat: 'json',
            toolCallPath: 'tool_calls',
            toolNamePath: 'function.name',
            toolArgsPath: 'function.arguments',
            argsIsObject: false,
            autoGenerateId: false
        }
    }
}

interface ProviderAdapterEditorProps {
    adapterId?: string
    adapterConfig?: AdapterConfig
    onAdapterChange: (adapterId: string, config?: AdapterConfig) => void
    language: 'en' | 'zh'
}

export default function ProviderAdapterEditor({
    adapterId = 'openai',
    adapterConfig,
    onAdapterChange,
    language
}: ProviderAdapterEditorProps) {
    const [copied, setCopied] = useState(false)

    // 当前配置
    const [localConfig, setLocalConfig] = useState<AdapterConfig>(() => {
        if (adapterConfig) return adapterConfig
        return BUILTIN_ADAPTERS[adapterId]?.config || BUILTIN_ADAPTERS.openai.config
    })

    const isCustomMode = adapterId === 'custom'

    // 当 adapterId 改变时，加载对应预设配置
    useEffect(() => {
        if (adapterId && BUILTIN_ADAPTERS[adapterId]) {
            setLocalConfig(BUILTIN_ADAPTERS[adapterId].config)
        }
    }, [adapterId])

    // 配置变化时通知父组件
    const handleConfigChange = useCallback((updates: Partial<AdapterConfig>) => {
        const newConfig = { ...localConfig, ...updates }
        setLocalConfig(newConfig)
        onAdapterChange('custom', newConfig)
    }, [localConfig, onAdapterChange])

    // 选择预设
    const handlePresetSelect = (presetId: string) => {
        if (BUILTIN_ADAPTERS[presetId]) {
            const config = BUILTIN_ADAPTERS[presetId].config
            setLocalConfig(config)
            onAdapterChange(presetId, config)
        }
    }

    const handleCopyConfig = () => {
        const configJson = JSON.stringify({
            adapterId,
            ...localConfig
        }, null, 2)
        navigator.clipboard.writeText(configJson)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <div className="space-y-4 mt-4 p-4 bg-surface/20 rounded-lg border border-border-subtle">
            {/* 标题 */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Settings2 className="w-4 h-4 text-accent" />
                    <span className="text-sm font-medium text-text-primary">
                        {language === 'zh' ? '工具调用适配器' : 'Tool Call Adapter'}
                    </span>
                </div>
                <button
                    onClick={handleCopyConfig}
                    className="flex items-center gap-1.5 px-2 py-1 text-xs text-text-muted hover:text-text-primary transition-colors"
                >
                    {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                    {copied ? (language === 'zh' ? '已复制' : 'Copied') : (language === 'zh' ? '复制' : 'Copy')}
                </button>
            </div>

            {/* 适配器选择 - 网格布局 */}
            <div className="grid grid-cols-4 gap-2">
                {Object.entries(BUILTIN_ADAPTERS).map(([id, adapter]) => (
                    <button
                        key={id}
                        onClick={() => handlePresetSelect(id)}
                        className={`
              relative flex flex-col items-center justify-center p-2.5 rounded-lg border text-center transition-all duration-200
              ${adapterId === id
                                ? 'border-accent bg-accent/10 text-accent shadow-sm'
                                : 'border-border-subtle bg-surface/30 text-text-muted hover:bg-surface hover:border-border hover:text-text-primary'
                            }
              ${id === 'custom' ? 'col-span-1 bg-gradient-to-br from-surface/50 to-accent/5' : ''}
            `}
                    >
                        <span className="text-xs font-medium">{adapter.name}</span>
                        <span className="text-[9px] text-text-muted mt-0.5 truncate w-full">{adapter.description}</span>
                        {adapterId === id && (
                            <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-accent" />
                        )}
                    </button>
                ))}
            </div>

            {/* 自定义配置 - 只在选择 Custom 时显示 */}
            {isCustomMode && (
                <div className="space-y-4 p-4 bg-surface/30 rounded-lg border border-accent/20 animate-fade-in">
                    <div className="flex items-center gap-2 text-xs text-accent font-medium">
                        <Sparkles className="w-3.5 h-3.5" />
                        {language === 'zh' ? '自定义配置' : 'Custom Configuration'}
                    </div>

                    {/* 响应格式 */}
                    <div className="space-y-2">
                        <label className="flex items-center gap-1.5 text-xs text-text-secondary">
                            <FileJson className="w-3 h-3" />
                            {language === 'zh' ? '响应格式' : 'Response Format'}
                        </label>
                        <Select
                            value={localConfig.responseFormat}
                            onChange={(value) => handleConfigChange({ responseFormat: value as 'json' | 'xml' | 'mixed' })}
                            options={[
                                { value: 'json', label: 'JSON' },
                                { value: 'xml', label: 'XML' },
                                { value: 'mixed', label: language === 'zh' ? '混合 (JSON + XML)' : 'Mixed (JSON + XML)' },
                            ]}
                            className="w-full"
                        />
                    </div>

                    {/* JSON 配置 */}
                    {(localConfig.responseFormat === 'json' || localConfig.responseFormat === 'mixed') && (
                        <>
                            <div className="space-y-2">
                                <label className="flex items-center gap-1.5 text-xs text-text-secondary">
                                    <Code2 className="w-3 h-3" />
                                    {language === 'zh' ? '工具调用路径' : 'Tool Call Path'}
                                </label>
                                <input
                                    type="text"
                                    value={localConfig.toolCallPath}
                                    onChange={(e) => handleConfigChange({ toolCallPath: e.target.value })}
                                    className="w-full px-3 py-2 text-sm bg-surface/50 border border-border-subtle rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                                    placeholder="e.g., tool_calls, function_call"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <label className="text-xs text-text-secondary">
                                        {language === 'zh' ? '名称路径' : 'Name Path'}
                                    </label>
                                    <input
                                        type="text"
                                        value={localConfig.toolNamePath}
                                        onChange={(e) => handleConfigChange({ toolNamePath: e.target.value })}
                                        className="w-full px-3 py-2 text-sm bg-surface/50 border border-border-subtle rounded-lg text-text-primary focus:outline-none focus:border-accent"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs text-text-secondary">
                                        {language === 'zh' ? '参数路径' : 'Args Path'}
                                    </label>
                                    <input
                                        type="text"
                                        value={localConfig.toolArgsPath}
                                        onChange={(e) => handleConfigChange({ toolArgsPath: e.target.value })}
                                        className="w-full px-3 py-2 text-sm bg-surface/50 border border-border-subtle rounded-lg text-text-primary focus:outline-none focus:border-accent"
                                    />
                                </div>
                            </div>
                        </>
                    )}

                    {/* XML 配置 */}
                    {(localConfig.responseFormat === 'xml' || localConfig.responseFormat === 'mixed') && (
                        <div className="space-y-3 p-3 bg-surface/20 rounded-lg border border-border-subtle">
                            <label className="text-xs text-text-secondary font-medium">
                                {language === 'zh' ? 'XML 配置' : 'XML Configuration'}
                            </label>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] text-text-muted">
                                        {language === 'zh' ? '标签名' : 'Tag'}
                                    </label>
                                    <input
                                        type="text"
                                        value={localConfig.xmlToolCallTag || 'tool_call'}
                                        onChange={(e) => handleConfigChange({ xmlToolCallTag: e.target.value })}
                                        className="w-full px-2 py-1.5 text-xs bg-surface/50 border border-border-subtle rounded text-text-primary focus:outline-none focus:border-accent"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] text-text-muted">
                                        {language === 'zh' ? '名称' : 'Name'}
                                    </label>
                                    <input
                                        type="text"
                                        value={localConfig.xmlNameSource || 'name'}
                                        onChange={(e) => handleConfigChange({ xmlNameSource: e.target.value })}
                                        className="w-full px-2 py-1.5 text-xs bg-surface/50 border border-border-subtle rounded text-text-primary focus:outline-none focus:border-accent"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] text-text-muted">
                                        {language === 'zh' ? '参数' : 'Args'}
                                    </label>
                                    <input
                                        type="text"
                                        value={localConfig.xmlArgsTag || 'arguments'}
                                        onChange={(e) => handleConfigChange({ xmlArgsTag: e.target.value })}
                                        className="w-full px-2 py-1.5 text-xs bg-surface/50 border border-border-subtle rounded text-text-primary focus:outline-none focus:border-accent"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 选项 */}
                    <div className="flex flex-wrap gap-4">
                        <Switch
                            label={language === 'zh' ? '参数已是对象' : 'Args is object'}
                            checked={localConfig.argsIsObject}
                            onChange={(e) => handleConfigChange({ argsIsObject: e.target.checked })}
                        />
                        <Switch
                            label={language === 'zh' ? '自动生成 ID' : 'Auto generate ID'}
                            checked={localConfig.autoGenerateId}
                            onChange={(e) => handleConfigChange({ autoGenerateId: e.target.checked })}
                        />
                    </div>
                </div>
            )}
        </div>
    )
}
