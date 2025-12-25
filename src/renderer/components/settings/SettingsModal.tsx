/**
 * 设置模态框主组件
 * 管理设置标签页切换和状态同步
 */

import { useState, useEffect } from 'react'
import { Cpu, Settings2, Code, Keyboard, Database, Shield, Monitor } from 'lucide-react'
import { useStore } from '@store'
import { PROVIDERS } from '@/shared/config/providers'
import { getEditorConfig, saveEditorConfig } from '@renderer/config/editorConfig'
import KeybindingPanel from '@components/KeybindingPanel'
import { Button, Modal, Select } from '@components/ui'
import { SettingsTab, EditorSettingsState, LANGUAGES } from './types'
import {
    ProviderSettings,
    EditorSettings,
    AgentSettings,
    SecuritySettings,
    IndexSettings,
    SystemSettings
} from './tabs'

export default function SettingsModal() {
    const {
        llmConfig, setLLMConfig, setShowSettings, language, setLanguage,
        autoApprove, setAutoApprove, providerConfigs, setProviderConfig,
        promptTemplateId, setPromptTemplateId, agentConfig, setAgentConfig,
        aiInstructions, setAiInstructions
    } = useStore()

    const [activeTab, setActiveTab] = useState<SettingsTab>('provider')
    const [showApiKey, setShowApiKey] = useState(false)
    const [localConfig, setLocalConfig] = useState(llmConfig)
    const [localLanguage, setLocalLanguage] = useState(language)
    const [localAutoApprove, setLocalAutoApprove] = useState(autoApprove)
    const [localPromptTemplateId, setLocalPromptTemplateId] = useState(promptTemplateId)
    const [localAgentConfig, setLocalAgentConfig] = useState(agentConfig)
    const [localProviderConfigs, setLocalProviderConfigs] = useState(providerConfigs)
    const [localAiInstructions, setLocalAiInstructions] = useState(aiInstructions)
    const [saved, setSaved] = useState(false)

    const editorConfig = getEditorConfig()
    const [editorSettings, setEditorSettings] = useState<EditorSettingsState>({
        fontSize: editorConfig.fontSize,
        tabSize: editorConfig.tabSize,
        wordWrap: editorConfig.wordWrap,
        lineNumbers: 'on',
        minimap: editorConfig.minimap,
        bracketPairColorization: true,
        formatOnSave: true,
        autoSave: 'off',
        theme: 'adnify-dark',
        completionEnabled: editorConfig.ai.completionEnabled,
        completionDebounceMs: editorConfig.performance.completionDebounceMs,
        completionMaxTokens: editorConfig.ai.completionMaxTokens,
    })

    // Sync store state to local state
    useEffect(() => { setLocalConfig(llmConfig) }, [llmConfig])
    useEffect(() => { setLocalProviderConfigs(providerConfigs) }, [providerConfigs])
    useEffect(() => { setLocalLanguage(language) }, [language])
    useEffect(() => { setLocalAutoApprove(autoApprove) }, [autoApprove])
    useEffect(() => { setLocalAgentConfig(agentConfig) }, [agentConfig])
    useEffect(() => { setLocalAiInstructions(aiInstructions) }, [aiInstructions])

    const handleSave = async () => {
        // Save LLM config
        setLLMConfig(localConfig)
        await window.electronAPI.setSetting('llmConfig', localConfig)

        // Save provider configs
        const updatedProviderConfigs = {
            ...localProviderConfigs,
            [localConfig.provider]: {
                ...localProviderConfigs[localConfig.provider],
                apiKey: localConfig.apiKey,
                baseUrl: localConfig.baseUrl,
                timeout: localConfig.timeout,
                adapterId: localConfig.adapterId,
                adapterConfig: localConfig.adapterConfig,
                model: localConfig.model,
            }
        }
        setProviderConfig(localConfig.provider, updatedProviderConfigs[localConfig.provider])
        await window.electronAPI.setSetting('providerConfigs', updatedProviderConfigs)

        // Save language
        setLanguage(localLanguage)
        await window.electronAPI.setSetting('language', localLanguage)

        // Save auto approve
        setAutoApprove(localAutoApprove)
        await window.electronAPI.setSetting('autoApprove', localAutoApprove)

        // Save prompt template
        setPromptTemplateId(localPromptTemplateId)
        await window.electronAPI.setSetting('promptTemplateId', localPromptTemplateId)

        // Save agent config
        setAgentConfig(localAgentConfig)
        await window.electronAPI.setSetting('agentConfig', localAgentConfig)

        // Save AI instructions
        setAiInstructions(localAiInstructions)
        await window.electronAPI.setSetting('aiInstructions', localAiInstructions)

        // Save editor settings
        const newEditorConfig = {
            ...getEditorConfig(),
            fontSize: editorSettings.fontSize,
            tabSize: editorSettings.tabSize,
            wordWrap: editorSettings.wordWrap,
            minimap: editorSettings.minimap,
            ai: {
                ...getEditorConfig().ai,
                completionEnabled: editorSettings.completionEnabled,
                completionMaxTokens: editorSettings.completionMaxTokens,
            },
            performance: {
                ...getEditorConfig().performance,
                completionDebounceMs: editorSettings.completionDebounceMs,
            }
        }
        saveEditorConfig(newEditorConfig)

        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
    }

    const providers = Object.entries(PROVIDERS).map(([id, p]) => ({
        id,
        name: p.name,
        models: [...(p.models.default || []), ...(providerConfigs[id]?.customModels || [])]
    }))
    const selectedProvider = providers.find(p => p.id === localConfig.provider)

    const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
        { id: 'provider', label: language === 'zh' ? '提供商' : 'Provider', icon: <Cpu className="w-4 h-4" /> },
        { id: 'editor', label: language === 'zh' ? '编辑器' : 'Editor', icon: <Code className="w-4 h-4" /> },
        { id: 'agent', label: 'Agent', icon: <Settings2 className="w-4 h-4" /> },
        { id: 'keybindings', label: language === 'zh' ? '快捷键' : 'Keybindings', icon: <Keyboard className="w-4 h-4" /> },
        { id: 'indexing', label: language === 'zh' ? '索引' : 'Indexing', icon: <Database className="w-4 h-4" /> },
        { id: 'security', label: language === 'zh' ? '安全' : 'Security', icon: <Shield className="w-4 h-4" /> },
        { id: 'system', label: language === 'zh' ? '系统' : 'System', icon: <Monitor className="w-4 h-4" /> },
    ]

    return (
        <Modal isOpen={true} onClose={() => setShowSettings(false)} title={language === 'zh' ? '设置' : 'Settings'} size="4xl" noPadding>
            <div className="flex h-[650px]">
                {/* Sidebar */}
                <div className="w-56 bg-surface/30 border-r border-border-subtle flex flex-col">
                    <nav className="flex-1 p-3 space-y-1">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all ${activeTab === tab.id
                                    ? 'bg-accent/10 text-accent border border-accent/20 shadow-sm'
                                    : 'text-text-secondary hover:bg-surface/50 hover:text-text-primary border border-transparent'
                                    }`}
                            >
                                {tab.icon}
                                <span className="font-medium">{tab.label}</span>
                            </button>
                        ))}
                    </nav>

                    {/* Language Selector */}
                    <div className="p-4 border-t border-border-subtle">
                        <Select
                            value={localLanguage}
                            onChange={(value) => setLocalLanguage(value as any)}
                            options={LANGUAGES.map(l => ({ value: l.id, label: l.name }))}
                            className="w-full"
                        />
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 flex flex-col min-w-0">
                    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                        {activeTab === 'provider' && (
                            <ProviderSettings
                                localConfig={localConfig}
                                setLocalConfig={setLocalConfig}
                                localProviderConfigs={localProviderConfigs}
                                setLocalProviderConfigs={setLocalProviderConfigs}
                                showApiKey={showApiKey}
                                setShowApiKey={setShowApiKey}
                                selectedProvider={selectedProvider}
                                providers={providers}
                                language={language}
                            />
                        )}
                        {activeTab === 'editor' && (
                            <EditorSettings settings={editorSettings} setSettings={setEditorSettings} language={language} />
                        )}
                        {activeTab === 'agent' && (
                            <AgentSettings
                                autoApprove={localAutoApprove}
                                setAutoApprove={setLocalAutoApprove}
                                aiInstructions={localAiInstructions}
                                setAiInstructions={setLocalAiInstructions}
                                promptTemplateId={localPromptTemplateId}
                                setPromptTemplateId={setLocalPromptTemplateId}
                                agentConfig={localAgentConfig}
                                setAgentConfig={setLocalAgentConfig}
                                language={language}
                            />
                        )}
                        {activeTab === 'keybindings' && <KeybindingPanel />}
                        {activeTab === 'indexing' && <IndexSettings language={language} />}
                        {activeTab === 'security' && <SecuritySettings language={language} />}
                        {activeTab === 'system' && <SystemSettings language={language} />}
                    </div>

                    {/* Footer */}
                    <div className="px-8 py-4 border-t border-border-subtle bg-surface/20 flex items-center justify-end gap-3">
                        <Button variant="ghost" onClick={() => setShowSettings(false)}>
                            {language === 'zh' ? '取消' : 'Cancel'}
                        </Button>
                        <Button variant={saved ? 'success' : 'primary'} onClick={handleSave}>
                            {saved ? (language === 'zh' ? '已保存' : 'Saved') : (language === 'zh' ? '保存' : 'Save')}
                        </Button>
                    </div>
                </div>
            </div>
        </Modal>
    )
}
