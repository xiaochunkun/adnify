import { useRef, useCallback, useEffect, useState } from 'react'
import MonacoEditor, { OnMount, loader } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import { X, Circle, AlertTriangle, AlertCircle, RefreshCw, FileCode } from 'lucide-react'
import { useStore } from '../store'
import { t } from '../i18n'
import DiffViewer from './DiffViewer'
import { lintService } from '../agent/lintService'
import { streamingEditService } from '../agent/streamingEditService'
import { LintError, StreamingEditState } from '../agent/toolTypes'

// Configure Monaco to load from CDN
loader.config({
  paths: {
    vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs'
  }
})

// 语言映射
const LANGUAGE_MAP: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  py: 'python',
  json: 'json',
  jsonc: 'json',
  md: 'markdown',
  mdx: 'markdown',
  css: 'css',
  scss: 'scss',
  less: 'less',
  html: 'html',
  htm: 'html',
  vue: 'html',
  svelte: 'html',
  xml: 'xml',
  svg: 'xml',
  yml: 'yaml',
  yaml: 'yaml',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  fish: 'shell',
  ps1: 'powershell',
  sql: 'sql',
  graphql: 'graphql',
  gql: 'graphql',
  rs: 'rust',
  go: 'go',
  java: 'java',
  kt: 'kotlin',
  swift: 'swift',
  c: 'c',
  cpp: 'cpp',
  h: 'c',
  hpp: 'cpp',
  cs: 'csharp',
  rb: 'ruby',
  php: 'php',
  lua: 'lua',
  r: 'r',
  dockerfile: 'dockerfile',
  toml: 'ini',
  ini: 'ini',
  env: 'ini',
}

const getLanguage = (path: string): string => {
  const fileName = path.split(/[/\\]/).pop()?.toLowerCase() || ''

  // 特殊文件名
  if (fileName === 'dockerfile') return 'dockerfile'
  if (fileName === 'makefile') return 'makefile'
  if (fileName.startsWith('.env')) return 'ini'

  const ext = fileName.split('.').pop() || ''
  return LANGUAGE_MAP[ext] || 'plaintext'
}

// 获取文件图标颜色
const getLanguageColor = (lang: string): string => {
  const colors: Record<string, string> = {
    typescript: '#3178c6',
    javascript: '#f7df1e',
    python: '#3776ab',
    rust: '#dea584',
    go: '#00add8',
    java: '#b07219',
    html: '#e34c26',
    css: '#563d7c',
    json: '#292929',
  }
  return colors[lang] || '#6e7681'
}

export default function Editor() {
  const { openFiles, activeFilePath, setActiveFile, closeFile, updateFileContent, markFileSaved, language } = useStore()
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<typeof import('monaco-editor') | null>(null)

  // Lint 错误状态
  const [lintErrors, setLintErrors] = useState<LintError[]>([])
  const [isLinting, setIsLinting] = useState(false)

  // 流式编辑预览状态
  const [streamingEdit, setStreamingEdit] = useState<StreamingEditState | null>(null)
  const [showDiffPreview, setShowDiffPreview] = useState(false)

  // 状态栏信息
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 })
  const [encoding] = useState('UTF-8')
  const [eol, setEol] = useState<'LF' | 'CRLF'>('LF')

  const activeFile = openFiles.find(f => f.path === activeFilePath)
  const activeLanguage = activeFile ? getLanguage(activeFile.path) : 'plaintext'

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor
    monacoRef.current = monaco

    // 监听光标位置变化
    editor.onDidChangeCursorPosition((e) => {
      setCursorPosition({ line: e.position.lineNumber, column: e.position.column })
    })

    // 检测换行符
    const model = editor.getModel()
    if (model) {
      const eolSeq = model.getEOL()
      setEol(eolSeq === '\r\n' ? 'CRLF' : 'LF')
    }

    // 配置 TypeScript/JavaScript 编译选项
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ESNext,
      module: monaco.languages.typescript.ModuleKind.ESNext,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      jsx: monaco.languages.typescript.JsxEmit.React,
      allowJs: true,
      checkJs: true,
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      allowSyntheticDefaultImports: true,
    })

    // 添加快捷键
    // Ctrl+D: 选择下一个匹配
    editor.addAction({
      id: 'select-next-occurrence',
      label: 'Select Next Occurrence',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyD],
      run: (ed) => {
        ed.getAction('editor.action.addSelectionToNextFindMatch')?.run()
      }
    })

    // Ctrl+/: 切换注释
    editor.addAction({
      id: 'toggle-comment',
      label: 'Toggle Comment',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Slash],
      run: (ed) => {
        ed.getAction('editor.action.commentLine')?.run()
      }
    })

    // Ctrl+Shift+K: 删除行
    editor.addAction({
      id: 'delete-line',
      label: 'Delete Line',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyK],
      run: (ed) => {
        ed.getAction('editor.action.deleteLines')?.run()
      }
    })

    // Alt+Up/Down: 移动行
    editor.addAction({
      id: 'move-line-up',
      label: 'Move Line Up',
      keybindings: [monaco.KeyMod.Alt | monaco.KeyCode.UpArrow],
      run: (ed) => {
        ed.getAction('editor.action.moveLinesUpAction')?.run()
      }
    })

    editor.addAction({
      id: 'move-line-down',
      label: 'Move Line Down',
      keybindings: [monaco.KeyMod.Alt | monaco.KeyCode.DownArrow],
      run: (ed) => {
        ed.getAction('editor.action.moveLinesDownAction')?.run()
      }
    })

    // Ctrl+G: 跳转到行
    editor.addAction({
      id: 'go-to-line',
      label: 'Go to Line',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyG],
      run: (ed) => {
        ed.getAction('editor.action.gotoLine')?.run()
      }
    })

    // Shift+Alt+F: 格式化文档
    editor.addAction({
      id: 'format-document',
      label: 'Format Document',
      keybindings: [monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF],
      run: (ed) => {
        ed.getAction('editor.action.formatDocument')?.run()
      }
    })

    // F2: 重命名符号
    editor.addAction({
      id: 'rename-symbol',
      label: 'Rename Symbol',
      keybindings: [monaco.KeyCode.F2],
      run: (ed) => {
        ed.getAction('editor.action.rename')?.run()
      }
    })
  }

  // 监听流式编辑
  useEffect(() => {
    if (!activeFilePath) return

    const activeEdit = streamingEditService.getActiveEditForFile(activeFilePath)
    if (activeEdit) {
      setStreamingEdit(activeEdit.state)
      setShowDiffPreview(true)

      const unsubscribe = streamingEditService.subscribe(activeEdit.editId, (state) => {
        setStreamingEdit(state)
        if (state.isComplete) {
          // 编辑完成后延迟关闭预览
          setTimeout(() => setShowDiffPreview(false), 500)
        }
      })

      return unsubscribe
    } else {
      setStreamingEdit(null)
      setShowDiffPreview(false)
    }
  }, [activeFilePath])

  // 运行 Lint 检查
  const runLintCheck = useCallback(async () => {
    if (!activeFilePath) return

    setIsLinting(true)
    try {
      const errors = await lintService.getLintErrors(activeFilePath, true)
      setLintErrors(errors)

      // 在编辑器中显示错误标记
      if (editorRef.current && monacoRef.current) {
        const monaco = monacoRef.current
        const model = editorRef.current.getModel()
        if (model) {
          const markers = errors.map(err => ({
            severity: err.severity === 'error'
              ? monaco.MarkerSeverity.Error
              : monaco.MarkerSeverity.Warning,
            message: `[${err.code}] ${err.message}`,
            startLineNumber: err.startLine,
            startColumn: 1,
            endLineNumber: err.endLine,
            endColumn: 1000,
          }))
          monaco.editor.setModelMarkers(model, 'lint', markers)
        }
      }
    } catch (e) {
      console.error('Lint check failed:', e)
    } finally {
      setIsLinting(false)
    }
  }, [activeFilePath])

  // 文件变化时清除 lint 错误
  useEffect(() => {
    setLintErrors([])
    if (editorRef.current && monacoRef.current) {
      const model = editorRef.current.getModel()
      if (model) {
        monacoRef.current.editor.setModelMarkers(model, 'lint', [])
      }
    }
  }, [activeFilePath])

  const handleSave = useCallback(async () => {
    if (activeFile) {
      const success = await window.electronAPI.writeFile(activeFile.path, activeFile.content)
      if (success) {
        markFileSaved(activeFile.path)
      }
    }
  }, [activeFile, markFileSaved])

  // Keyboard shortcut for save
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault()
      handleSave()
    }
  }, [handleSave])

  if (openFiles.length === 0) {
    return (
      <div className="flex-1 flex flex-col bg-editor-bg">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-pink-500/20 flex items-center justify-center">
              <span className="text-5xl">✨</span>
            </div>
            <h2 className="text-2xl font-semibold text-editor-text mb-2">{t('welcome', language)}</h2>
            <p className="text-editor-text-muted">{t('welcomeDesc', language)}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-editor-bg" onKeyDown={handleKeyDown}>
      {/* Tabs */}
      <div className="h-10 flex items-center justify-between bg-editor-sidebar border-b border-editor-border">
        <div className="flex items-center overflow-x-auto flex-1">
          {openFiles.map((file) => {
            const fileName = file.path.split(/[/\\]/).pop()
            const isActive = file.path === activeFilePath
            return (
              <div
                key={file.path}
                onClick={() => setActiveFile(file.path)}
                className={`
                  flex items-center gap-2 px-4 h-full border-r border-editor-border cursor-pointer
                  transition-colors group min-w-0
                  ${isActive ? 'bg-editor-bg text-editor-text' : 'text-editor-text-muted hover:bg-editor-hover'}
                `}
              >
                <span className="truncate text-sm">{fileName}</span>
                {file.isDirty && (
                  <Circle className="w-2 h-2 fill-editor-accent text-editor-accent flex-shrink-0" />
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    closeFile(file.path)
                  }}
                  className="p-0.5 rounded hover:bg-editor-hover opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          })}
        </div>

        {/* Lint 状态和按钮 */}
        {activeFile && (
          <div className="flex items-center gap-2 px-3 flex-shrink-0">
            {lintErrors.length > 0 && (
              <div className="flex items-center gap-1 text-xs">
                {lintErrors.filter(e => e.severity === 'error').length > 0 && (
                  <span className="flex items-center gap-1 text-red-400">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {lintErrors.filter(e => e.severity === 'error').length}
                  </span>
                )}
                {lintErrors.filter(e => e.severity === 'warning').length > 0 && (
                  <span className="flex items-center gap-1 text-yellow-400">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {lintErrors.filter(e => e.severity === 'warning').length}
                  </span>
                )}
              </div>
            )}
            <button
              onClick={runLintCheck}
              disabled={isLinting}
              className="p-1.5 rounded hover:bg-editor-hover transition-colors disabled:opacity-50"
              title="Run lint check"
            >
              <RefreshCw className={`w-4 h-4 text-editor-text-muted ${isLinting ? 'animate-spin' : ''}`} />
            </button>
          </div>
        )}
      </div>

      {/* 流式编辑预览 */}
      {showDiffPreview && streamingEdit && activeFile && (
        <div className="border-b border-editor-border">
          <DiffViewer
            originalContent={streamingEdit.originalContent}
            modifiedContent={streamingEdit.currentContent}
            filePath={streamingEdit.filePath}
            isStreaming={!streamingEdit.isComplete}
            onAccept={() => {
              updateFileContent(activeFile.path, streamingEdit.currentContent)
              setShowDiffPreview(false)
            }}
            onReject={() => {
              setShowDiffPreview(false)
            }}
            onClose={() => setShowDiffPreview(false)}
          />
        </div>
      )}

      {/* Editor */}
      <div className="flex-1 relative">
        {activeFile && (
          <MonacoEditor
            height="100%"
            language={activeLanguage}
            value={activeFile.content}
            theme="vs-dark"
            onMount={handleEditorMount}
            onChange={(value) => {
              if (value !== undefined) {
                updateFileContent(activeFile.path, value)
              }
            }}
            loading={
              <div className="flex items-center justify-center h-full">
                <div className="text-editor-text-muted">Loading editor...</div>
              </div>
            }
            options={{
              fontSize: 14,
              fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
              fontLigatures: true,
              minimap: { enabled: true, scale: 1 },
              scrollBeyondLastLine: false,
              smoothScrolling: true,
              cursorBlinking: 'smooth',
              cursorSmoothCaretAnimation: 'on',
              padding: { top: 16 },
              lineNumbers: 'on',
              renderLineHighlight: 'all',
              bracketPairColorization: { enabled: true },
              automaticLayout: true,
              // 增强功能
              suggest: {
                showKeywords: true,
                showSnippets: true,
                showClasses: true,
                showFunctions: true,
                showVariables: true,
                showModules: true,
              },
              quickSuggestions: {
                other: true,
                comments: false,
                strings: true,
              },
              parameterHints: { enabled: true },
              folding: true,
              foldingStrategy: 'indentation',
              showFoldingControls: 'mouseover',
              matchBrackets: 'always',
              renderWhitespace: 'selection',
              guides: {
                bracketPairs: true,
                indentation: true,
              },
              stickyScroll: { enabled: true },
              inlayHints: { enabled: 'on' },
            }}
          />
        )}
      </div>

      {/* Status Bar */}
      {activeFile && (
        <div className="h-6 flex items-center justify-between px-3 bg-editor-sidebar border-t border-editor-border text-xs text-editor-text-muted">
          <div className="flex items-center gap-4">
            {/* 错误/警告计数 */}
            {lintErrors.length > 0 && (
              <div className="flex items-center gap-2">
                {lintErrors.filter(e => e.severity === 'error').length > 0 && (
                  <span className="flex items-center gap-1 text-red-400">
                    <AlertCircle className="w-3 h-3" />
                    {lintErrors.filter(e => e.severity === 'error').length}
                  </span>
                )}
                {lintErrors.filter(e => e.severity === 'warning').length > 0 && (
                  <span className="flex items-center gap-1 text-yellow-400">
                    <AlertTriangle className="w-3 h-3" />
                    {lintErrors.filter(e => e.severity === 'warning').length}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* 光标位置 */}
            <span>Ln {cursorPosition.line}, Col {cursorPosition.column}</span>

            {/* 换行符 */}
            <span>{eol}</span>

            {/* 编码 */}
            <span>{encoding}</span>

            {/* 语言 */}
            <span className="flex items-center gap-1">
              <FileCode className="w-3 h-3" style={{ color: getLanguageColor(activeLanguage) }} />
              {activeLanguage.charAt(0).toUpperCase() + activeLanguage.slice(1)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
