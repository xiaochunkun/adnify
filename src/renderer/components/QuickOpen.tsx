/**
 * 快速打开文件
 * 类似 VS Code 的 Ctrl+P
 */

import { useState, useEffect, useCallback, useRef, memo } from 'react'
import { Search, FileText, X } from 'lucide-react'
import { useStore } from '../store'

interface QuickOpenProps {
  onClose: () => void
}

interface FileMatch {
  path: string
  name: string
  score: number
  matches: number[]
}

// 模糊匹配算法
function fuzzyMatch(query: string, text: string): { score: number; matches: number[] } | null {
  const queryLower = query.toLowerCase()
  const textLower = text.toLowerCase()

  let queryIdx = 0
  let score = 0
  const matches: number[] = []
  let consecutiveBonus = 0

  for (let i = 0; i < text.length && queryIdx < query.length; i++) {
    if (textLower[i] === queryLower[queryIdx]) {
      matches.push(i)

      // 连续匹配加分
      if (matches.length > 1 && matches[matches.length - 1] === matches[matches.length - 2] + 1) {
        consecutiveBonus += 5
      }

      // 单词开头加分
      if (i === 0 || text[i - 1] === '/' || text[i - 1] === '\\' || text[i - 1] === '.' || text[i - 1] === '-' || text[i - 1] === '_') {
        score += 10
      }

      // 大写字母加分（驼峰匹配）
      if (text[i] === text[i].toUpperCase() && text[i] !== text[i].toLowerCase()) {
        score += 5
      }

      score += 1
      queryIdx++
    }
  }

  if (queryIdx !== query.length) {
    return null
  }

  score += consecutiveBonus

  // 短文件名加分
  score -= text.length * 0.1

  return { score, matches }
}

// 高亮匹配字符
const HighlightedText = memo(function HighlightedText({
  text,
  matches,
}: {
  text: string
  matches: number[]
}) {
  const parts: JSX.Element[] = []
  let lastIdx = 0

  for (const matchIdx of matches) {
    if (matchIdx > lastIdx) {
      parts.push(
        <span key={`text-${lastIdx}`} className="text-editor-text-muted">
          {text.slice(lastIdx, matchIdx)}
        </span>
      )
    }
    parts.push(
      <span key={`match-${matchIdx}`} className="text-editor-accent font-medium">
        {text[matchIdx]}
      </span>
    )
    lastIdx = matchIdx + 1
  }

  if (lastIdx < text.length) {
    parts.push(
      <span key={`text-${lastIdx}`} className="text-editor-text-muted">
        {text.slice(lastIdx)}
      </span>
    )
  }

  return <>{parts}</>
})

const FileMatchItem = memo(function FileMatchItem({
  file,
  isSelected,
  onSelect,
}: {
  file: FileMatch
  isSelected: boolean
  onSelect: () => void
}) {
  const fileName = file.path.split(/[/\\]/).pop() || file.path
  const dirPath = file.path.slice(0, file.path.length - fileName.length - 1)

  // 计算文件名中的匹配位置
  const fileNameStart = file.path.length - fileName.length
  const fileNameMatches = file.matches
    .filter(m => m >= fileNameStart)
    .map(m => m - fileNameStart)

  return (
    <div
      onClick={onSelect}
      className={`
        flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors
        ${isSelected ? 'bg-editor-accent/20' : 'hover:bg-editor-hover'}
      `}
    >
      <FileText className="w-4 h-4 text-editor-text-muted flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm truncate">
          <HighlightedText text={fileName} matches={fileNameMatches} />
        </div>
        {dirPath && (
          <div className="text-xs text-editor-text-muted truncate">
            {dirPath}
          </div>
        )}
      </div>
    </div>
  )
})

export default function QuickOpen({ onClose }: QuickOpenProps) {
  const { workspacePath, openFile } = useStore()
  const [query, setQuery] = useState('')
  const [allFiles, setAllFiles] = useState<string[]>([])
  const [matches, setMatches] = useState<FileMatch[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // 递归获取所有文件
  const getAllFiles = useCallback(async (dirPath: string, prefix: string = ''): Promise<string[]> => {
    const items = await window.electronAPI.readDir(dirPath)
    if (!items) return []

    const files: string[] = []

    for (const item of items) {
      // 跳过隐藏文件和 node_modules
      if (item.name.startsWith('.') || item.name === 'node_modules') continue

      const relativePath = prefix ? `${prefix}/${item.name}` : item.name

      if (item.isDirectory) {
        const subFiles = await getAllFiles(item.path, relativePath)
        files.push(...subFiles)
      } else {
        files.push(relativePath)
      }
    }

    return files
  }, [])

  // 加载文件列表
  useEffect(() => {
    if (!workspacePath) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    getAllFiles(workspacePath).then(files => {
      setAllFiles(files)
      setIsLoading(false)
    })
  }, [workspacePath, getAllFiles])

  // 搜索文件
  useEffect(() => {
    if (!query.trim()) {
      // 显示最近的文件或全部文件（限制数量）
      setMatches(
        allFiles.slice(0, 20).map(path => ({
          path,
          name: path.split(/[/\\]/).pop() || path,
          score: 0,
          matches: [],
        }))
      )
      return
    }

    const results: FileMatch[] = []

    for (const filePath of allFiles) {
      const result = fuzzyMatch(query, filePath)
      if (result) {
        results.push({
          path: filePath,
          name: filePath.split(/[/\\]/).pop() || filePath,
          score: result.score,
          matches: result.matches,
        })
      }
    }

    // 按分数排序
    results.sort((a, b) => b.score - a.score)

    setMatches(results.slice(0, 50))
    setSelectedIndex(0)
  }, [query, allFiles])

  // 打开文件
  const handleOpenFile = useCallback(async (filePath: string) => {
    if (!workspacePath) return

    const fullPath = `${workspacePath}/${filePath}`
    const content = await window.electronAPI.readFile(fullPath)

    if (content !== null) {
      openFile(fullPath, content)
      onClose()
    }
  }, [workspacePath, openFile, onClose])

  // 键盘导航
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => Math.min(prev + 1, matches.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => Math.max(prev - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (matches[selectedIndex]) {
          handleOpenFile(matches[selectedIndex].path)
        }
        break
      case 'Escape':
        e.preventDefault()
        onClose()
        break
    }
  }, [matches, selectedIndex, handleOpenFile, onClose])

  // 自动聚焦
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // 滚动到选中项
  useEffect(() => {
    if (listRef.current) {
      const selectedEl = listRef.current.querySelector(`[data-index="${selectedIndex}"]`)
      selectedEl?.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-start justify-center pt-[15vh] z-50"
      onClick={onClose}
    >
      <div
        className="bg-editor-sidebar border border-editor-border rounded-xl shadow-2xl w-[500px] max-h-[60vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-editor-border">
          <Search className="w-5 h-5 text-editor-text-muted" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search files by name..."
            className="flex-1 bg-transparent text-editor-text placeholder-editor-text-muted focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded hover:bg-editor-hover transition-colors"
            >
              <X className="w-4 h-4 text-editor-text-muted" />
            </button>
          )}
        </div>

        {/* File List */}
        <div ref={listRef} className="overflow-y-auto max-h-[calc(60vh-60px)]">
          {isLoading ? (
            <div className="px-4 py-8 text-center text-editor-text-muted">
              <div className="w-6 h-6 border-2 border-editor-accent border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Loading files...
            </div>
          ) : matches.length === 0 ? (
            <div className="px-4 py-8 text-center text-editor-text-muted">
              {query ? 'No files found' : 'No files in workspace'}
            </div>
          ) : (
            matches.map((file, idx) => (
              <div key={file.path} data-index={idx}>
                <FileMatchItem
                  file={file}
                  isSelected={idx === selectedIndex}
                  onSelect={() => handleOpenFile(file.path)}
                />
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-editor-border bg-editor-bg/50 flex items-center justify-between text-xs text-editor-text-muted">
          <span>{matches.length} files</span>
          <div className="flex items-center gap-2">
            <kbd className="px-1.5 py-0.5 bg-editor-bg border border-editor-border rounded">↑↓</kbd>
            <span>navigate</span>
            <kbd className="px-1.5 py-0.5 bg-editor-bg border border-editor-border rounded">Enter</kbd>
            <span>open</span>
          </div>
        </div>
      </div>
    </div>
  )
}
