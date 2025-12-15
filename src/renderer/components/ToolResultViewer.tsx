/**
 * 工具结果查看器
 * 根据工具类型智能展示结果
 */

import { useState, memo } from 'react'
import {
  FileText, FolderTree, Search, Terminal, AlertTriangle,
  ChevronDown, ChevronUp, Copy, Check
} from 'lucide-react'

interface ToolResultViewerProps {
  toolName: string
  result: string
  error?: string
}

// 解析目录树结果
function parseDirTree(result: string): { path: string; tree: string } | null {
  const match = result.match(/Directory tree of (.+?):\n([\s\S]+)/)
  if (match) {
    return { path: match[1], tree: match[2] }
  }
  return null
}

// 解析搜索结果
function parseSearchResults(result: string): { count: number; files: { name: string; matches: string[] }[] } | null {
  const countMatch = result.match(/Found (\d+) files? with matches/)
  if (!countMatch) return null

  const files: { name: string; matches: string[] }[] = []
  const fileRegex = /📄 (.+?):\n((?:  Line \d+:.+\n?)+)/g
  let match

  while ((match = fileRegex.exec(result)) !== null) {
    const matches = match[2].trim().split('\n').map(l => l.trim())
    files.push({ name: match[1], matches })
  }

  return { count: parseInt(countMatch[1], 10), files }
}

// 解析 lint 结果
function parseLintResults(result: string): { errors: number; warnings: number; items: string[] } | null {
  const countMatch = result.match(/Found (\d+) error\(s\), (\d+) warning\(s\)/)
  if (!countMatch) {
    if (result.includes('No lint errors')) {
      return { errors: 0, warnings: 0, items: [] }
    }
    return null
  }

  const items = result.split('\n').filter(l => l.startsWith('❌') || l.startsWith('⚠️'))
  return {
    errors: parseInt(countMatch[1], 10),
    warnings: parseInt(countMatch[2], 10),
    items,
  }
}

// 文件内容查看器
const FileContentViewer = memo(function FileContentViewer({ result }: { result: string }) {
  const [expanded, setExpanded] = useState(true)

  // 解析文件信息
  const fileMatch = result.match(/File: (.+?)\nLines (\d+)-(\d+) of (\d+)/)
  const codeMatch = result.match(/```\n([\s\S]*?)\n```/)

  if (!fileMatch || !codeMatch) {
    return <pre className="text-xs whitespace-pre-wrap">{result}</pre>
  }

  const [, filePath, startLine, endLine, totalLines] = fileMatch
  const code = codeMatch[1]
  const fileName = filePath.split(/[/\\]/).pop()

  return (
    <div className="rounded-lg overflow-hidden border border-editor-border">
      <div
        className="flex items-center justify-between px-3 py-2 bg-editor-hover cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-editor-accent" />
          <span className="text-sm font-medium">{fileName}</span>
          <span className="text-xs text-editor-text-muted">
            Lines {startLine}-{endLine} of {totalLines}
          </span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </div>
      {expanded && (
        <pre className="p-3 text-xs overflow-auto max-h-64 bg-black/20">
          {code}
        </pre>
      )}
    </div>
  )
})

// 目录树查看器
const DirTreeViewer = memo(function DirTreeViewer({ result }: { result: string }) {
  const parsed = parseDirTree(result)
  if (!parsed) return <pre className="text-xs whitespace-pre-wrap">{result}</pre>

  return (
    <div className="rounded-lg overflow-hidden border border-editor-border">
      <div className="flex items-center gap-2 px-3 py-2 bg-editor-hover">
        <FolderTree className="w-4 h-4 text-editor-accent" />
        <span className="text-sm font-medium truncate">{parsed.path}</span>
      </div>
      <pre className="p-3 text-xs overflow-auto max-h-64 bg-black/20 font-mono">
        {parsed.tree}
      </pre>
    </div>
  )
})

// 搜索结果查看器
const SearchResultViewer = memo(function SearchResultViewer({ result }: { result: string }) {
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set())
  const parsed = parseSearchResults(result)

  if (!parsed) return <pre className="text-xs whitespace-pre-wrap">{result}</pre>

  const toggleFile = (name: string) => {
    const newExpanded = new Set(expandedFiles)
    if (newExpanded.has(name)) {
      newExpanded.delete(name)
    } else {
      newExpanded.add(name)
    }
    setExpandedFiles(newExpanded)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm">
        <Search className="w-4 h-4 text-editor-accent" />
        <span>Found {parsed.count} file(s) with matches</span>
      </div>
      {parsed.files.map((file) => (
        <div key={file.name} className="rounded-lg border border-editor-border overflow-hidden">
          <div
            className="flex items-center gap-2 px-3 py-2 bg-editor-hover cursor-pointer"
            onClick={() => toggleFile(file.name)}
          >
            <FileText className="w-3.5 h-3.5 text-editor-text-muted" />
            <span className="text-sm flex-1">{file.name}</span>
            <span className="text-xs text-editor-text-muted">{file.matches.length} matches</span>
            {expandedFiles.has(file.name) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
          {expandedFiles.has(file.name) && (
            <div className="p-2 bg-black/20 text-xs space-y-1">
              {file.matches.map((match, idx) => (
                <div key={idx} className="font-mono text-editor-text-muted">
                  {match}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
})

// Lint 结果查看器
const LintResultViewer = memo(function LintResultViewer({ result }: { result: string }) {
  const parsed = parseLintResults(result)

  if (!parsed) return <pre className="text-xs whitespace-pre-wrap">{result}</pre>

  if (parsed.errors === 0 && parsed.warnings === 0) {
    return (
      <div className="flex items-center gap-2 text-green-400">
        <Check className="w-4 h-4" />
        <span className="text-sm">No lint errors found</span>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4 text-sm">
        <span className="text-red-400">{parsed.errors} error(s)</span>
        <span className="text-yellow-400">{parsed.warnings} warning(s)</span>
      </div>
      <div className="space-y-1 max-h-48 overflow-auto">
        {parsed.items.map((item, idx) => (
          <div
            key={idx}
            className={`text-xs px-2 py-1 rounded ${
              item.startsWith('❌') ? 'bg-red-500/10 text-red-300' : 'bg-yellow-500/10 text-yellow-300'
            }`}
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  )
})

// 终端结果查看器
const TerminalResultViewer = memo(function TerminalResultViewer({ result }: { result: string }) {
  const [copied, setCopied] = useState(false)

  const copyOutput = () => {
    navigator.clipboard.writeText(result)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // 解析命令和输出
  const commandMatch = result.match(/^\$ (.+)$/m)
  const exitCodeMatch = result.match(/Exit code: (\d+)/)

  return (
    <div className="rounded-lg border border-editor-border overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-editor-hover">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-editor-accent" />
          {commandMatch && (
            <code className="text-xs font-mono">{commandMatch[1]}</code>
          )}
        </div>
        <div className="flex items-center gap-2">
          {exitCodeMatch && (
            <span className={`text-xs ${
              exitCodeMatch[1] === '0' ? 'text-green-400' : 'text-red-400'
            }`}>
              Exit: {exitCodeMatch[1]}
            </span>
          )}
          <button
            onClick={copyOutput}
            className="p-1 rounded hover:bg-editor-bg transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
      <pre className="p-3 text-xs overflow-auto max-h-48 bg-black/20 font-mono whitespace-pre-wrap">
        {result}
      </pre>
    </div>
  )
})

export default function ToolResultViewer({ toolName, result, error }: ToolResultViewerProps) {
  if (error) {
    return (
      <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3">
        <div className="flex items-center gap-2 text-red-400 mb-2">
          <AlertTriangle className="w-4 h-4" />
          <span className="text-sm font-medium">Error</span>
        </div>
        <pre className="text-xs text-red-300">{error}</pre>
      </div>
    )
  }

  // 根据工具类型选择查看器
  switch (toolName) {
    case 'read_file':
      return <FileContentViewer result={result} />

    case 'get_dir_tree':
      return <DirTreeViewer result={result} />

    case 'search_files':
    case 'search_in_file':
      return <SearchResultViewer result={result} />

    case 'get_lint_errors':
      return <LintResultViewer result={result} />

    case 'run_command':
    case 'run_in_terminal':
      return <TerminalResultViewer result={result} />

    default:
      // 默认显示
      return (
        <pre className="text-xs bg-black/20 rounded-lg p-3 overflow-auto max-h-48 whitespace-pre-wrap">
          {result.slice(0, 1000)}
          {result.length > 1000 && '...'}
        </pre>
      )
  }
}
