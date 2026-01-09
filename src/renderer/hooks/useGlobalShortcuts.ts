/**
 * 全局快捷键 Hook
 */
import { useEffect, useCallback } from 'react'
import { useStore } from '@store'
import { api } from '@renderer/services/electronAPI'
import { keybindingService } from '@services/keybindingService'

interface ShortcutHandlers {
  onShowKeyboardShortcuts?: () => void
}

export function useGlobalShortcuts(handlers: ShortcutHandlers = {}) {
  const {
    setShowSettings,
    setShowCommandPalette,
    setShowComposer,
    setShowQuickOpen,
    setShowAbout,
    terminalVisible,
    setTerminalVisible,
    debugVisible,
    setDebugVisible,
    showCommandPalette,
    showComposer,
    showQuickOpen,
    showAbout,
  } = useStore()

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Command Palette: Ctrl+Shift+P or F1
    if (
      keybindingService.matches(e, 'workbench.action.showCommands') ||
      (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'p') ||
      e.key === 'F1'
    ) {
      e.preventDefault()
      setShowCommandPalette(true)
      return
    }

    // DevTools: F12
    if (e.key === 'F12') {
      api.window.toggleDevTools()
      return
    }

    // Quick Open: Ctrl+P
    if (keybindingService.matches(e, 'workbench.action.quickOpen')) {
      e.preventDefault()
      setShowQuickOpen(true)
      return
    }

    // Settings: Ctrl+,
    if (keybindingService.matches(e, 'workbench.action.openSettings')) {
      e.preventDefault()
      setShowSettings(true)
      return
    }

    // Terminal: Ctrl+`
    if (keybindingService.matches(e, 'view.toggleTerminal')) {
      e.preventDefault()
      setTerminalVisible(!terminalVisible)
      return
    }

    // Debug: Ctrl+Shift+D
    if (keybindingService.matches(e, 'view.toggleDebug')) {
      e.preventDefault()
      setDebugVisible(!debugVisible)
      return
    }

    // Debug shortcuts
    if (keybindingService.matches(e, 'debug.start') || e.key === 'F5') {
      e.preventDefault()
      if (!debugVisible) setDebugVisible(true)
      window.dispatchEvent(new CustomEvent('debug:start'))
      return
    }

    if (keybindingService.matches(e, 'debug.toggleBreakpoint') || e.key === 'F9') {
      e.preventDefault()
      window.dispatchEvent(new CustomEvent('debug:toggleBreakpoint'))
      return
    }

    // Keyboard shortcuts: Ctrl+K Ctrl+S
    if (keybindingService.matches(e, 'workbench.action.showShortcuts')) {
      const target = e.target as HTMLElement
      if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
        e.preventDefault()
        handlers.onShowKeyboardShortcuts?.()
      }
      return
    }

    // Composer: Ctrl+I
    if (keybindingService.matches(e, 'workbench.action.toggleComposer')) {
      e.preventDefault()
      setShowComposer(true)
      return
    }

    // Close panel: Escape
    if (keybindingService.matches(e, 'workbench.action.closePanel')) {
      if (showCommandPalette) setShowCommandPalette(false)
      if (showComposer) setShowComposer(false)
      if (showQuickOpen) setShowQuickOpen(false)
      if (showAbout) setShowAbout(false)
      return
    }

    // About: Ctrl+Shift+A
    if (keybindingService.matches(e, 'help.about')) {
      e.preventDefault()
      setShowAbout(true)
      return
    }

    // Reveal active file in explorer
    if (keybindingService.matches(e, 'explorer.revealActiveFile')) {
      e.preventDefault()
      window.dispatchEvent(new CustomEvent('explorer:reveal-active-file'))
      return
    }
  }, [
    setShowSettings, setShowCommandPalette, setShowComposer, setShowQuickOpen, setShowAbout,
    terminalVisible, setTerminalVisible, debugVisible, setDebugVisible,
    showCommandPalette, showComposer, showQuickOpen, showAbout, handlers
  ])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // 监听主进程菜单命令
  useEffect(() => {
    const removeListener = api.onExecuteCommand((commandId: string) => {
      if (commandId === 'workbench.action.showCommands') {
        setShowCommandPalette(true)
      }
      if (commandId === 'workbench.action.toggleDevTools') {
        api.window.toggleDevTools()
      }
      if (commandId === 'explorer.revealActiveFile') {
        window.dispatchEvent(new CustomEvent('explorer:reveal-active-file'))
      }
    })
    return removeListener
  }, [setShowCommandPalette])
}
