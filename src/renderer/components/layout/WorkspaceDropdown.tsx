/**
 * WorkspaceDropdown - IDEA风格工作区下拉菜单
 * 显示当前工作区并提供快速切换功能
 */
import { api } from '@/renderer/services/electronAPI'
import { logger } from '@utils/Logger'
import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Plus, FolderOpen, History, Folder } from 'lucide-react'
import { useStore } from '@store'
import { workspaceManager } from '@services/WorkspaceManager'
import { toast } from '@components/common/ToastProvider'
import { getFileName } from '@shared/utils/pathUtils'

interface RecentWorkspace {
    path: string
    name: string
}

export default function WorkspaceDropdown() {
    const { workspace } = useStore()
    const [isOpen, setIsOpen] = useState(false)
    const [recentWorkspaces, setRecentWorkspaces] = useState<RecentWorkspace[]>([])
    const containerRef = useRef<HTMLDivElement>(null)

    // 获取当前工作区显示名称
    const currentWorkspaceName = workspace?.roots[0]
        ? getFileName(workspace.roots[0]) || 'Workspace'
        : 'No Workspace'

    // 加载最近工作区列表
    const loadRecent = async () => {
        try {
            const recent = await api.workspace.getRecent()
            setRecentWorkspaces(
                recent.map((path: string) => ({
                    path,
                    name: getFileName(path),
                }))
            )
        } catch (e) {
            logger.ui.error('[WorkspaceDropdown] Failed to load recent workspaces:', e)
        }
    }

    useEffect(() => {
        if (isOpen) {
            loadRecent()
        }
    }, [isOpen])

    // 点击外部关闭
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // 打开文件夹
    const handleOpenFolder = async () => {
        setIsOpen(false)
        const result = await api.file.openFolder()
        if (result && typeof result === 'string') {
            await workspaceManager.openFolder(result)
        }
        // 如果返回 { redirected: true }，说明已聚焦到其他窗口，无需处理
    }

    // 打开工作区
    const handleOpenWorkspace = async () => {
        setIsOpen(false)
        const result = await api.workspace.open()
        if (result && !('redirected' in result)) {
            await workspaceManager.switchTo(result)
        }
    }

    // 新建窗口
    const handleNewWindow = () => {
        setIsOpen(false)
        api.window.new()
    }

    // 添加文件夹到工作区
    const handleAddFolder = async () => {
        setIsOpen(false)
        const path = await api.workspace.addFolder()
        if (path) {
            await workspaceManager.addFolder(path)
        }
    }

    const handleOpenRecent = async (path: string) => {
        setIsOpen(false)
        try {
            await workspaceManager.openFolder(path)
        } catch (e) {
            toast.error('文件夹不存在，已从列表移除', getFileName(path))
            loadRecent() // 刷新列表
        }
    }

    return (
        <div ref={containerRef} className="relative">
            {/* 触发按钮 */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-surface-hover transition-colors text-xs group"
            >
                <Folder className="w-3.5 h-3.5 text-accent" />
                <span className="text-text-primary font-medium max-w-32 truncate">
                    {currentWorkspaceName}
                </span>
                <ChevronDown
                    className={`w-3 h-3 text-text-muted transition-transform duration-200 ${isOpen ? 'rotate-180' : ''
                        }`}
                />
            </button>

            {/* 下拉菜单 */}
            {isOpen && (
                <div className="absolute top-full left-0 mt-1 w-64 py-1 bg-surface border border-border-subtle rounded-md shadow-xl z-50 animate-fade-in">
                    {/* 操作按钮 */}
                    <button
                        onClick={handleNewWindow}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        <span>新建窗口</span>
                    </button>

                    <button
                        onClick={handleOpenFolder}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
                    >
                        <FolderOpen className="w-4 h-4" />
                        <span>打开文件夹</span>
                    </button>

                    <button
                        onClick={handleOpenWorkspace}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
                    >
                        <Folder className="w-4 h-4" />
                        <span>打开工作区</span>
                    </button>

                    <button
                        onClick={handleAddFolder}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        <span>添加文件夹到工作区</span>
                    </button>

                    {/* 分隔线 */}
                    {recentWorkspaces.length > 0 && (
                        <>
                            <div className="h-px bg-border-subtle my-1" />

                            {/* 最近打开标题 */}
                            <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-text-muted">
                                <History className="w-3 h-3" />
                                <span>最近打开</span>
                            </div>

                            {/* 最近工作区列表 */}
                            {recentWorkspaces
                                .filter((w) => w.path !== workspace?.roots[0]) // 排除当前工作区
                                .slice(0, 5) // 最多显示5个
                                .map((recent) => (
                                    <button
                                        key={recent.path}
                                        onClick={() => handleOpenRecent(recent.path)}
                                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors group"
                                        title={recent.path}
                                    >
                                        <Folder className="w-4 h-4 text-text-muted group-hover:text-accent" />
                                        <span className="truncate">{recent.name}</span>
                                    </button>
                                ))}
                        </>
                    )}
                </div>
            )}
        </div>
    )
}
