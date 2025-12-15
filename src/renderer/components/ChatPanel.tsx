import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Send, Bot, User, Sparkles, Zap, MessageSquare,
  Trash2, StopCircle, Terminal, FileEdit, Search,
  FolderOpen, FileText, Check, X, AlertTriangle,
  FolderTree, History
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { useStore, Message, ToolCall } from '../store'
import { useAgent } from '../hooks/useAgent'
import { t } from '../i18n'
import CheckpointPanel from './CheckpointPanel'
import ToolResultViewer from './ToolResultViewer'

const ToolIcon = ({ name }: { name: string }) => {
  const icons: Record<string, typeof Terminal> = {
    read_file: FileText,
    write_file: FileEdit,
    edit_file: FileEdit,
    search_files: Search,
    search_in_file: Search,
    list_directory: FolderOpen,
    get_dir_tree: FolderTree,
    create_file_or_folder: FolderOpen,
    delete_file_or_folder: Trash2,
    run_command: Terminal,
    open_terminal: Terminal,
    run_in_terminal: Terminal,
    get_terminal_output: Terminal,
    list_terminals: Terminal,
    get_lint_errors: AlertTriangle,
  }
  const Icon = icons[name] || Terminal
  return <Icon className="w-4 h-4" />
}

function ToolCallDisplay({
  toolCall,
  onApprove,
  onReject,
}: {
  toolCall: ToolCall
  onApprove?: () => void
  onReject?: () => void
}) {
  const statusConfig = {
    pending: { color: 'text-gray-400 bg-gray-400/10', label: 'Pending' },
    awaiting_user: { color: 'text-yellow-400 bg-yellow-400/10', label: 'Awaiting Approval' },
    running: { color: 'text-blue-400 bg-blue-400/10', label: 'Running' },
    success: { color: 'text-green-400 bg-green-400/10', label: 'Success' },
    error: { color: 'text-red-400 bg-red-400/10', label: 'Error' },
    rejected: { color: 'text-orange-400 bg-orange-400/10', label: 'Rejected' },
  }

  const config = statusConfig[toolCall.status] || statusConfig.pending
  const isAwaiting = toolCall.status === 'awaiting_user'

  return (
    <div className={`rounded-xl p-4 ${config.color} border border-current/20`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ToolIcon name={toolCall.name} />
          <span className="font-medium">{toolCall.name}</span>
          {toolCall.approvalType && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-current/20">
              {toolCall.approvalType}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {toolCall.status === 'running' && (
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          )}
          <span className="text-xs opacity-70">{config.label}</span>
        </div>
      </div>

      {/* 参数显示 */}
      <div className="bg-black/20 rounded-lg p-3 mb-3">
        <pre className="text-xs overflow-x-auto whitespace-pre-wrap">
          {JSON.stringify(toolCall.arguments, null, 2)}
        </pre>
      </div>

      {/* 审批按钮 */}
      {isAwaiting && onApprove && onReject && (
        <div className="flex items-center gap-2 pt-2 border-t border-current/20">
          <AlertTriangle className="w-4 h-4 text-yellow-400" />
          <span className="text-sm flex-1">This action requires your approval</span>
          <button
            onClick={onReject}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
          >
            <X className="w-4 h-4" />
            Reject
          </button>
          <button
            onClick={onApprove}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
          >
            <Check className="w-4 h-4" />
            Approve
          </button>
        </div>
      )}

      {/* 结果/错误显示 */}
      {(toolCall.result || toolCall.error) && (
        <div className="mt-3 pt-3 border-t border-current/20">
          <ToolResultViewer
            toolName={toolCall.name}
            result={toolCall.result || ''}
            error={toolCall.error}
          />
        </div>
      )}
    </div>
  )
}

function ChatMessage({ message }: { message: Message }) {
  const { language } = useStore()
  const isUser = message.role === 'user'

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`
        w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
        ${isUser
          ? 'bg-gradient-to-br from-blue-500 to-purple-500'
          : 'bg-gradient-to-br from-emerald-500 to-cyan-500'}
      `}>
        {isUser ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-white" />}
      </div>
      <div className={`flex-1 ${isUser ? 'text-right' : ''}`}>
        <div className={`
          inline-block max-w-full text-left rounded-2xl px-4 py-3
          ${isUser
            ? 'bg-editor-active text-white'
            : 'bg-editor-hover text-editor-text'}
        `}>
          {message.role === 'tool' ? (
            <div className="text-sm">
              <span className="text-editor-text-muted">{t('toolResult', language)} </span>
              <span className="font-mono text-editor-accent">{message.toolName}</span>
              <pre className="mt-2 text-xs bg-black/20 rounded-lg p-3 overflow-x-auto max-h-48 whitespace-pre-wrap">
                {message.content.slice(0, 1000)}
                {message.content.length > 1000 && '...'}
              </pre>
            </div>
          ) : (
            <ReactMarkdown
              className="prose prose-invert prose-sm max-w-none"
              components={{
                code({ className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '')
                  const inline = !match
                  return inline ? (
                    <code className="bg-black/30 px-1.5 py-0.5 rounded text-editor-accent font-mono text-sm" {...props}>
                      {children}
                    </code>
                  ) : (
                    <SyntaxHighlighter
                      style={oneDark}
                      language={match[1]}
                      PreTag="div"
                      className="rounded-lg !bg-black/30 !my-2"
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  )
                }
              }}
            >
              {message.content}
            </ReactMarkdown>
          )}
          {message.isStreaming && (
            <span className="inline-block w-2 h-4 bg-editor-accent animate-pulse ml-1" />
          )}
        </div>
      </div>
    </div>
  )
}

export default function ChatPanel() {
  const {
    chatMode, setChatMode, messages, isStreaming, currentToolCalls,
    clearMessages, llmConfig, language, pendingToolCall, checkpoints,
    setTerminalVisible, terminalVisible
  } = useStore()
  const {
    sendMessage,
    abort,
    approveCurrentTool,
    rejectCurrentTool,
  } = useAgent()
  const [input, setInput] = useState('')
  const [showCheckpoints, setShowCheckpoints] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, currentToolCalls])

  const handleSubmit = useCallback(async () => {
    if (!input.trim() || isStreaming) return
    const userMessage = input.trim()
    setInput('')
    await sendMessage(userMessage)
  }, [input, isStreaming, sendMessage])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const hasApiKey = !!llmConfig.apiKey

  return (
    <div className="w-96 bg-editor-sidebar border-l border-editor-border flex flex-col relative">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-editor-border">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-editor-accent" />
          <span className="font-semibold">{t('aiAssistant', language)}</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Mode Toggle */}
          <div className="flex bg-editor-bg rounded-lg p-1">
            <button
              onClick={() => setChatMode('chat')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-all ${
                chatMode === 'chat'
                  ? 'bg-editor-active text-white'
                  : 'text-editor-text-muted hover:text-editor-text'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              {t('chat', language)}
            </button>
            <button
              onClick={() => setChatMode('agent')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-all ${
                chatMode === 'agent'
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                  : 'text-editor-text-muted hover:text-editor-text'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              {t('agent', language)}
            </button>
          </div>
          {/* Checkpoints button */}
          {chatMode === 'agent' && checkpoints.length > 0 && (
            <button
              onClick={() => setShowCheckpoints(!showCheckpoints)}
              className={`p-2 rounded-lg transition-colors ${
                showCheckpoints ? 'bg-editor-accent text-white' : 'hover:bg-editor-hover'
              }`}
              title="Checkpoints"
            >
              <History className="w-4 h-4" />
            </button>
          )}
          {/* Terminal button */}
          {chatMode === 'agent' && (
            <button
              onClick={() => setTerminalVisible(!terminalVisible)}
              className={`p-2 rounded-lg transition-colors ${
                terminalVisible ? 'bg-editor-accent text-white' : 'hover:bg-editor-hover'
              }`}
              title={t('terminal', language)}
            >
              <Terminal className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={clearMessages}
            className="p-2 rounded-lg hover:bg-editor-hover transition-colors"
            title={t('clearChat', language)}
          >
            <Trash2 className="w-4 h-4 text-editor-text-muted" />
          </button>
        </div>
      </div>

      {/* Checkpoint Panel (Slide-in) */}
      {showCheckpoints && (
        <div className="absolute top-14 right-0 w-80 h-[calc(100%-3.5rem)] bg-editor-sidebar border-l border-editor-border z-10 shadow-xl">
          <CheckpointPanel onClose={() => setShowCheckpoints(false)} />
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!hasApiKey && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 text-center">
            <p className="text-yellow-400 text-sm">
              {t('apiKeyWarning', language)}
            </p>
          </div>
        )}

        {messages.length === 0 && hasApiKey && (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-pink-500/20 flex items-center justify-center">
              {chatMode === 'agent' ? (
                <Zap className="w-8 h-8 text-purple-400" />
              ) : (
                <MessageSquare className="w-8 h-8 text-blue-400" />
              )}
            </div>
            <h3 className="font-medium text-editor-text mb-2">
              {chatMode === 'agent' ? t('agentMode', language) : t('chatMode', language)}
            </h3>
            <p className="text-sm text-editor-text-muted">
              {chatMode === 'agent' ? t('agentModeDesc', language) : t('chatModeDesc', language)}
            </p>
          </div>
        )}

        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}

        {currentToolCalls.map((toolCall) => (
          <ToolCallDisplay
            key={toolCall.id}
            toolCall={toolCall}
            onApprove={pendingToolCall?.id === toolCall.id ? approveCurrentTool : undefined}
            onReject={pendingToolCall?.id === toolCall.id ? rejectCurrentTool : undefined}
          />
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-editor-border">
        <div className="relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={hasApiKey ? t('askAnything', language) : t('configureApiKey', language)}
            disabled={!hasApiKey || !!pendingToolCall}
            className="w-full bg-editor-bg border border-editor-border rounded-xl px-4 py-3 pr-12
                     text-editor-text placeholder-editor-text-muted resize-none
                     focus:outline-none focus:border-editor-active focus:ring-1 focus:ring-editor-active
                     disabled:opacity-50 disabled:cursor-not-allowed"
            rows={3}
          />
          <button
            onClick={isStreaming ? abort : handleSubmit}
            disabled={!hasApiKey || (!input.trim() && !isStreaming) || !!pendingToolCall}
            className={`absolute right-3 bottom-3 p-2 rounded-lg transition-all
              ${isStreaming
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-editor-active hover:bg-blue-600'}
              disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isStreaming ? (
              <StopCircle className="w-4 h-4 text-white" />
            ) : (
              <Send className="w-4 h-4 text-white" />
            )}
          </button>
        </div>

        {/* 等待审批提示 */}
        {pendingToolCall && (
          <div className="mt-2 flex items-center gap-2 text-yellow-400 text-xs">
            <AlertTriangle className="w-3 h-3" />
            <span>Waiting for tool approval...</span>
          </div>
        )}

        <p className="text-xs text-editor-text-muted mt-2 text-center">
          {chatMode === 'agent' ? t('agentModeHint', language) : t('chatModeHint', language)}
        </p>
      </div>
    </div>
  )
}
