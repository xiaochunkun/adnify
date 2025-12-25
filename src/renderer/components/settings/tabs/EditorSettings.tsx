/**
 * 编辑器设置组件
 */

import { useState } from 'react'
import { Layout, Type, Sparkles, Terminal, Check } from 'lucide-react'
import { useStore } from '@store'
import { getEditorConfig, saveEditorConfig, EditorConfig } from '@renderer/config/editorConfig'
import { themes } from '@components/ThemeManager'
import { Input, Select, Switch } from '@components/ui'
import { EditorSettingsProps } from '../types'

export function EditorSettings({ settings, setSettings, language }: EditorSettingsProps) {
    const [advancedConfig, setAdvancedConfig] = useState<EditorConfig>(getEditorConfig())
    const { currentTheme, setTheme } = useStore()
    const allThemes = Object.keys(themes)

    const handleThemeChange = (themeId: string) => {
        setTheme(themeId as any)
        window.electronAPI.setSetting('currentTheme', themeId)
    }

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Theme Section */}
            <section>
                <h4 className="flex items-center gap-2 text-sm font-medium text-text-secondary mb-4 uppercase tracking-wider text-xs">
                    <Layout className="w-4 h-4" />
                    {language === 'zh' ? '外观' : 'Appearance'}
                </h4>
                <div className="grid grid-cols-3 gap-3">
                    {allThemes.map(themeId => {
                        const themeVars = themes[themeId as keyof typeof themes]
                        return (
                            <button
                                key={themeId}
                                onClick={() => handleThemeChange(themeId)}
                                className={`relative p-3 rounded-xl border text-left transition-all duration-200 group overflow-hidden ${currentTheme === themeId
                                    ? 'border-accent bg-accent/10 shadow-md'
                                    : 'border-border-subtle bg-surface/30 hover:border-border hover:bg-surface/50'
                                    }`}
                            >
                                <div className="flex gap-1.5 mb-3">
                                    <div className="w-5 h-5 rounded-full shadow-sm ring-1 ring-border-subtle" style={{ backgroundColor: `rgb(${themeVars['--background']})` }} />
                                    <div className="w-5 h-5 rounded-full shadow-sm ring-1 ring-border-subtle" style={{ backgroundColor: `rgb(${themeVars['--accent']})` }} />
                                    <div className="w-5 h-5 rounded-full shadow-sm ring-1 ring-border-subtle" style={{ backgroundColor: `rgb(${themeVars['--text-primary']})` }} />
                                </div>
                                <span className="text-xs font-medium capitalize block truncate">{themeId.replace('-', ' ')}</span>
                                {currentTheme === themeId && (
                                    <div className="absolute top-2 right-2">
                                        <Check className="w-3.5 h-3.5 text-accent" />
                                    </div>
                                )}
                            </button>
                        )
                    })}
                </div>
            </section>

            {/* Typography & Layout */}
            <section className="space-y-4">
                <h4 className="flex items-center gap-2 text-sm font-medium text-text-secondary mb-4 uppercase tracking-wider text-xs">
                    <Type className="w-4 h-4" />
                    {language === 'zh' ? '排版与布局' : 'Typography & Layout'}
                </h4>
                <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-text-primary">{language === 'zh' ? '字体大小' : 'Font Size'}</label>
                        <Input type="number" value={settings.fontSize} onChange={(e) => setSettings({ ...settings, fontSize: parseInt(e.target.value) || 14 })} min={10} max={32} />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-text-primary">{language === 'zh' ? 'Tab 大小' : 'Tab Size'}</label>
                        <Select value={settings.tabSize.toString()} onChange={(value) => setSettings({ ...settings, tabSize: parseInt(value) })} options={[{ value: '2', label: '2 Spaces' }, { value: '4', label: '4 Spaces' }, { value: '8', label: '8 Spaces' }]} className="w-full" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-text-primary">{language === 'zh' ? '自动换行' : 'Word Wrap'}</label>
                        <Select value={settings.wordWrap} onChange={(value) => setSettings({ ...settings, wordWrap: value as any })} options={[{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }, { value: 'wordWrapColumn', label: 'Column' }]} className="w-full" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-text-primary">{language === 'zh' ? '行号' : 'Line Numbers'}</label>
                        <Select value={settings.lineNumbers} onChange={(value) => setSettings({ ...settings, lineNumbers: value as any })} options={[{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }, { value: 'relative', label: 'Relative' }]} className="w-full" />
                    </div>
                </div>
            </section>

            {/* Features Switches */}
            <section className="space-y-4 p-5 bg-surface/30 rounded-xl border border-border-subtle">
                <h4 className="text-sm font-medium text-text-secondary uppercase tracking-wider text-xs mb-2">
                    {language === 'zh' ? '功能特性' : 'Features'}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                    <Switch label={language === 'zh' ? '显示小地图' : 'Show Minimap'} checked={settings.minimap} onChange={(e) => setSettings({ ...settings, minimap: e.target.checked })} />
                    <Switch label={language === 'zh' ? '括号配对着色' : 'Bracket Pair Colorization'} checked={settings.bracketPairColorization} onChange={(e) => setSettings({ ...settings, bracketPairColorization: e.target.checked })} />
                    <Switch label={language === 'zh' ? '保存时格式化' : 'Format on Save'} checked={settings.formatOnSave} onChange={(e) => setSettings({ ...settings, formatOnSave: e.target.checked })} />
                </div>
                <div className="pt-4 border-t border-border-subtle">
                    <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-text-primary">{language === 'zh' ? '自动保存' : 'Auto Save'}</label>
                        <Select value={settings.autoSave} onChange={(value) => setSettings({ ...settings, autoSave: value as any })} options={[{ value: 'off', label: 'Off' }, { value: 'afterDelay', label: 'After Delay' }, { value: 'onFocusChange', label: 'On Focus Change' }]} className="w-48" />
                    </div>
                </div>
            </section>

            {/* AI Completion */}
            <section className="space-y-4 p-5 bg-gradient-to-br from-accent/5 to-transparent rounded-xl border border-accent/10">
                <div className="flex items-center justify-between">
                    <h4 className="flex items-center gap-2 text-sm font-medium text-accent uppercase tracking-wider text-xs">
                        <Sparkles className="w-4 h-4" />
                        {language === 'zh' ? 'AI 代码补全' : 'AI Code Completion'}
                    </h4>
                    <Switch checked={settings.completionEnabled} onChange={(e) => setSettings({ ...settings, completionEnabled: e.target.checked })} />
                </div>

                {settings.completionEnabled && (
                    <div className="grid grid-cols-2 gap-6 pt-2 animate-fade-in">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-text-primary">{language === 'zh' ? '触发延迟 (ms)' : 'Trigger Delay (ms)'}</label>
                            <Input type="number" value={settings.completionDebounceMs} onChange={(e) => setSettings({ ...settings, completionDebounceMs: parseInt(e.target.value) || 150 })} min={50} max={1000} step={50} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-text-primary">{language === 'zh' ? '最大 Token 数' : 'Max Tokens'}</label>
                            <Input type="number" value={settings.completionMaxTokens} onChange={(e) => setSettings({ ...settings, completionMaxTokens: parseInt(e.target.value) || 256 })} min={64} max={1024} step={64} />
                        </div>
                    </div>
                )}
            </section>

            {/* Terminal Settings */}
            <section className="space-y-4">
                <h4 className="flex items-center gap-2 text-sm font-medium text-text-secondary mb-4 uppercase tracking-wider text-xs">
                    <Terminal className="w-4 h-4" />
                    {language === 'zh' ? '终端' : 'Terminal'}
                </h4>
                <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-text-primary">{language === 'zh' ? '终端字体大小' : 'Terminal Font Size'}</label>
                        <Input type="number" value={advancedConfig.terminal.fontSize} onChange={(e) => { const newConfig = { ...advancedConfig, terminal: { ...advancedConfig.terminal, fontSize: parseInt(e.target.value) || 13 } }; setAdvancedConfig(newConfig); saveEditorConfig(newConfig) }} min={10} max={24} />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-text-primary">{language === 'zh' ? '终端行高' : 'Terminal Line Height'}</label>
                        <Input type="number" value={advancedConfig.terminal.lineHeight} onChange={(e) => { const newConfig = { ...advancedConfig, terminal: { ...advancedConfig.terminal, lineHeight: parseFloat(e.target.value) || 1.2 } }; setAdvancedConfig(newConfig); saveEditorConfig(newConfig) }} min={1} max={2} step={0.1} />
                    </div>
                </div>
                <div className="pt-2">
                    <Switch label={language === 'zh' ? '光标闪烁' : 'Cursor Blink'} checked={advancedConfig.terminal.cursorBlink} onChange={(e) => { const newConfig = { ...advancedConfig, terminal: { ...advancedConfig.terminal, cursorBlink: e.target.checked } }; setAdvancedConfig(newConfig); saveEditorConfig(newConfig) }} />
                </div>
            </section>
        </div>
    )
}
