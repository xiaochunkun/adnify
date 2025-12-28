/**
 * 文件树项组件
 */

import { useState, useEffect, useRef } from 'react'
import {
  Folder,
  FolderOpen,
  File,
  ChevronRight,
  Trash2,
  Copy,
  Clipboard,
  Edit2,
  FilePlus,
  FolderPlus,
  ExternalLink,
  FileJson,
  FileCode,
  FileImage,
  FileType,
  FileText,
  FileTerminal,
  FileCog,
} from 'lucide-react'
import { useStore } from '@store'
import { FileItem } from '@app-types/electron'
import { t } from '@renderer/i18n'
import { getDirPath, joinPath } from '@utils/pathUtils'
import { toast } from '../../common/ToastProvider'
import { directoryCacheService } from '@services/directoryCacheService'
import { Input, ContextMenu, ContextMenuItem } from '../../ui'
import { InlineCreateInput } from './InlineCreateInput'

// 获取文件图标的辅助函数
const getFileIcon = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase()
  
  switch (ext) {
    case 'json':
      return <FileJson className="w-3.5 h-3.5 text-yellow-400" />
    case 'ts':
    case 'tsx':
      return <FileCode className="w-3.5 h-3.5 text-blue-400" />
    case 'js':
    case 'jsx':
      return <FileCode className="w-3.5 h-3.5 text-yellow-300" />
    case 'css':
    case 'scss':
    case 'less':
      return <FileType className="w-3.5 h-3.5 text-sky-300" />
    case 'html':
      return <FileCode className="w-3.5 h-3.5 text-orange-400" />
    case 'md':
    case 'txt':
      return <FileText className="w-3.5 h-3.5 text-gray-300" />
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
    case 'ico':
      return <FileImage className="w-3.5 h-3.5 text-purple-400" />
    case 'sh':
    case 'bat':
    case 'ps1':
      return <FileTerminal className="w-3.5 h-3.5 text-green-400" />
    case 'yml':
    case 'yaml':
    case 'toml':
    case 'xml':
      return <FileCog className="w-3.5 h-3.5 text-red-300" />
    default:
      return <File className="w-3.5 h-3.5 text-text-muted" />
  }
}

interface FileTreeItemProps {
  item: FileItem
  depth?: number
  onRefresh: () => void
  creatingIn: { path: string; type: 'file' | 'folder' } | null
  onStartCreate: (path: string, type: 'file' | 'folder') => void
  onCancelCreate: () => void
  onCreateSubmit: (parentPath: string, name: string, type: 'file' | 'folder') => void
}

export function FileTreeItem({
  item,
  depth = 0,
  onRefresh,
  creatingIn,
  onStartCreate,
  onCancelCreate,
  onCreateSubmit,
}: FileTreeItemProps) {
  const {
    expandedFolders,
    toggleFolder,
    expandFolder,
    openFile,
    setActiveFile,
    activeFilePath,
    language,
    fileTreeRefreshKey,
  } = useStore()
  const [children, setChildren] = useState<FileItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(item.name)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)

  const isExpanded = expandedFolders.has(item.path)
  const isActive = activeFilePath === item.path
  const isCreatingHere = creatingIn?.path === item.path

  // 当展开或刷新触发时加载子目录
  useEffect(() => {
    if (item.isDirectory && isExpanded) {
      const loadChildren = async () => {
        setIsLoading(true)
        try {
          const items = await directoryCacheService.getDirectory(item.path, true)
          setChildren(items)

          // 预加载下一层子目录
          const subDirs = items.filter((i) => i.isDirectory).slice(0, 5)
          if (subDirs.length > 0) {
            directoryCacheService.preload(subDirs.map((d) => d.path))
          }
        } finally {
          setIsLoading(false)
        }
      }
      loadChildren()
    }
  }, [item.path, item.isDirectory, isExpanded, fileTreeRefreshKey])

  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [isRenaming])

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isRenaming) return

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

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  const handleDelete = async () => {
    if (confirm(t('confirmDelete', language, { name: item.name }))) {
      await window.electronAPI.deleteFile(item.path)
      onRefresh()
    }
  }

  const handleRenameStart = () => {
    setRenameValue(item.name)
    setIsRenaming(true)
  }

  const handleRenameSubmit = async () => {
    if (!renameValue.trim() || renameValue === item.name) {
      setIsRenaming(false)
      return
    }
    const newPath = joinPath(getDirPath(item.path), renameValue)
    const success = await window.electronAPI.renameFile(item.path, newPath)
    if (success) {
      onRefresh()
    }
    setIsRenaming(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleRenameSubmit()
    if (e.key === 'Escape') setIsRenaming(false)
  }

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', item.path)
    e.dataTransfer.setData('application/adnify-file-path', item.path)
    e.dataTransfer.effectAllowed = 'copy'
  }

  const handleCopyPath = () => {
    navigator.clipboard.writeText(item.path)
    toast.success('Path copied')
  }

  const handleCopyRelativePath = () => {
    const { workspacePath } = useStore.getState()
    if (workspacePath) {
      const relativePath = item.path.replace(workspacePath, '').replace(/^[\\/]/, '')
      navigator.clipboard.writeText(relativePath)
      toast.success('Path copied')
    }
  }

  const handleRevealInExplorer = () => {
    window.electronAPI.showItemInFolder(item.path)
  }

  const handleNewFile = () => {
    if (item.isDirectory) {
      expandFolder(item.path)
      onStartCreate(item.path, 'file')
    }
  }

  const handleNewFolder = () => {
    if (item.isDirectory) {
      expandFolder(item.path)
      onStartCreate(item.path, 'folder')
    }
  }

  // 构建右键菜单项
  const contextMenuItems: ContextMenuItem[] = item.isDirectory
    ? [
        { id: 'newFile', label: t('newFile', language), icon: FilePlus, onClick: handleNewFile },
        { id: 'newFolder', label: t('newFolder', language), icon: FolderPlus, onClick: handleNewFolder },
        { id: 'sep1', label: '', separator: true },
        { id: 'rename', label: t('rename', language), icon: Edit2, onClick: handleRenameStart },
        { id: 'delete', label: t('delete', language), icon: Trash2, danger: true, onClick: handleDelete },
        { id: 'sep2', label: '', separator: true },
        { id: 'copyPath', label: 'Copy Path', icon: Copy, onClick: handleCopyPath },
        { id: 'copyRelPath', label: 'Copy Relative Path', icon: Clipboard, onClick: handleCopyRelativePath },
        { id: 'reveal', label: 'Reveal in Explorer', icon: ExternalLink, onClick: handleRevealInExplorer },
      ]
    : [
        { id: 'rename', label: t('rename', language), icon: Edit2, onClick: handleRenameStart },
        { id: 'delete', label: t('delete', language), icon: Trash2, danger: true, onClick: handleDelete },
        { id: 'sep1', label: '', separator: true },
        { id: 'copyPath', label: 'Copy Path', icon: Copy, onClick: handleCopyPath },
        { id: 'copyRelPath', label: 'Copy Relative Path', icon: Clipboard, onClick: handleCopyRelativePath },
        { id: 'reveal', label: 'Reveal in Explorer', icon: ExternalLink, onClick: handleRevealInExplorer },
      ]

  return (
    <div>
      <div
        draggable={!isRenaming}
        onDragStart={handleDragStart}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        className={`
          group flex items-center gap-1.5 py-1 pr-2 cursor-pointer transition-all duration-200 relative select-none rounded-r-md mr-2
          ${isActive ? 'bg-accent/10 text-text-primary' : 'text-text-muted hover:text-text-primary hover:bg-white/5'}
        `}
        style={{ paddingLeft: `${depth * 14 + 12}px` }}
      >
        {isActive && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-accent" />}

        {depth > 0 && (
          <div
            className="absolute left-0 top-0 bottom-0 border-l border-border-subtle group-hover:border-white/10"
            style={{ left: `${depth * 14}px` }}
          />
        )}

        {item.isDirectory ? (
          <>
            <span className={`transition-transform duration-200 flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`}>
              <ChevronRight className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
            </span>
            {isLoading ? (
              <div className="w-3.5 h-3.5 border-2 border-text-muted border-t-transparent rounded-full animate-spin flex-shrink-0" />
            ) : (
              <>
                {isExpanded ? (
                  <FolderOpen className="w-3.5 h-3.5 flex-shrink-0 text-accent" />
                ) : (
                  <Folder className="w-3.5 h-3.5 flex-shrink-0 text-text-muted group-hover:text-text-primary" />
                )}
              </>
            )}
          </>
        ) : (
          <>
            <span className="w-3.5 flex-shrink-0" />
            {getFileIcon(item.name)}
          </>
        )}

        {isRenaming ? (
          <Input
            ref={renameInputRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 h-5 text-[13px] px-1 py-0"
            autoFocus
          />
        ) : (
          <span className="text-[13px] truncate leading-normal flex-1 opacity-90 group-hover:opacity-100 font-medium">
            {item.name}
          </span>
        )}
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={() => setContextMenu(null)}
        />
      )}

      {item.isDirectory && isExpanded && (
        <div className="relative">
          <div
            className="absolute left-0 top-0 bottom-0 border-l border-border-subtle/30"
            style={{ left: `${(depth + 1) * 14}px` }}
          />

          {isCreatingHere && (
            <InlineCreateInput
              type={creatingIn!.type}
              depth={depth + 1}
              onSubmit={(name) => onCreateSubmit(item.path, name, creatingIn!.type)}
              onCancel={onCancelCreate}
            />
          )}

          {children
            .sort((a, b) => {
              if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name)
              return a.isDirectory ? -1 : 1
            })
            .map((child) => (
              <FileTreeItem
                key={child.path}
                item={child}
                depth={depth + 1}
                onRefresh={onRefresh}
                creatingIn={creatingIn}
                onStartCreate={onStartCreate}
                onCancelCreate={onCancelCreate}
                onCreateSubmit={onCreateSubmit}
              />
            ))}
        </div>
      )}
    </div>
  )
}
