/**
 * 索引设置组件
 */

import { logger } from '@utils/Logger'
import { useState, useEffect } from 'react'
import { Eye, EyeOff, AlertTriangle, Database, Settings2 } from 'lucide-react'
import { useStore } from '@store'
import { toast } from '@components/common/ToastProvider'
import { Button, Input, Select } from '@components/ui'
import { Language } from '@renderer/i18n'
import type { EmbeddingConfigInput } from '@renderer/types/electron'

interface IndexSettingsProps {
    language: Language
}

// Embedding 配置状态
interface EmbeddingConfigState {
    provider: string
    apiKey: string
    model: string
    baseUrl: string
    dimensions: number
}

// 默认索引配置
const DEFAULT_INDEX_OPTIONS = {
    chunkSize: 80,
    chunkOverlap: 10,
    maxFileSize: 1024 * 1024, // 1MB
}

// 默认 Embedding 配置
const DEFAULT_EMBEDDING_CONFIG: EmbeddingConfigState = {
    provider: 'jina',
    apiKey: '',
    model: '',
    baseUrl: '',
    dimensions: 768,
}

export function IndexSettings({ language }: IndexSettingsProps) {
    const { workspacePath } = useStore()
    const [embeddingConfig, setEmbeddingConfig] = useState<EmbeddingConfigState>(DEFAULT_EMBEDDING_CONFIG)
    const [showApiKey, setShowApiKey] = useState(false)
    const [isIndexing, setIsIndexing] = useState(false)
    const [indexStatus, setIndexStatus] = useState<{ totalFiles: number; indexedFiles: number; isIndexing: boolean } | null>(null)
    const [showAdvanced, setShowAdvanced] = useState(false)
    const [indexOptions, setIndexOptions] = useState(DEFAULT_INDEX_OPTIONS)

    const EMBEDDING_PROVIDERS = [
        { id: 'jina', name: 'Jina AI', description: language === 'zh' ? '免费 100万 tokens/月，专为代码优化' : 'Free 100M tokens/month, optimized for code' },
        { id: 'voyage', name: 'Voyage AI', description: language === 'zh' ? '免费 5000万 tokens，代码专用模型' : 'Free 50M tokens, code-specific model' },
        { id: 'cohere', name: 'Cohere', description: language === 'zh' ? '免费 100次/分钟' : 'Free 100 calls/min' },
        { id: 'huggingface', name: 'HuggingFace', description: language === 'zh' ? '免费，有速率限制' : 'Free with rate limits' },
        { id: 'ollama', name: 'Ollama', description: language === 'zh' ? '本地运行，完全免费' : 'Local, completely free' },
        { id: 'openai', name: 'OpenAI', description: language === 'zh' ? '付费，质量最高' : 'Paid, highest quality' },
        { id: 'custom', name: language === 'zh' ? '自定义服务' : 'Custom Service', description: language === 'zh' ? '兼容 OpenAI API 格式的自定义服务' : 'OpenAI API compatible custom service' },
    ]

    useEffect(() => {
        window.electronAPI.getSetting('embeddingConfig').then(config => {
            if (config) {
                const cfg = config as Partial<EmbeddingConfigState>
                setEmbeddingConfig(prev => ({
                    ...prev,
                    provider: cfg.provider || prev.provider,
                    apiKey: cfg.apiKey || '',
                    model: cfg.model || '',
                    baseUrl: cfg.baseUrl || '',
                    dimensions: cfg.dimensions || 768,
                }))
            }
        })
        window.electronAPI.getSetting('indexOptions').then(options => {
            if (options) {
                setIndexOptions({ ...DEFAULT_INDEX_OPTIONS, ...(options as typeof DEFAULT_INDEX_OPTIONS) })
            }
        })
    }, [])

    // 切换 provider 时重置相关字段
    const handleProviderChange = (provider: string) => {
        setEmbeddingConfig(prev => ({
            ...prev,
            provider,
            model: '',  // 重置 model，让后端使用默认值
            baseUrl: provider === 'custom' ? prev.baseUrl : '',  // 只有自定义服务保留 baseUrl
        }))
    }

    useEffect(() => {
        if (workspacePath) {
            window.electronAPI.indexStatus?.(workspacePath).then(status => {
                setIndexStatus(status)
            }).catch(() => { })
        }
    }, [workspacePath])

    const handleSaveEmbeddingConfig = async () => {
        // 自定义服务必须填写 baseUrl
        if (embeddingConfig.provider === 'custom' && !embeddingConfig.baseUrl) {
            toast.error(language === 'zh' ? '自定义服务必须填写 API 地址' : 'Custom service requires API URL')
            return
        }

        // 构建配置对象，只包含有值的字段
        const configToSave: EmbeddingConfigInput = {
            provider: embeddingConfig.provider as EmbeddingConfigInput['provider'],
        }

        // 只有非空值才添加到配置中
        if (embeddingConfig.apiKey) {
            configToSave.apiKey = embeddingConfig.apiKey
        }
        if (embeddingConfig.model) {
            configToSave.model = embeddingConfig.model
        }
        if (embeddingConfig.baseUrl) {
            configToSave.baseUrl = embeddingConfig.baseUrl
        }
        if (embeddingConfig.provider === 'custom' && embeddingConfig.dimensions) {
            configToSave.dimensions = embeddingConfig.dimensions
        }

        logger.settings.info('[IndexSettings] Saving embedding config:', configToSave)

        try {
            await window.electronAPI.setSetting('embeddingConfig', configToSave)
            await window.electronAPI.setSetting('indexOptions', indexOptions)
            if (workspacePath) {
                await window.electronAPI.indexUpdateEmbeddingConfig?.(workspacePath, configToSave)
            }
            toast.success(language === 'zh' ? '索引配置已保存' : 'Indexing configuration saved')
        } catch (error) {
            logger.settings.error('[IndexSettings] Save failed:', error)
            toast.error(language === 'zh' ? '保存失败' : 'Save failed')
        }
    }

    const handleStartIndexing = async () => {
        if (!workspacePath) {
            toast.error(language === 'zh' ? '请先打开一个工作区' : 'Please open a workspace first')
            return
        }
        setIsIndexing(true)
        try {
            await handleSaveEmbeddingConfig()
            await window.electronAPI.indexStart(workspacePath)
            toast.success(language === 'zh' ? '索引已开始，后台运行中...' : 'Indexing started, running in background...')
        } catch (error) {
            logger.settings.error('[IndexSettings] Start indexing failed:', error)
            toast.error(language === 'zh' ? '启动索引失败' : 'Failed to start indexing')
        } finally {
            setIsIndexing(false)
        }
    }

    const handleClearIndex = async () => {
        if (!workspacePath) return
        try {
            await window.electronAPI.indexClear?.(workspacePath)
            toast.success(language === 'zh' ? '索引已清除' : 'Index cleared')
            setIndexStatus(null)
        } catch {
            toast.error(language === 'zh' ? '清除索引失败' : 'Failed to clear index')
        }
    }

    return (
        <div className="space-y-8 animate-fade-in">
            <section>
                <h4 className="text-sm font-medium text-text-secondary uppercase tracking-wider text-xs mb-4">
                    {language === 'zh' ? 'Embedding 提供商' : 'Embedding Provider'}
                </h4>
                <div className="space-y-4">
                    <div className="p-5 bg-surface/30 rounded-xl border border-border-subtle space-y-4">
                        <div>
                            <label className="text-sm font-medium text-text-primary block mb-2">{language === 'zh' ? '选择提供商' : 'Select Provider'}</label>
                            <Select value={embeddingConfig.provider} onChange={handleProviderChange} options={EMBEDDING_PROVIDERS.map(p => ({ value: p.id, label: `${p.name} - ${p.description}` }))} />
                        </div>

                        {/* 自定义服务配置 */}
                        {embeddingConfig.provider === 'custom' && (
                            <div className="space-y-3 p-3 bg-surface/50 rounded-lg border border-border-subtle">
                                <div>
                                    <label className="text-sm font-medium text-text-primary block mb-2">
                                        API URL <span className="text-error">*</span>
                                    </label>
                                    <Input
                                        type="text"
                                        value={embeddingConfig.baseUrl}
                                        onChange={(e) => setEmbeddingConfig(prev => ({ ...prev, baseUrl: e.target.value }))}
                                        placeholder="https://your-service.com/v1/embeddings"
                                    />
                                    <p className="text-xs text-text-muted mt-1">
                                        {language === 'zh' ? '兼容 OpenAI embeddings API 格式' : 'OpenAI embeddings API compatible endpoint'}
                                    </p>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-sm font-medium text-text-primary block mb-2">
                                            {language === 'zh' ? '模型名称' : 'Model Name'}
                                        </label>
                                        <Input
                                            type="text"
                                            value={embeddingConfig.model}
                                            onChange={(e) => setEmbeddingConfig(prev => ({ ...prev, model: e.target.value }))}
                                            placeholder="text-embedding-3-small"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-text-primary block mb-2">
                                            {language === 'zh' ? '向量维度' : 'Vector Dimensions'}
                                        </label>
                                        <Input
                                            type="number"
                                            value={embeddingConfig.dimensions}
                                            onChange={(e) => setEmbeddingConfig(prev => ({ ...prev, dimensions: parseInt(e.target.value) || 768 }))}
                                            min={128}
                                            max={4096}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {embeddingConfig.provider !== 'ollama' && (
                            <div>
                                <label className="text-sm font-medium text-text-primary block mb-2">
                                    API Key {embeddingConfig.provider !== 'custom' && <span className="text-text-muted text-xs">({language === 'zh' ? '必填' : 'required'})</span>}
                                </label>
                                <div className="relative">
                                    <Input type={showApiKey ? 'text' : 'password'} value={embeddingConfig.apiKey} onChange={(e) => setEmbeddingConfig(prev => ({ ...prev, apiKey: e.target.value }))} placeholder={language === 'zh' ? '输入 API Key' : 'Enter API Key'} />
                                    <button type="button" onClick={() => setShowApiKey(!showApiKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary">
                                        {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                                {embeddingConfig.provider === 'custom' && (
                                    <p className="text-xs text-text-muted mt-1">
                                        {language === 'zh' ? '如果服务不需要认证可留空' : 'Leave empty if service does not require authentication'}
                                    </p>
                                )}
                            </div>
                        )}

                        {/* 高级配置 */}
                        <div className="pt-2">
                            <button
                                onClick={() => setShowAdvanced(!showAdvanced)}
                                className="flex items-center gap-2 text-xs font-medium text-text-muted hover:text-accent transition-colors"
                            >
                                <Settings2 className="w-3.5 h-3.5" />
                                <span className={`transition-transform duration-200 ${showAdvanced ? 'rotate-90' : ''}`}>▶</span>
                                {language === 'zh' ? '高级配置' : 'Advanced Settings'}
                            </button>

                            {showAdvanced && (
                                <div className="mt-3 space-y-3 pl-2 animate-slide-down">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-xs text-text-muted">{language === 'zh' ? '块大小 (行)' : 'Chunk Size (lines)'}</label>
                                            <Input
                                                type="number"
                                                value={indexOptions.chunkSize}
                                                onChange={(e) => setIndexOptions({ ...indexOptions, chunkSize: parseInt(e.target.value) || 80 })}
                                                min={20}
                                                max={200}
                                                className="text-xs"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs text-text-muted">{language === 'zh' ? '块重叠 (行)' : 'Chunk Overlap (lines)'}</label>
                                            <Input
                                                type="number"
                                                value={indexOptions.chunkOverlap}
                                                onChange={(e) => setIndexOptions({ ...indexOptions, chunkOverlap: parseInt(e.target.value) || 10 })}
                                                min={0}
                                                max={50}
                                                className="text-xs"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs text-text-muted">{language === 'zh' ? '最大文件大小 (KB)' : 'Max File Size (KB)'}</label>
                                        <Input
                                            type="number"
                                            value={Math.round(indexOptions.maxFileSize / 1024)}
                                            onChange={(e) => setIndexOptions({ ...indexOptions, maxFileSize: (parseInt(e.target.value) || 1024) * 1024 })}
                                            min={100}
                                            max={10240}
                                            className="text-xs"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        <Button variant="secondary" size="sm" onClick={handleSaveEmbeddingConfig}>
                            {language === 'zh' ? '保存配置' : 'Save Configuration'}
                        </Button>
                    </div>
                </div>
            </section>

            <section>
                <h4 className="text-sm font-medium text-text-secondary uppercase tracking-wider text-xs mb-4">
                    {language === 'zh' ? '代码库索引' : 'Codebase Index'}
                </h4>
                <div className="space-y-4">
                    {indexStatus && (
                        <div className="p-4 bg-surface/30 rounded-xl border border-border-subtle">
                            <div className="text-sm text-text-primary">
                                {language === 'zh' ? '索引状态' : 'Index Status'}: {indexStatus.isIndexing ? (language === 'zh' ? '索引中...' : 'Indexing...') : (language === 'zh' ? '就绪' : 'Ready')}
                            </div>
                            <div className="text-xs text-text-muted mt-1">
                                {language === 'zh' ? '已索引文件' : 'Indexed files'}: {indexStatus.indexedFiles} / {indexStatus.totalFiles}
                            </div>
                        </div>
                    )}

                    <div className="flex gap-3">
                        <Button variant="primary" onClick={handleStartIndexing} disabled={isIndexing || !workspacePath} leftIcon={<Database className="w-4 h-4" />}>
                            {isIndexing ? (language === 'zh' ? '索引中...' : 'Indexing...') : (language === 'zh' ? '开始索引' : 'Start Indexing')}
                        </Button>
                        <Button variant="secondary" onClick={handleClearIndex} disabled={!workspacePath}>
                            {language === 'zh' ? '清除索引' : 'Clear Index'}
                        </Button>
                    </div>

                    {!workspacePath && (
                        <div className="flex items-center gap-2 text-xs text-warning">
                            <AlertTriangle className="w-4 h-4" />
                            {language === 'zh' ? '请先打开一个工作区才能进行索引' : 'Please open a workspace first to start indexing'}
                        </div>
                    )}
                </div>
            </section>
        </div>
    )
}
