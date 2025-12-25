/**
 * Agent 设置组件
 */

import { useState } from 'react'
import { getPromptTemplates, getPromptTemplateSummary } from '@renderer/agent/promptTemplates'
import { Button, Input, Select, Switch } from '@components/ui'
import { AgentSettingsProps } from '../types'
import { PromptPreviewModal } from './PromptPreviewModal'

export function AgentSettings({
    autoApprove, setAutoApprove, aiInstructions, setAiInstructions,
    promptTemplateId, setPromptTemplateId, agentConfig, setAgentConfig, language
}: AgentSettingsProps) {
    const templates = getPromptTemplates()
    const [showPreview, setShowPreview] = useState(false)
    const [selectedTemplateForPreview, setSelectedTemplateForPreview] = useState<string | null>(null)

    const handlePreviewTemplate = (templateId: string) => {
        setSelectedTemplateForPreview(templateId)
        setShowPreview(true)
    }

    return (
        <div className="space-y-8 animate-fade-in">
            <section className="space-y-4 p-5 bg-surface/30 rounded-xl border border-border-subtle">
                <h4 className="text-sm font-medium text-text-secondary uppercase tracking-wider text-xs mb-2">
                    {language === 'zh' ? '自动化权限' : 'Automation Permissions'}
                </h4>
                <div className="space-y-4">
                    <Switch label={language === 'zh' ? '自动批准终端命令' : 'Auto-approve terminal commands'} checked={autoApprove.terminal} onChange={(e) => setAutoApprove({ ...autoApprove, terminal: e.target.checked })} />
                    <Switch label={language === 'zh' ? '自动批准危险操作 (删除文件等)' : 'Auto-approve dangerous operations'} checked={autoApprove.dangerous} onChange={(e) => setAutoApprove({ ...autoApprove, dangerous: e.target.checked })} />
                    <Switch label={language === 'zh' ? '启用自动检查与修复' : 'Enable Auto-check & Fix'} checked={agentConfig.enableAutoFix} onChange={(e) => setAgentConfig({ ...agentConfig, enableAutoFix: e.target.checked })} />
                    <p className="text-xs text-text-muted pl-1">
                        {language === 'zh' ? '开启后，Agent 将无需确认直接执行相应操作。请谨慎使用。' : 'When enabled, the Agent will execute operations without confirmation. Use with caution.'}
                    </p>
                </div>
            </section>

            <section className="space-y-4">
                <h4 className="text-sm font-medium text-text-secondary uppercase tracking-wider text-xs mb-2">
                    {language === 'zh' ? 'Prompt 模板' : 'Prompt Template'}
                </h4>
                <div className="space-y-3">
                    <Select
                        value={promptTemplateId}
                        onChange={(value) => setPromptTemplateId(value)}
                        options={templates.map(t => ({ value: t.id, label: `${t.name} ${t.isDefault ? '(默认)' : ''} [P${t.priority}]` }))}
                        className="w-full"
                    />

                    <div className="bg-surface/30 p-4 rounded-lg border border-border-subtle space-y-2">
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-medium text-text-primary">{templates.find(t => t.id === promptTemplateId)?.name}</span>
                                    <span className="text-xs text-text-muted px-2 py-0.5 bg-surface rounded border border-border-subtle">P{templates.find(t => t.id === promptTemplateId)?.priority}</span>
                                    {templates.find(t => t.id === promptTemplateId)?.tags?.map(tag => (
                                        <span key={tag} className="text-xs text-accent px-1.5 py-0.5 bg-accent/10 rounded">{tag}</span>
                                    ))}
                                </div>
                                <p className="text-sm text-text-secondary">
                                    {language === 'zh' ? templates.find(t => t.id === promptTemplateId)?.descriptionZh : templates.find(t => t.id === promptTemplateId)?.description}
                                </p>
                            </div>
                            <Button variant="secondary" size="sm" onClick={() => handlePreviewTemplate(promptTemplateId)} className="shrink-0">
                                {language === 'zh' ? '预览完整提示词' : 'Preview Full Prompt'}
                            </Button>
                        </div>
                    </div>

                    <div className="mt-4">
                        <details className="group">
                            <summary className="flex items-center gap-2 text-xs font-medium text-text-muted cursor-pointer hover:text-text-primary transition-colors select-none">
                                <span className="group-open:rotate-90 transition-transform">▶</span>
                                {language === 'zh' ? '查看所有模板概览' : 'View All Templates Overview'}
                            </summary>
                            <div className="mt-3 space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                                {getPromptTemplateSummary().map(t => (
                                    <div key={t.id} className="flex items-center justify-between p-2 rounded hover:bg-surface/20 transition-colors border border-transparent hover:border-border-subtle">
                                        <div className="flex items-center gap-3 flex-1">
                                            <span className="font-medium text-sm text-text-primary w-24">{t.name}</span>
                                            <span className="text-xs text-text-muted px-1.5 py-0.5 bg-surface rounded">P{t.priority}</span>
                                            <span className="text-xs text-text-secondary flex-1">{language === 'zh' ? t.descriptionZh : t.description}</span>
                                        </div>
                                        <Button variant="ghost" size="sm" onClick={() => handlePreviewTemplate(t.id)} className="text-xs px-2 py-1">
                                            {language === 'zh' ? '预览' : 'Preview'}
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </details>
                    </div>
                </div>
            </section>

            <section className="space-y-4">
                <h4 className="text-sm font-medium text-text-secondary uppercase tracking-wider text-xs mb-2">
                    {language === 'zh' ? '自定义系统指令' : 'Custom System Instructions'}
                </h4>
                <textarea
                    value={aiInstructions}
                    onChange={(e) => setAiInstructions(e.target.value)}
                    placeholder={language === 'zh' ? '在此输入全局系统指令，例如："总是使用中文回答"、"代码风格偏好..."' : 'Enter global system instructions here, e.g., "Always answer in English", "Code style preferences..."'}
                    className="w-full h-40 p-4 bg-surface/50 rounded-xl border border-border-subtle focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all resize-none text-sm font-mono custom-scrollbar"
                />
                <p className="text-xs text-text-muted">
                    {language === 'zh' ? '这些指令将附加到 System Prompt 中，影响所有 AI 回复' : 'These instructions will be appended to the System Prompt and affect all AI responses'}
                </p>
            </section>

            <section className="space-y-4">
                <h4 className="text-sm font-medium text-text-secondary uppercase tracking-wider text-xs mb-2">
                    {language === 'zh' ? '高级配置' : 'Advanced Configuration'}
                </h4>
                <div className="p-5 bg-surface/30 rounded-xl border border-border-subtle space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium text-text-primary block mb-2">{language === 'zh' ? '最大工具循环' : 'Max Tool Loops'}</label>
                            <Input type="number" value={agentConfig.maxToolLoops} onChange={(e) => setAgentConfig({ ...agentConfig, maxToolLoops: parseInt(e.target.value) || 25 })} min={5} max={100} className="w-full" />
                            <p className="text-xs text-text-muted mt-1">{language === 'zh' ? '单次对话最大工具调用次数 (5-100)' : 'Max tool calls per conversation (5-100)'}</p>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-text-primary block mb-2">{language === 'zh' ? '最大历史消息' : 'Max History Messages'}</label>
                            <Input type="number" value={agentConfig.maxHistoryMessages} onChange={(e) => setAgentConfig({ ...agentConfig, maxHistoryMessages: parseInt(e.target.value) || 50 })} min={10} max={200} className="w-full" />
                            <p className="text-xs text-text-muted mt-1">{language === 'zh' ? '保留的历史消息数量 (10-200)' : 'Number of messages to retain (10-200)'}</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium text-text-primary block mb-2">{language === 'zh' ? '工具结果字符限制' : 'Tool Result Char Limit'}</label>
                            <Input type="number" value={agentConfig.maxToolResultChars} onChange={(e) => setAgentConfig({ ...agentConfig, maxToolResultChars: parseInt(e.target.value) || 50000 })} min={10000} max={200000} step={10000} className="w-full" />
                            <p className="text-xs text-text-muted mt-1">{language === 'zh' ? '单个工具结果最大字符数' : 'Max chars per tool result'}</p>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-text-primary block mb-2">{language === 'zh' ? '上下文字符限制' : 'Context Char Limit'}</label>
                            <Input type="number" value={agentConfig.maxTotalContextChars} onChange={(e) => setAgentConfig({ ...agentConfig, maxTotalContextChars: parseInt(e.target.value) || 100000 })} min={50000} max={500000} step={10000} className="w-full" />
                            <p className="text-xs text-text-muted mt-1">{language === 'zh' ? '总上下文最大字符数' : 'Max total context chars'}</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-4">
                        <div>
                            <label className="text-sm font-medium text-text-primary block mb-2">{language === 'zh' ? '最大上下文文件数' : 'Max Context Files'}</label>
                            <Input type="number" value={agentConfig.maxContextFiles ?? 6} onChange={(e) => setAgentConfig({ ...agentConfig, maxContextFiles: parseInt(e.target.value) || 6 })} min={1} max={20} step={1} className="w-full" />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-text-primary block mb-2">{language === 'zh' ? '语义搜索结果数' : 'Semantic Search Results'}</label>
                            <Input type="number" value={agentConfig.maxSemanticResults ?? 5} onChange={(e) => setAgentConfig({ ...agentConfig, maxSemanticResults: parseInt(e.target.value) || 5 })} min={1} max={20} step={1} className="w-full" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-4">
                        <div>
                            <label className="text-sm font-medium text-text-primary block mb-2">{language === 'zh' ? '终端输出字符限制' : 'Terminal Char Limit'}</label>
                            <Input type="number" value={agentConfig.maxTerminalChars ?? 3000} onChange={(e) => setAgentConfig({ ...agentConfig, maxTerminalChars: parseInt(e.target.value) || 3000 })} min={1000} max={10000} step={500} className="w-full" />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-text-primary block mb-2">{language === 'zh' ? '单文件字符限制' : 'Single File Char Limit'}</label>
                            <Input type="number" value={agentConfig.maxSingleFileChars ?? 6000} onChange={(e) => setAgentConfig({ ...agentConfig, maxSingleFileChars: parseInt(e.target.value) || 6000 })} min={2000} max={30000} step={1000} className="w-full" />
                        </div>
                    </div>
                </div>
            </section>

            {showPreview && selectedTemplateForPreview && (
                <PromptPreviewModal templateId={selectedTemplateForPreview} language={language} onClose={() => setShowPreview(false)} />
            )}
        </div>
    )
}
