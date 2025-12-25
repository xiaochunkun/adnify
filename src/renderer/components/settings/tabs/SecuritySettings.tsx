/**
 * 安全设置组件
 */

import { useState } from 'react'
import { AlertTriangle, Plus, Trash } from 'lucide-react'
import { useStore } from '@store'
import { getEditorConfig, saveEditorConfig, EditorConfig } from '@renderer/config/editorConfig'
import { Button, Input, Switch } from '@components/ui'
import { Language } from '@renderer/i18n'

interface SecuritySettingsProps {
    language: Language
}

export function SecuritySettings({ language }: SecuritySettingsProps) {
    const [editorConfig, setEditorConfig] = useState<EditorConfig>(getEditorConfig())
    const { securitySettings, setSecuritySettings } = useStore()
    const [newIgnoredDir, setNewIgnoredDir] = useState('')

    const handleAddIgnoredDir = () => {
        if (newIgnoredDir.trim() && !editorConfig.ignoredDirectories.includes(newIgnoredDir.trim())) {
            const newDirs = [...editorConfig.ignoredDirectories, newIgnoredDir.trim()]
            const newConfig = { ...editorConfig, ignoredDirectories: newDirs }
            setEditorConfig(newConfig)
            saveEditorConfig(newConfig)
            setNewIgnoredDir('')
        }
    }

    const handleRemoveIgnoredDir = (dir: string) => {
        const newDirs = editorConfig.ignoredDirectories.filter(d => d !== dir)
        const newConfig = { ...editorConfig, ignoredDirectories: newDirs }
        setEditorConfig(newConfig)
        saveEditorConfig(newConfig)
    }

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                <div>
                    <h3 className="text-sm font-medium text-yellow-500 mb-1">
                        {language === 'zh' ? '安全沙箱 (开发中)' : 'Security Sandbox (WIP)'}
                    </h3>
                    <p className="text-xs text-text-secondary leading-relaxed opacity-80">
                        {language === 'zh'
                            ? 'Adnify 目前直接在您的系统上运行命令。请确保您只运行受信任的代码。未来版本将引入基于 Docker 的沙箱环境。'
                            : 'Adnify currently runs commands directly on your system. Ensure you only run trusted code. Future versions will introduce a Docker-based sandbox.'}
                    </p>
                </div>
            </div>

            <section className="space-y-4 p-5 bg-surface/30 rounded-xl border border-border-subtle">
                <h4 className="text-sm font-medium text-text-secondary uppercase tracking-wider text-xs mb-2">
                    {language === 'zh' ? '安全选项' : 'Security Options'}
                </h4>
                <div className="space-y-4">
                    <Switch label={language === 'zh' ? '启用操作确认' : 'Enable permission confirmation'} checked={securitySettings.enablePermissionConfirm} onChange={(e) => setSecuritySettings({ enablePermissionConfirm: e.target.checked })} />
                    <Switch label={language === 'zh' ? '启用审计日志' : 'Enable audit log'} checked={securitySettings.enableAuditLog} onChange={(e) => setSecuritySettings({ enableAuditLog: e.target.checked })} />
                    <Switch label={language === 'zh' ? '严格工作区模式' : 'Strict workspace mode'} checked={securitySettings.strictWorkspaceMode} onChange={(e) => setSecuritySettings({ strictWorkspaceMode: e.target.checked })} />
                    <Switch label={language === 'zh' ? '显示安全警告' : 'Show security warnings'} checked={securitySettings.showSecurityWarnings} onChange={(e) => setSecuritySettings({ showSecurityWarnings: e.target.checked })} />
                </div>
            </section>

            <section className="space-y-4">
                <h4 className="text-sm font-medium text-text-secondary uppercase tracking-wider text-xs mb-2">
                    {language === 'zh' ? '忽略的目录' : 'Ignored Directories'}
                </h4>
                <p className="text-xs text-text-muted mb-3">
                    {language === 'zh' ? '这些目录将被文件索引和 AI 分析忽略' : 'These directories will be ignored by file indexing and AI analysis'}
                </p>

                <div className="flex gap-2 mb-3">
                    <Input
                        value={newIgnoredDir}
                        onChange={(e) => setNewIgnoredDir(e.target.value)}
                        placeholder={language === 'zh' ? '输入目录名称 (例如: node_modules)' : 'Enter directory name (e.g., node_modules)'}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddIgnoredDir()}
                        className="flex-1"
                    />
                    <Button variant="secondary" onClick={handleAddIgnoredDir} disabled={!newIgnoredDir.trim()} className="px-3">
                        <Plus className="w-4 h-4" />
                    </Button>
                </div>

                <div className="flex flex-wrap gap-2 p-4 bg-surface/30 rounded-xl border border-border-subtle min-h-[100px]">
                    {editorConfig.ignoredDirectories.map(dir => (
                        <div key={dir} className="flex items-center gap-1.5 px-3 py-1.5 bg-surface rounded-lg border border-border-subtle text-xs text-text-secondary group hover:border-red-500/30 transition-colors">
                            <span className="font-mono">{dir}</span>
                            <button onClick={() => handleRemoveIgnoredDir(dir)} className="text-text-muted hover:text-red-400 transition-colors">
                                <Trash className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    )
}
