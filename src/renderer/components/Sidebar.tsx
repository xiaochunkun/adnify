import { useState, useEffect, useCallback } from 'react'
import {
  FolderOpen, File, ChevronRight, ChevronDown,
  Plus, RefreshCw, FolderPlus, GitBranch, Circle
} from 'lucide-react'
import { useStore } from '../store'
import { FileItem } from '../types/electron'
import { t } from '../i18n'
import { gitService, GitStatus } from '../agent/gitService'

const getFileIcon = (name: string) => {
  const ext = name.split('.').pop()?.toLowerCase()
  const iconColors: Record<string, string> = {
    ts: 'text-blue-400',
    tsx: 'text-blue-400',
    js: 'text-yellow-400',
    jsx: 'text-yellow-400',
    py: 'text-green-400',
    json: 'text-yellow-300',
    md: 'text-gray-400',
    css: 'text-pink-400',
    html: 'text-orange-400',
  }
  return iconColors[ext || ''] || 'text-editor-text-muted'
}

function FileTreeItem({ item, depth = 0 }: { item: FileItem; depth?: number }) {
  const { expandedFolders, toggleFolder, openFile, setActiveFile } = useStore()
  const [children, setChildren] = useState<FileItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const isExpanded = expandedFolders.has(item.path)

  useEffect(() => {
    if (item.isDirectory && isExpanded) {
      setIsLoading(true)
      window.electronAPI.readDir(item.path).then((items) => {
        setChildren(items)
        setIsLoading(false)
      })
    }
  }, [item.path, item.isDirectory, isExpanded])

  const handleClick = async () => {
    if (item.isDirectory) {
      toggleFolder(item.path)
    } else {
      const content = await window.electronAPI.readFile(item.path)
      if (content !== null) {
        openFile(item.path, content)
        setActiveFile(item.path)
      }
    }
  }

  return (
    <div>
      <div
        onClick={handleClick}
        className="flex items-center gap-1 py-1 px-2 hover:bg-editor-hover cursor-pointer rounded transition-colors group"
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {item.isDirectory ? (
          <>
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-editor-text-muted border-t-transparent rounded-full animate-spin" />
            ) : isExpanded ? (
              <ChevronDown className="w-4 h-4 text-editor-text-muted" />
            ) : (
              <ChevronRight className="w-4 h-4 text-editor-text-muted" />
            )}
            <FolderOpen className={`w-4 h-4 ${isExpanded ? 'text-editor-accent' : 'text-editor-text-muted'}`} />
          </>
        ) : (
          <>
            <span className="w-4" />
            <File className={`w-4 h-4 ${getFileIcon(item.name)}`} />
          </>
        )}
        <span className="text-sm text-editor-text truncate">{item.name}</span>
      </div>
      {item.isDirectory && isExpanded && (
        <div>
          {children
            .sort((a, b) => {
              if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name)
              return a.isDirectory ? -1 : 1
            })
            .map((child) => (
              <FileTreeItem key={child.path} item={child} depth={depth + 1} />
            ))}
        </div>
      )}
    </div>
  )
}

export default function Sidebar() {
  const { workspacePath, files, setWorkspacePath, setFiles, language } = useStore()
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null)
  const [isGitRepo, setIsGitRepo] = useState(false)

  // 更新 Git 状态
  const updateGitStatus = useCallback(async () => {
    if (!workspacePath) {
      setGitStatus(null)
      setIsGitRepo(false)
      return
    }

    gitService.setWorkspace(workspacePath)
    const isRepo = await gitService.isGitRepo()
    setIsGitRepo(isRepo)

    if (isRepo) {
      const status = await gitService.getStatus()
      setGitStatus(status)
    }
  }, [workspacePath])

  // 工作区变化时更新 Git 状态
  useEffect(() => {
    updateGitStatus()
    // 定期刷新 Git 状态
    const interval = setInterval(updateGitStatus, 5000)
    return () => clearInterval(interval)
  }, [updateGitStatus])

  const handleOpenFolder = async () => {
    const path = await window.electronAPI.openFolder()
    if (path) {
      setWorkspacePath(path)
      const items = await window.electronAPI.readDir(path)
      setFiles(items)
    }
  }

  const refreshFiles = async () => {
    if (workspacePath) {
      const items = await window.electronAPI.readDir(workspacePath)
      setFiles(items)
      updateGitStatus()
    }
  }

  // 获取文件的 Git 状态颜色
  const getGitStatusColor = (filePath: string): string | null => {
    if (!gitStatus) return null

    const relativePath = filePath.replace(workspacePath + '/', '').replace(workspacePath + '\\', '')

    if (gitStatus.untracked.includes(relativePath)) return 'text-green-400'
    if (gitStatus.staged.some(f => f.path === relativePath)) return 'text-green-400'
    if (gitStatus.unstaged.some(f => f.path === relativePath)) return 'text-yellow-400'

    return null
  }

  return (
    <div className="w-64 bg-editor-sidebar border-r border-editor-border flex flex-col">
      {/* Header */}
      <div className="h-10 flex items-center justify-between px-3 border-b border-editor-border">
        <span className="text-xs font-medium text-editor-text-muted uppercase tracking-wider">
          {t('explorer', language)}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleOpenFolder}
            className="p-1.5 rounded hover:bg-editor-hover transition-colors"
            title={t('openFolder', language)}
          >
            <FolderPlus className="w-4 h-4 text-editor-text-muted" />
          </button>
          <button
            onClick={refreshFiles}
            className="p-1.5 rounded hover:bg-editor-hover transition-colors"
            title={t('refresh', language)}
          >
            <RefreshCw className="w-4 h-4 text-editor-text-muted" />
          </button>
        </div>
      </div>

      {/* File Tree */}
      <div className="flex-1 overflow-auto py-2">
        {workspacePath ? (
          files
            .sort((a, b) => {
              if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name)
              return a.isDirectory ? -1 : 1
            })
            .map((item) => (
              <FileTreeItem key={item.path} item={item} />
            ))
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <FolderOpen className="w-12 h-12 text-editor-text-muted mb-4 opacity-50" />
            <p className="text-sm text-editor-text-muted mb-4">
              {t('noFolderOpened', language)}
            </p>
            <button
              onClick={handleOpenFolder}
              className="flex items-center gap-2 px-4 py-2 bg-editor-active text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              {t('openFolder', language)}
            </button>
          </div>
        )}
      </div>

      {/* Git Status Bar */}
      {isGitRepo && gitStatus && (
        <div className="border-t border-editor-border px-3 py-2">
          <div className="flex items-center gap-2 text-xs">
            <GitBranch className="w-3.5 h-3.5 text-editor-accent" />
            <span className="text-editor-text font-medium">{gitStatus.branch}</span>
            {(gitStatus.ahead > 0 || gitStatus.behind > 0) && (
              <span className="text-editor-text-muted">
                {gitStatus.ahead > 0 && `↑${gitStatus.ahead}`}
                {gitStatus.behind > 0 && `↓${gitStatus.behind}`}
              </span>
            )}
          </div>
          {(gitStatus.staged.length > 0 || gitStatus.unstaged.length > 0 || gitStatus.untracked.length > 0) && (
            <div className="flex items-center gap-3 mt-1.5 text-xs">
              {gitStatus.staged.length > 0 && (
                <span className="flex items-center gap-1 text-green-400">
                  <Circle className="w-2 h-2 fill-current" />
                  {gitStatus.staged.length} staged
                </span>
              )}
              {gitStatus.unstaged.length > 0 && (
                <span className="flex items-center gap-1 text-yellow-400">
                  <Circle className="w-2 h-2 fill-current" />
                  {gitStatus.unstaged.length} modified
                </span>
              )}
              {gitStatus.untracked.length > 0 && (
                <span className="flex items-center gap-1 text-editor-text-muted">
                  <Circle className="w-2 h-2 fill-current" />
                  {gitStatus.untracked.length} untracked
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
