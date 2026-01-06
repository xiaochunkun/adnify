/**
 * 欢迎页面 - 无工作区时显示
 * 类似 VS Code 的启动页面
 */
import { useState, useEffect } from 'react'
import { FolderOpen, History, Folder, Plus, Settings, Keyboard } from 'lucide-react'
import { api } from '@/renderer/services/electronAPI'
import { workspaceManager } from '@/renderer/services/WorkspaceManager'
import { useStore } from '@/renderer/store'
import { logger } from '@utils/Logger'
import { toast } from '@components/common/ToastProvider'

interface RecentWorkspace {
  path: string
  name: string
}

export default function WelcomePage() {
  const [recentWorkspaces, setRecentWorkspaces] = useState<RecentWorkspace[]>([])
  const { setShowSettings } = useStore()

  useEffect(() => {
    loadRecentWorkspaces()
  }, [])

  const loadRecentWorkspaces = async () => {
    try {
      const recent = await api.workspace.getRecent()
      setRecentWorkspaces(
        recent.slice(0, 8).map((path: string) => ({
          path,
          name: path.split(/[\\/]/).pop() || path,
        }))
      )
    } catch (e) {
      logger.ui.error('[WelcomePage] Failed to load recent workspaces:', e)
    }
  }

  const handleOpenFolder = async () => {
    const result = await api.file.openFolder()
    if (result && typeof result === 'string') {
      await workspaceManager.openFolder(result)
    }
  }

  const handleOpenWorkspace = async () => {
    const result = await api.workspace.open()
    if (result && !('redirected' in result)) {
      await workspaceManager.switchTo(result)
    }
  }

  const handleOpenRecent = async (path: string) => {
    try {
      await workspaceManager.openFolder(path)
    } catch (e) {
      toast.error('文件夹不存在，已从列表移除', path.split(/[\\/]/).pop() || path)
      loadRecentWorkspaces() // 刷新列表
    }
  }

  const handleNewWindow = () => {
    api.window.new()
  }

  return (
    <div className="h-full flex items-center justify-center bg-background">
      <div className="w-full max-w-2xl px-8">
        {/* Logo & Title */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-semibold text-text-primary mb-2">
            Adnify
          </h1>
          <p className="text-text-secondary text-sm">
            AI-Powered Code Editor
          </p>
        </div>

        <div className="grid grid-cols-2 gap-8">
          {/* 左侧：开始 */}
          <div>
            <h2 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-4">
              开始
            </h2>
            <div className="space-y-1">
              <button
                onClick={handleOpenFolder}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors group"
              >
                <FolderOpen className="w-5 h-5 text-accent" />
                <div>
                  <div className="text-sm font-medium">打开文件夹</div>
                  <div className="text-xs text-text-muted">选择一个文件夹作为工作区</div>
                </div>
              </button>

              <button
                onClick={handleOpenWorkspace}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors group"
              >
                <Folder className="w-5 h-5 text-accent" />
                <div>
                  <div className="text-sm font-medium">打开工作区</div>
                  <div className="text-xs text-text-muted">打开 .adnify-workspace 文件</div>
                </div>
              </button>

              <button
                onClick={handleNewWindow}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors group"
              >
                <Plus className="w-5 h-5 text-text-muted group-hover:text-accent" />
                <div>
                  <div className="text-sm font-medium">新建窗口</div>
                  <div className="text-xs text-text-muted">打开一个新的编辑器窗口</div>
                </div>
              </button>
            </div>

            {/* 快捷操作 */}
            <h2 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-4 mt-8">
              快捷操作
            </h2>
            <div className="space-y-1">
              <button
                onClick={() => setShowSettings(true)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-left text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
              >
                <Settings className="w-4 h-4" />
                <span className="text-sm">设置</span>
                <span className="ml-auto text-xs text-text-muted">Ctrl+,</span>
              </button>
              <button
                onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: '?', ctrlKey: true }))}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-left text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
              >
                <Keyboard className="w-4 h-4" />
                <span className="text-sm">快捷键</span>
                <span className="ml-auto text-xs text-text-muted">Ctrl+?</span>
              </button>
            </div>
          </div>

          {/* 右侧：最近 */}
          <div>
            <h2 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-4 flex items-center gap-2">
              <History className="w-3.5 h-3.5" />
              最近打开
            </h2>
            
            {recentWorkspaces.length > 0 ? (
              <div className="space-y-0.5">
                {recentWorkspaces.map((workspace) => (
                  <button
                    key={workspace.path}
                    onClick={() => handleOpenRecent(workspace.path)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-left text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors group"
                    title={workspace.path}
                  >
                    <Folder className="w-4 h-4 text-text-muted group-hover:text-accent flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{workspace.name}</div>
                      <div className="text-xs text-text-muted truncate">{workspace.path}</div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-sm text-text-muted px-3 py-4">
                暂无最近打开的工作区
              </div>
            )}
          </div>
        </div>

        {/* 底部提示 */}
        <div className="mt-12 text-center">
          <p className="text-xs text-text-muted">
            按 <kbd className="px-1.5 py-0.5 bg-surface rounded text-text-secondary">Ctrl+Shift+P</kbd> 打开命令面板
          </p>
        </div>
      </div>
    </div>
  )
}
