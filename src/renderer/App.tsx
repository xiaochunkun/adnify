import { useEffect, useState, useCallback } from 'react'
import { useStore } from './store'
import TitleBar from './components/TitleBar'
import Sidebar from './components/Sidebar'
import Editor from './components/Editor'
import ChatPanel from './components/ChatPanel'
import SettingsModal from './components/SettingsModal'
import TerminalPanel from './components/TerminalPanel'
import CommandPalette from './components/CommandPalette'
import KeyboardShortcuts from './components/KeyboardShortcuts'
import QuickOpen from './components/QuickOpen'

export default function App() {
  const { showSettings, setLLMConfig, setLanguage, setAutoApprove, setShowSettings, setTerminalVisible, terminalVisible } = useStore()
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false)
  const [showQuickOpen, setShowQuickOpen] = useState(false)

  useEffect(() => {
    // Load saved settings
    const loadSettings = async () => {
      const savedConfig = await window.electronAPI.getSetting('llmConfig')
      if (savedConfig) {
        setLLMConfig(savedConfig)
      }
      const savedLanguage = await window.electronAPI.getSetting('language')
      if (savedLanguage) {
        setLanguage(savedLanguage)
      }
      const savedAutoApprove = await window.electronAPI.getSetting('autoApprove')
      if (savedAutoApprove) {
        setAutoApprove(savedAutoApprove)
      }
    }
    loadSettings()
  }, [setLLMConfig, setLanguage, setAutoApprove])

  // 全局快捷键
  const handleGlobalKeyDown = useCallback((e: KeyboardEvent) => {
    // Ctrl+Shift+P: 命令面板
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
      e.preventDefault()
      setShowCommandPalette(true)
    }
    // Ctrl+P: 快速打开文件
    else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'p') {
      e.preventDefault()
      setShowQuickOpen(true)
    }
    // Ctrl+,: 设置
    else if ((e.ctrlKey || e.metaKey) && e.key === ',') {
      e.preventDefault()
      setShowSettings(true)
    }
    // Ctrl+`: 终端
    else if ((e.ctrlKey || e.metaKey) && e.key === '`') {
      e.preventDefault()
      setTerminalVisible(!terminalVisible)
    }
    // ?: 快捷键帮助
    else if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const target = e.target as HTMLElement
      if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
        e.preventDefault()
        setShowKeyboardShortcuts(true)
      }
    }
    // Escape: 关闭面板
    else if (e.key === 'Escape') {
      if (showCommandPalette) setShowCommandPalette(false)
      if (showKeyboardShortcuts) setShowKeyboardShortcuts(false)
      if (showQuickOpen) setShowQuickOpen(false)
    }
  }, [setShowSettings, setTerminalVisible, terminalVisible, showCommandPalette, showKeyboardShortcuts, showQuickOpen])

  useEffect(() => {
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [handleGlobalKeyDown])

  return (
    <div className="h-screen flex flex-col bg-editor-bg overflow-hidden">
      <TitleBar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex overflow-hidden">
          <Sidebar />
          <Editor />
          <ChatPanel />
        </div>
        <TerminalPanel />
      </div>
      {showSettings && <SettingsModal />}
      {showCommandPalette && (
        <CommandPalette
          onClose={() => setShowCommandPalette(false)}
          onShowKeyboardShortcuts={() => {
            setShowCommandPalette(false)
            setShowKeyboardShortcuts(true)
          }}
        />
      )}
      {showKeyboardShortcuts && (
        <KeyboardShortcuts onClose={() => setShowKeyboardShortcuts(false)} />
      )}
      {showQuickOpen && (
        <QuickOpen onClose={() => setShowQuickOpen(false)} />
      )}
    </div>
  )
}
