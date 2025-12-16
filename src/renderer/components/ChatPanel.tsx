/**
 * Chat Panel
 * 聊天面板 - 支持多线程、工具调用、文件拖放
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import { Sparkles, AlertTriangle, History, Plus, Trash2, User, Edit2, RefreshCw, X, File, Code, Folder, Upload } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Logo } from './Logo'
import { useStore } from '../store'
import { useAgent } from '../hooks/useAgent'
import { useChatThreads } from '../hooks/useChatThread'
import { t } from '../i18n'
import { toFullPath } from '../utils/pathUtils'
import { getEditorConfig } from '../config/editorConfig'

import { ChatInput, PendingImage } from './chat'
import { ToolCallDisplay } from './chat/ToolCallDisplay'
import FileMentionPopup from './FileMentionPopup'
import {
  ChatMessage,
  AssistantMessage,
  InlineToolCall,
  isUserMessage,
  isAssistantMessage,
  isToolMessage,
  isCheckpoint,
  getMessageText,
  FileSelection,
} from '../agent/types/chatTypes'

export default function ChatPanel() {
  const { chatMode, setChatMode, llmConfig, workspacePath, openFile, setActiveFile, language, activeFilePath } =
    useStore()

  const {
    messages,
    streamState,
    isStreaming,
    isAwaitingApproval,
    sendMessage,
    abort,
    approveCurrentTool,
    rejectCurrentTool,
    clearMessages,
  } = useAgent()

  const {
    allThreads,
    currentThread,
    openNewThread,
    switchToThread,
    deleteThread,
    deleteMessagesAfter,
    stagingSelections,
    addStagingSelection,
    removeStagingSelection,
    clearStagingSelections,
  } = useChatThreads()

  const [input, setInput] = useState('')
  const [images, setImages] = useState<PendingImage[]>([])
  const [showThreads, setShowThreads] = useState(false)
  const [showFileMention, setShowFileMention] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionPosition, setMentionPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const inputContainerRef = useRef<HTMLDivElement>(null)

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 处理文件点击
  const handleFileClick = useCallback(
    async (filePath: string) => {
      const fullPath = toFullPath(filePath, workspacePath)
      const content = await window.electronAPI.readFile(fullPath)
      if (content === null) return

      openFile(fullPath, content)
      setActiveFile(fullPath)
    },
    [workspacePath, openFile, setActiveFile]
  )

  // 图片处理
  const addImage = useCallback(async (file: File) => {
    const id = crypto.randomUUID()
    const previewUrl = URL.createObjectURL(file)

    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.split(',')[1]
      setImages((prev) => prev.map((img) => (img.id === id ? { ...img, base64 } : img)))
    }
    reader.readAsDataURL(file)

    setImages((prev) => [...prev, { id, file, previewUrl }])
  }, [])

  // 粘贴处理
  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData.items
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault()
          const file = item.getAsFile()
          if (file) addImage(file)
        }
      }
    },
    [addImage]
  )

  // 拖放处理
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // 只有当离开整个容器时才取消拖放状态
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX
    const y = e.clientY
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsDragging(false)
    }
  }, [])

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      // 处理从文件系统拖入的文件
      const files = Array.from(e.dataTransfer.files)
      
      // 图片文件 - 添加到消息
      const imageFiles = files.filter((f) => f.type.startsWith('image/'))
      if (imageFiles.length > 0) {
        imageFiles.forEach(addImage)
        return
      }

      // 代码/文本文件 - 添加到 staging selections
      const codeExtensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.c', '.cpp', '.h', '.hpp', '.cs', '.go', '.rs', '.rb', '.php', '.swift', '.kt', '.scala', '.vue', '.svelte', '.html', '.css', '.scss', '.less', '.json', '.yaml', '.yml', '.xml', '.md', '.txt', '.sql', '.sh', '.bash', '.zsh', '.ps1', '.bat', '.cmd']
      
      for (const file of files) {
        const ext = '.' + file.name.split('.').pop()?.toLowerCase()
        if (codeExtensions.includes(ext) || file.type.startsWith('text/')) {
          // 获取文件路径（如果是从文件管理器拖入）
          const filePath = (file as any).path || file.name
          
          // 检查是否已存在
          const exists = stagingSelections.some(s => s.uri === filePath)
          if (!exists) {
            const selection: FileSelection = {
              type: 'File',
              uri: filePath,
              state: { wasAddedAsCurrentFile: false }
            }
            addStagingSelection(selection)
          }
        }
      }

      // 处理从编辑器/文件树拖入的文件路径（通过 dataTransfer.getData）
      const textData = e.dataTransfer.getData('text/plain')
      if (textData && !files.length) {
        // 可能是文件路径
        const lines = textData.split('\n').filter(l => l.trim())
        for (const line of lines) {
          const trimmed = line.trim()
          // 检查是否像文件路径
          if (trimmed.includes('/') || trimmed.includes('\\')) {
            const exists = stagingSelections.some(s => s.uri === trimmed)
            if (!exists) {
              const selection: FileSelection = {
                type: 'File',
                uri: trimmed,
                state: { wasAddedAsCurrentFile: false }
              }
              addStagingSelection(selection)
            }
          }
        }
      }
    },
    [addImage, stagingSelections, addStagingSelection]
  )

  // 输入变化处理
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    const cursorPos = e.target.selectionStart || 0
    setInput(value)

    const textBeforeCursor = value.slice(0, cursorPos)
    const atMatch = textBeforeCursor.match(/@([^\s@]*)$/)

    if (atMatch) {
      setMentionQuery(atMatch[1])
      if (inputContainerRef.current) {
        const rect = inputContainerRef.current.getBoundingClientRect()
        setMentionPosition({ x: rect.left + 16, y: rect.top })
      }
      setShowFileMention(true)
    } else {
      setShowFileMention(false)
      setMentionQuery('')
    }
  }, [])

  // 文件选择 - 统一添加到 staging selections（不再插入 @ 文本）
  const handleSelectFile = useCallback(
    (filePath: string) => {
      const cursorPos = textareaRef.current?.selectionStart || input.length
      const textBeforeCursor = input.slice(0, cursorPos)
      const textAfterCursor = input.slice(cursorPos)

      // 移除输入框中的 @ 前缀
      const atIndex = textBeforeCursor.lastIndexOf('@')
      if (atIndex !== -1) {
        const newInput = textBeforeCursor.slice(0, atIndex) + textAfterCursor.trimStart()
        setInput(newInput)
      }

      // 添加到 staging selections
      const fullPath = workspacePath ? `${workspacePath}/${filePath}` : filePath
      const exists = stagingSelections.some(s => s.uri === fullPath || s.uri.endsWith(filePath))
      if (!exists) {
        const selection: FileSelection = {
          type: 'File',
          uri: fullPath,
          state: { wasAddedAsCurrentFile: false }
        }
        addStagingSelection(selection)
      }

      setShowFileMention(false)
      setMentionQuery('')
      textareaRef.current?.focus()
    },
    [input, workspacePath, stagingSelections, addStagingSelection]
  )

  // 提交
  const handleSubmit = useCallback(async () => {
    if ((!input.trim() && images.length === 0) || isStreaming) return

    let userMessage: string | Array<{ type: 'text'; text: string } | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }> = input.trim()

    if (images.length > 0) {
      const readyImages = images.filter((img) => img.base64)
      if (readyImages.length !== images.length) return

      userMessage = [
        { type: 'text' as const, text: input.trim() },
        ...readyImages.map((img) => ({
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: img.file.type,
            data: img.base64!,
          },
        })),
      ]
    }

    setInput('')
    setImages([])
    await sendMessage(userMessage)
  }, [input, images, isStreaming, sendMessage])

  // 编辑消息
  const handleStartEdit = useCallback((messageId: string, content: string) => {
    setEditingMessageId(messageId)
    setEditContent(content)
  }, [])

  const handleCancelEdit = useCallback(() => {
    setEditingMessageId(null)
    setEditContent('')
  }, [])

  const handleSaveEdit = useCallback(async (messageId: string) => {
    if (!editContent.trim()) return
    
    // 删除该消息之后的所有消息
    deleteMessagesAfter(messageId)
    
    // 发送编辑后的消息
    setEditingMessageId(null)
    setEditContent('')
    await sendMessage(editContent.trim())
  }, [editContent, deleteMessagesAfter, sendMessage])

  // 添加当前文件到 staging selections
  const handleAddCurrentFile = useCallback(() => {
    if (!activeFilePath) return
    
    // 检查是否已存在
    const exists = stagingSelections.some(
      s => s.type === 'File' && s.uri === activeFilePath
    )
    if (exists) return
    
    const selection: FileSelection = {
      type: 'File',
      uri: activeFilePath,
      state: { wasAddedAsCurrentFile: true }
    }
    addStagingSelection(selection)
  }, [activeFilePath, stagingSelections, addStagingSelection])

  // 重新生成
  const handleRegenerate = useCallback(async (messageId: string) => {
    // 找到该助手消息之前的用户消息
    const msgIndex = messages.findIndex(m => m.id === messageId)
    if (msgIndex <= 0) return
    
    // 向前找最近的用户消息
    let userMsgIndex = msgIndex - 1
    while (userMsgIndex >= 0 && messages[userMsgIndex].role !== 'user') {
      userMsgIndex--
    }
    
    if (userMsgIndex < 0) return
    
    const userMsg = messages[userMsgIndex]
    if (!isUserMessage(userMsg)) return
    
    // 删除用户消息之后的所有消息（包括当前助手消息）
    deleteMessagesAfter(userMsg.id)
    
    // 重新发送用户消息
    await sendMessage(userMsg.content)
  }, [messages, deleteMessagesAfter, sendMessage])

  // 键盘处理
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (showFileMention) {
        if (e.key === 'Escape') {
          e.preventDefault()
          setShowFileMention(false)
          setMentionQuery('')
        }
        if (['Enter', 'ArrowUp', 'ArrowDown', 'Tab'].includes(e.key)) {
          e.preventDefault()
          return
        }
      }

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [showFileMention, handleSubmit]
  )

  // 获取字体大小
  const editorConfig = getEditorConfig()
  const fontSize = Math.max(12, editorConfig.fontSize - 2)

  // Markdown 组件配置
  const markdownComponents = useCallback(() => ({
    code({ className, children, node, ...props }: any) {
      const match = /language-(\w+)/.exec(className || '')
      const content = String(children)
      const isCodeBlock = match || node?.position?.start?.line !== node?.position?.end?.line
      const isInline = !isCodeBlock && !content.includes('\n')

      return isInline ? (
        <code
          className="bg-surface-active px-1.5 py-0.5 rounded text-accent font-mono text-[0.9em]"
          {...props}
        >
          {children}
        </code>
      ) : (
        <div className="relative group/code my-3 rounded-lg overflow-hidden border border-border-subtle bg-[#0a0a0b]">
          <div className="flex items-center justify-between px-3 py-1.5 bg-surface border-b border-border-subtle">
            <span className="text-[10px] text-text-muted font-mono uppercase">
              {match?.[1] || 'code'}
            </span>
          </div>
          <SyntaxHighlighter
            style={vscDarkPlus}
            language={match?.[1]}
            PreTag="div"
            className="!bg-transparent !p-3 !m-0 custom-scrollbar"
            customStyle={{ background: 'transparent', margin: 0, fontSize: fontSize - 1 }}
            wrapLines={true}
            wrapLongLines={true}
          >
            {String(children).replace(/\n$/, '')}
          </SyntaxHighlighter>
        </div>
      )
    },
    p: ({ children }: any) => (
      <p className="mb-2 last:mb-0" style={{ fontSize }}>
        {children}
      </p>
    ),
    ul: ({ children }: any) => (
      <ul className="list-disc pl-4 mb-2 space-y-1 marker:text-text-muted" style={{ fontSize }}>
        {children}
      </ul>
    ),
    ol: ({ children }: any) => (
      <ol className="list-decimal pl-4 mb-2 space-y-1 marker:text-text-muted" style={{ fontSize }}>
        {children}
      </ol>
    ),
    li: ({ children }: any) => <li style={{ fontSize }}>{children}</li>,
    a: ({ href, children }: any) => (
      <a href={href} target="_blank" className="text-accent hover:underline transition-colors">
        {children}
      </a>
    ),
    blockquote: ({ children }: any) => (
      <blockquote className="border-l-2 border-accent/50 pl-3 py-1 my-2 text-text-muted">
        {children}
      </blockquote>
    ),
    h1: ({ children }: any) => (
      <h1 className="text-lg font-semibold mb-2 mt-4 first:mt-0">{children}</h1>
    ),
    h2: ({ children }: any) => (
      <h2 className="text-base font-semibold mb-2 mt-3 first:mt-0">{children}</h2>
    ),
    h3: ({ children }: any) => (
      <h3 className="text-sm font-semibold mb-1 mt-2 first:mt-0">{children}</h3>
    ),
  }), [fontSize])

  // 渲染消息
  const renderMessage = useCallback(
    (msg: ChatMessage) => {
      if (isCheckpoint(msg)) {
        return null // 检查点不显示
      }

      if (isToolMessage(msg)) {
        // Cursor 风格：工具调用已经内嵌在 assistant 消息中显示
        // 独立的工具消息只用于对话历史，不在 UI 中显示
        return null
      }

      if (isUserMessage(msg)) {
        const textContent = getMessageText(msg.content)
        const isEditing = editingMessageId === msg.id
        
        return (
          <div key={msg.id} className="w-full px-4 py-3 group hover:bg-surface/30 transition-colors">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-md flex items-center justify-center bg-surface-active text-text-secondary flex-shrink-0">
                <User className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-medium text-text-secondary">You</span>
              
              {/* 编辑按钮 */}
              {!isEditing && !isStreaming && (
                <button
                  onClick={() => handleStartEdit(msg.id, textContent)}
                  className="ml-auto p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-surface-active text-text-muted hover:text-text-primary transition-all"
                  title="Edit message"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="pl-8">
              {isEditing ? (
                <div className="space-y-2">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full bg-background border border-border-subtle rounded-lg px-3 py-2 text-text-primary resize-none focus:outline-none focus:border-accent"
                    style={{ fontSize }}
                    rows={3}
                    autoFocus
                  />
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      onClick={handleCancelEdit}
                      className="px-3 py-1 text-xs text-text-muted hover:text-text-primary transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleSaveEdit(msg.id)}
                      className="px-3 py-1 bg-accent text-white text-xs rounded-md hover:bg-accent-hover transition-colors"
                    >
                      Save & Resend
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-text-primary whitespace-pre-wrap break-words" style={{ fontSize }}>
                  {textContent}
                </p>
              )}
            </div>
          </div>
        )
      }

      if (isAssistantMessage(msg)) {
        const assistantMsg = msg as AssistantMessage
        const hasContent = msg.content.trim() || msg.isStreaming || (assistantMsg.toolCalls && assistantMsg.toolCalls.length > 0)
        if (!hasContent) return null

        return (
          <div key={msg.id} className="w-full px-4 py-3 group hover:bg-surface/30 transition-colors">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-md flex items-center justify-center bg-accent/20 text-accent flex-shrink-0">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-medium text-text-secondary">Adnify</span>
              
              {/* 重新生成按钮 */}
              {!msg.isStreaming && !isStreaming && (
                <button
                  onClick={() => handleRegenerate(msg.id)}
                  className="ml-auto p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-surface-active text-text-muted hover:text-text-primary transition-all"
                  title="Regenerate response"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="pl-8 space-y-3">
              {/* 文本内容 */}
              {msg.content && (
                <ReactMarkdown
                  className="prose prose-invert max-w-none break-words leading-relaxed text-text-primary"
                  components={markdownComponents()}
                >
                  {msg.content}
                </ReactMarkdown>
              )}
              
              {/* 内嵌工具调用 (Cursor 风格) */}
              {assistantMsg.toolCalls && assistantMsg.toolCalls.length > 0 && (
                <div className="space-y-2">
                  {assistantMsg.toolCalls.map((tc: InlineToolCall) => (
                    <ToolCallDisplay
                      key={tc.id}
                      toolCall={{
                        id: tc.id,
                        name: tc.name,
                        arguments: tc.rawParams,
                        status: tc.status === 'success' ? 'success' : tc.status === 'tool_error' ? 'error' : tc.status === 'running_now' ? 'running' : 'pending',
                        result: tc.result,
                        error: tc.error,
                      }}
                      onApprove={tc.status === 'tool_request' && isAwaitingApproval ? approveCurrentTool : undefined}
                      onReject={tc.status === 'tool_request' && isAwaitingApproval ? rejectCurrentTool : undefined}
                      onFileClick={handleFileClick}
                    />
                  ))}
                </div>
              )}
              
              {msg.isStreaming && (
                <span className="inline-block w-1.5 h-4 bg-accent animate-pulse ml-0.5 align-middle rounded-sm" />
              )}
            </div>
          </div>
        )
      }

      return null
    },
    [isAwaitingApproval, approveCurrentTool, rejectCurrentTool, handleFileClick, fontSize, markdownComponents, editingMessageId, editContent, isStreaming, handleStartEdit, handleCancelEdit, handleSaveEdit, handleRegenerate]
  )

  const hasApiKey = !!llmConfig.apiKey

  return (
    <div
      className={`w-full h-full flex flex-col relative z-10 bg-[#09090b] transition-colors ${
        isDragging ? 'bg-accent/5 ring-2 ring-inset ring-accent' : ''
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <select
            value={chatMode}
            onChange={(e) => setChatMode(e.target.value as any)}
            className="text-xs bg-surface border border-border-subtle rounded px-2 py-1 text-text-secondary"
          >
            <option value="chat">Chat</option>
            <option value="agent">Agent</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          {/* Thread selector */}
          <button
            onClick={() => setShowThreads(!showThreads)}
            className="p-1.5 rounded hover:bg-surface-active text-text-muted hover:text-text-primary transition-colors"
            title="Chat history"
          >
            <History className="w-4 h-4" />
          </button>

          {/* New thread */}
          <button
            onClick={() => openNewThread()}
            className="p-1.5 rounded hover:bg-surface-active text-text-muted hover:text-text-primary transition-colors"
            title="New chat"
          >
            <Plus className="w-4 h-4" />
          </button>

          {/* Clear */}
          <button
            onClick={clearMessages}
            className="p-1.5 rounded hover:bg-surface-active text-text-muted hover:text-text-primary transition-colors"
            title="Clear chat"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Thread list overlay */}
      {showThreads && (
        <div className="absolute top-12 right-0 left-0 bottom-0 bg-background/95 backdrop-blur-md z-30 overflow-hidden p-4">
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium text-text-primary mb-2">Chat History</h3>
            {allThreads.map((thread) => (
              <div
                key={thread.id}
                className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${
                  currentThread?.id === thread.id
                    ? 'bg-accent/20 text-accent'
                    : 'hover:bg-surface-active text-text-secondary'
                }`}
                onClick={() => {
                  switchToThread(thread.id)
                  setShowThreads(false)
                }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs truncate">
                    {thread.messages.length > 0
                      ? getMessageText(
                          (thread.messages.find((m) => m.role === 'user') as any)?.content || ''
                        ).slice(0, 50) || 'New chat'
                      : 'New chat'}
                  </p>
                  <p className="text-xs text-text-muted">
                    {new Date(thread.lastModified).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteThread(thread.id)
                  }}
                  className="p-1 rounded hover:bg-red-500/20 text-text-muted hover:text-red-500"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Drag Overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-background/90 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-3 p-8 rounded-xl border-2 border-dashed border-accent bg-accent/5">
            <Upload className="w-12 h-12 text-accent" />
            <p className="text-lg font-medium text-text-primary">Drop files here</p>
            <p className="text-sm text-text-muted">Images will be attached, code files will be added to context</p>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar p-0 pb-4 bg-background">
        {/* API Key Warning */}
        {!hasApiKey && (
          <div className="m-4 p-4 border border-warning/20 bg-warning/5 rounded-lg flex gap-3">
            <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0" />
            <div>
              <span className="font-medium text-sm text-warning block mb-1">
                {t('setupRequired', language)}
              </span>
              <p className="text-xs text-text-muted">{t('setupRequiredDesc', language)}</p>
            </div>
          </div>
        )}

        {/* Empty State */}
        {messages.length === 0 && hasApiKey && (
          <div className="h-full flex flex-col items-center justify-center opacity-40 select-none pointer-events-none gap-6">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-surface to-surface-active border border-border-subtle flex items-center justify-center shadow-2xl">
              <Logo className="w-12 h-12" glow />
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-text-primary mb-1">Adnify Agent</p>
              <p className="text-sm text-text-muted">{t('howCanIHelp', language)}</p>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex flex-col gap-0 pb-4">
          {messages.map((msg) => renderMessage(msg))}
          
          {/* 流式工具调用显示 */}
          {streamState?.isRunning === 'LLM' && streamState.llmInfo?.toolCallSoFar && (
            <div className="px-4 py-2">
              <div className="flex items-center gap-2 p-3 bg-surface rounded-lg border border-border-subtle">
                <div className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center animate-pulse">
                  <Sparkles className="w-3 h-3 text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-text-primary">
                      {streamState.llmInfo.toolCallSoFar.name.replace(/_/g, ' ')}
                    </span>
                    {!streamState.llmInfo.toolCallSoFar.isDone && (
                      <span className="text-xs text-text-muted animate-pulse">generating...</span>
                    )}
                  </div>
                  {Object.keys(streamState.llmInfo.toolCallSoFar.rawParams).length > 0 && (
                    <div className="mt-1 text-xs text-text-muted font-mono truncate">
                      {Object.entries(streamState.llmInfo.toolCallSoFar.rawParams)
                        .slice(0, 2)
                        .map(([k, v]) => `${k}: ${String(v).slice(0, 30)}${String(v).length > 30 ? '...' : ''}`)
                        .join(', ')}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div ref={messagesEndRef} />
      </div>

      {/* File Mention Popup */}
      {showFileMention && (
        <FileMentionPopup
          position={mentionPosition}
          searchQuery={mentionQuery}
          onSelect={handleSelectFile}
          onClose={() => {
            setShowFileMention(false)
            setMentionQuery('')
          }}
        />
      )}

      {/* Staging Selections */}
      <div className="px-4 py-2 border-t border-border-subtle bg-surface/30">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Add current file button */}
          {activeFilePath && !stagingSelections.some(s => s.type === 'File' && s.uri === activeFilePath) && (
            <button
              onClick={handleAddCurrentFile}
              className="flex items-center gap-1.5 px-2 py-1 bg-accent/10 hover:bg-accent/20 rounded-md border border-accent/30 text-xs text-accent transition-colors"
              title="Add current file to context"
            >
              <Plus className="w-3 h-3" />
              <span className="truncate max-w-[100px]">{activeFilePath.split(/[\\/]/).pop()}</span>
            </button>
          )}
          
          {stagingSelections.map((selection, index) => (
            <div
              key={`${selection.uri}-${index}`}
              className="flex items-center gap-1.5 px-2 py-1 bg-surface rounded-md border border-border-subtle text-xs"
            >
              {selection.type === 'File' && <File className="w-3 h-3 text-accent" />}
              {selection.type === 'CodeSelection' && <Code className="w-3 h-3 text-accent" />}
              {selection.type === 'Folder' && <Folder className="w-3 h-3 text-accent" />}
              <span className="text-text-secondary truncate max-w-[150px]">
                {selection.uri.split(/[\\/]/).pop()}
                {selection.type === 'CodeSelection' && (
                  <span className="text-text-muted ml-1">
                    :{selection.range[0]}-{selection.range[1]}
                  </span>
                )}
              </span>
              <button
                onClick={() => removeStagingSelection(index)}
                className="p-0.5 rounded hover:bg-red-500/20 text-text-muted hover:text-red-500 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          {stagingSelections.length > 1 && (
            <button
              onClick={clearStagingSelections}
              className="text-xs text-text-muted hover:text-text-primary transition-colors"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Input */}
      <ChatInput
        input={input}
        setInput={setInput}
        images={images}
        setImages={setImages}
        isStreaming={isStreaming}
        hasApiKey={hasApiKey}
        hasPendingToolCall={isAwaitingApproval}
        chatMode={chatMode}
        onSubmit={handleSubmit}
        onAbort={abort}
        onInputChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        textareaRef={textareaRef}
        inputContainerRef={inputContainerRef}
      />
    </div>
  )
}
