import { useState } from 'react'
import { Copy, Check, Play, FileCode, ChevronDown, ChevronUp } from 'lucide-react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { useStore } from '../store'

interface CodePreviewProps {
  code: string
  language?: string
  fileName?: string
  showLineNumbers?: boolean
  maxHeight?: number
  onApply?: (code: string) => void
  onRun?: (code: string) => void
}

const languageMap: Record<string, string> = {
  js: 'javascript',
  ts: 'typescript',
  jsx: 'javascript',
  tsx: 'typescript',
  py: 'python',
  rb: 'ruby',
  go: 'go',
  rs: 'rust',
  java: 'java',
  cpp: 'cpp',
  c: 'c',
  cs: 'csharp',
  php: 'php',
  swift: 'swift',
  kt: 'kotlin',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  sql: 'sql',
  html: 'html',
  css: 'css',
  scss: 'scss',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  md: 'markdown',
  xml: 'xml',
}

function detectLanguage(code: string, fileName?: string): string {
  if (fileName) {
    const ext = fileName.split('.').pop()?.toLowerCase()
    if (ext && languageMap[ext]) return languageMap[ext]
  }

  // Simple heuristics
  if (code.includes('import React') || code.includes('useState')) return 'typescript'
  if (code.includes('def ') && code.includes(':')) return 'python'
  if (code.includes('func ') && code.includes('package ')) return 'go'
  if (code.includes('fn ') && code.includes('let mut')) return 'rust'
  if (code.includes('public class') || code.includes('private void')) return 'java'

  return 'plaintext'
}

export default function CodePreview({
  code,
  language,
  fileName,
  showLineNumbers = true,
  maxHeight = 400,
  onApply,
  onRun,
}: CodePreviewProps) {
  const [copied, setCopied] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const { language: uiLanguage } = useStore()

  const detectedLanguage = language || detectLanguage(code, fileName)
  const lineCount = code.split('\n').length

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-xl border border-editor-border overflow-hidden bg-[#282c34]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-editor-sidebar border-b border-editor-border">
        <div className="flex items-center gap-2">
          <FileCode className="w-4 h-4 text-editor-accent" />
          {fileName ? (
            <span className="text-sm text-editor-text">{fileName}</span>
          ) : (
            <span className="text-sm text-editor-text-muted">{detectedLanguage}</span>
          )}
          <span className="text-xs text-editor-text-muted">({lineCount} lines)</span>
        </div>
        <div className="flex items-center gap-1">
          {onRun && (
            <button
              onClick={() => onRun(code)}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
            >
              <Play className="w-3 h-3" />
              Run
            </button>
          )}
          {onApply && (
            <button
              onClick={() => onApply(code)}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-editor-active/20 text-editor-accent hover:bg-editor-active/30 transition-colors"
            >
              Apply
            </button>
          )}
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-md hover:bg-editor-hover transition-colors"
            title="Copy code"
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-400" />
            ) : (
              <Copy className="w-4 h-4 text-editor-text-muted" />
            )}
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-md hover:bg-editor-hover transition-colors"
          >
            {collapsed ? (
              <ChevronDown className="w-4 h-4 text-editor-text-muted" />
            ) : (
              <ChevronUp className="w-4 h-4 text-editor-text-muted" />
            )}
          </button>
        </div>
      </div>

      {/* Code */}
      {!collapsed && (
        <div style={{ maxHeight }} className="overflow-auto">
          <SyntaxHighlighter
            language={detectedLanguage}
            style={oneDark}
            showLineNumbers={showLineNumbers}
            customStyle={{
              margin: 0,
              padding: '1rem',
              background: 'transparent',
              fontSize: '13px',
            }}
            lineNumberStyle={{
              minWidth: '3em',
              paddingRight: '1em',
              color: '#636d83',
              userSelect: 'none',
            }}
          >
            {code}
          </SyntaxHighlighter>
        </div>
      )}
    </div>
  )
}
