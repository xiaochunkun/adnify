/**
 * 索引设置组件
 */

import { logger } from '@utils/Logger'
import { useState, useEffect } from 'react'
import { Eye, EyeOff, AlertTriangle, Database } from 'lucide-react'
import { useStore } from '@store'
import { toast } from '@components/ToastProvider'
import { Button, Input, Select } from '@components/ui'
import { Language } from '@renderer/i18n'

interface IndexSettingsProps {
    language: Language
}

export function IndexSettings({ language }: IndexSettingsProps) {
    const { workspacePath } = useStore()
    const [embeddingProvider, setEmbeddingProvider] = useState('jina')
    const [embeddingApiKey, setEmbeddingApiKey] = useState('')
    const [showApiKey, setShowApiKey] = useState(false)
    const [isIndexing, setIsIndexing] = useState(false)
    const [indexStatus, setIndexStatus] = useState<{ totalFiles: number; indexedFiles: number; isIndexing: boolean } | null>(null)

    const EMBEDDING_PROVIDERS = [
        { id: 'jina', name: 'Jina AI', description: language === 'zh' ? '免费 100万 tokens/月，专为代码优化' : 'Free 100M tokens/month, optimized for code' },
        { id: 'voyage', name: 'Voyage AI', description: language === 'zh' ? '免费 5000万 tokens，代码专用模型' : 'Free 50M tokens, code-specific model' },
        { id: 'cohere', name: 'Cohere', description: language === 'zh' ? '免费 100次/分钟' : 'Free 100 calls/min' },
        { id: 'huggingface', name: 'HuggingFace', description: language === 'zh' ? '免费，有速率限制' : 'Free with rate limits' },
        { id: 'ollama', name: 'Ollama', description: language === 'zh' ? '本地运行，完全免费' : 'Local, completely free' },
        { id: 'openai', name: 'OpenAI', description: language === 'zh' ? '付费，质量最高' : 'Paid, highest quality' },
    ]

    useEffect(() => {
        window.electronAPI.getSetting('embeddingConfig').then(config => {
            if (config) {
                const cfg = config as { provider?: string; apiKey?: string }
                if (cfg.provider) setEmbeddingProvider(cfg.provider)
                if (cfg.apiKey) setEmbeddingApiKey(cfg.apiKey)
            }
        })
    }, [])

    useEffect(() => {
        if (workspacePath) {
            window.electronAPI.indexStatus?.(workspacePath).then(status => {
                setIndexStatus(status)
            }).catch(() => { })
        }
    }, [workspacePath])

    const handleSaveEmbeddingConfig = async () => {
        await window.electronAPI.setSetting('embeddingConfig', { provider: embeddingProvider, apiKey: embeddingApiKey })
        if (workspacePath) {
            await window.electronAPI.indexUpdateEmbeddingConfig?.(workspacePath, {
                provider: embeddingProvider as 'jina' | 'voyage' | 'openai' | 'cohere' | 'huggingface' | 'ollama',
                apiKey: embeddingApiKey,
            })
        }
        toast.success(language === 'zh' ? '索引配置已保存' : 'Indexing configuration saved')
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
                            <Select value={embeddingProvider} onChange={(value) => setEmbeddingProvider(value)} options={EMBEDDING_PROVIDERS.map(p => ({ value: p.id, label: `${p.name} - ${p.description}` }))} />
                        </div>

                        {embeddingProvider !== 'ollama' && (
                            <div>
                                <label className="text-sm font-medium text-text-primary block mb-2">API Key</label>
                                <div className="relative">
                                    <Input type={showApiKey ? 'text' : 'password'} value={embeddingApiKey} onChange={(e) => setEmbeddingApiKey(e.target.value)} placeholder={language === 'zh' ? '输入 API Key' : 'Enter API Key'} />
                                    <button type="button" onClick={() => setShowApiKey(!showApiKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary">
                                        {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                        )}

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
