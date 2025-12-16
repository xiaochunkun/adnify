/**
 * Composer 面板
 * 多文件编辑模式 UI
 */

import React, { useState, useCallback, useEffect } from 'react'
import {
  X, Plus, FileCode, Sparkles, Check, XCircle,
  ChevronDown, ChevronRight, Loader2, FolderTree
} from 'lucide-react'
import { useStore } from '../store'
import { composerService, ComposerEdit, ComposerPlan } from '../agent/composerService'

interface ComposerPanelProps {
  onClose: () => void
}

export default function ComposerPanel({ onClose }: ComposerPanelProps) {
  const { workspacePath, llmConfig, openFile, setActiveFile } = useStore()
  
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])
  const [instructions, setInstructions] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [plan, setPlan] = useState<ComposerPlan | null>(null)
  const [expandedEdits, setExpandedEdits] = useState<Set<string>>(new Set())
  const [relatedFiles, setRelatedFiles] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  // 添加文件
  const handleAddFile = useCallback(async () => {
    // 使用 electron 的文件选择对话框
    const result = await window.electronAPI.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      defaultPath: workspacePath || undefined,
    })
    
    if (result && result.length > 0) {
      setSelectedFiles((prev: string[]) => [...new Set([...prev, ...result])])
    }
  }, [workspacePath])

  // 移除文件
  const handleRemoveFile = useCallback((filePath: string) => {
    setSelectedFiles((prev: string[]) => prev.filter((f: string) => f !== filePath))
  }, [])

  // 分析依赖
  useEffect(() => {
    const analyzeAll = async () => {
      const allRelated: Set<string> = new Set()
      for (const file of selectedFiles) {
        const deps = await composerService.analyzeFileDependencies(file)
        deps.forEach((d: string) => allRelated.add(d))
      }
      selectedFiles.forEach((f: string) => allRelated.delete(f))
      setRelatedFiles(Array.from(allRelated).slice(0, 5))
    }
    
    if (selectedFiles.length > 0) {
      analyzeAll()
    } else {
      setRelatedFiles([])
    }
  }, [selectedFiles])

  // 添加相关文件
  const handleAddRelatedFile = useCallback((filePath: string) => {
    setSelectedFiles((prev: string[]) => [...prev, filePath])
  }, [])

  // 生成编辑计划
  const handleGenerate = useCallback(async () => {
    if (selectedFiles.length === 0 || !instructions.trim()) return
    if (!llmConfig.apiKey) {
      setError('Please configure your API key first')
      return
    }

    setIsProcessing(true)
    setError(null)
    setPlan(null)

    try {
      // 构建上下文
      const context = await composerService.buildContext(selectedFiles, instructions)
      const systemPrompt = composerService.buildComposerPrompt(context)

      // 发送到 LLM
      let response = ''
      
      await new Promise<void>((resolve, reject) => {
        const unsubStream = window.electronAPI.onLLMStream((chunk) => {
          if (chunk.type === 'text' && chunk.content) {
            response += chunk.content
          }
        })

        const unsubError = window.electronAPI.onLLMError((err) => {
          unsubStream()
          unsubError()
          unsubDone()
          reject(new Error(err.message))
        })

        const unsubDone = window.electronAPI.onLLMDone(() => {
          unsubStream()
          unsubError()
          unsubDone()
          resolve()
        })

        window.electronAPI.sendMessage({
          config: llmConfig,
          messages: [{ role: 'user', content: instructions }],
          systemPrompt,
        }).catch(reject)
      })

      // 解析响应
      const edits = composerService.parseComposerResponse(response, context.files)
      
      if (edits.length === 0) {
        setError('No file edits were generated. Please try rephrasing your instructions.')
        return
      }

      // 创建计划
      const newPlan = composerService.createPlan(instructions, edits)
      setPlan(newPlan)
      
      // 默认展开所有编辑
      setExpandedEdits(new Set(edits.map(e => e.filePath)))

    } catch (e) {
      setError((e as Error).message)
    } finally {
      setIsProcessing(false)
    }
  }, [selectedFiles, instructions, llmConfig])

  // 应用计划
  const handleApplyPlan = useCallback(async () => {
    if (!plan) return

    setIsProcessing(true)
    const result = await composerService.applyPlan(plan)
    setIsProcessing(false)

    if (result.success) {
      // 打开修改的文件
      for (const edit of plan.edits) {
        const content = await window.electronAPI.readFile(edit.filePath)
        if (content !== null) {
          openFile(edit.filePath, content, edit.originalContent)
        }
      }
      if (plan.edits.length > 0) {
        setActiveFile(plan.edits[0].filePath)
      }
      onClose()
    } else {
      setError(`Failed to apply some changes:\n${result.errors.join('\n')}`)
    }
  }, [plan, openFile, setActiveFile, onClose])

  // 切换编辑展开状态
  const toggleEditExpanded = useCallback((filePath: string) => {
    setExpandedEdits((prev: Set<string>) => {
      const next = new Set(prev)
      if (next.has(filePath)) {
        next.delete(filePath)
      } else {
        next.add(filePath)
      }
      return next
    })
  }, [])

  // 预览单个文件
  const handlePreviewFile = useCallback(async (edit: ComposerEdit) => {
    openFile(edit.filePath, edit.newContent, edit.originalContent)
    setActiveFile(edit.filePath)
  }, [openFile, setActiveFile])

  const getFileName = (path: string) => path.split(/[\\/]/).pop() || path

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[800px] max-h-[80vh] bg-background/95 backdrop-blur-xl border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden ring-1 ring-white/10">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-gradient-to-r from-surface to-background">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-text-primary">Composer</h2>
              <p className="text-xs text-text-muted">Multi-file AI editing</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-surface-hover transition-colors"
          >
            <X className="w-4 h-4 text-text-muted" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* File Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-text-primary">Files to Edit</label>
              <button
                onClick={handleAddFile}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-surface hover:bg-surface-hover border border-border-subtle rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Files
              </button>
            </div>
            
            {selectedFiles.length === 0 ? (
              <div className="p-4 border border-dashed border-border-subtle rounded-lg text-center text-text-muted text-sm">
                No files selected. Click "Add Files" to get started.
              </div>
            ) : (
              <div className="space-y-1.5">
                {selectedFiles.map(file => (
                  <div
                    key={file}
                    className="flex items-center justify-between px-3 py-2 bg-surface rounded-lg border border-border-subtle group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileCode className="w-4 h-4 text-accent flex-shrink-0" />
                      <span className="text-sm text-text-primary truncate">{getFileName(file)}</span>
                      <span className="text-xs text-text-muted truncate hidden group-hover:block">{file}</span>
                    </div>
                    <button
                      onClick={() => handleRemoveFile(file)}
                      className="p-1 rounded hover:bg-surface-active opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3.5 h-3.5 text-text-muted" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Related Files */}
            {relatedFiles.length > 0 && (
              <div className="mt-3">
                <div className="flex items-center gap-2 mb-2">
                  <FolderTree className="w-3.5 h-3.5 text-text-muted" />
                  <span className="text-xs text-text-muted">Related files (click to add)</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {relatedFiles.map(file => (
                    <button
                      key={file}
                      onClick={() => handleAddRelatedFile(file)}
                      className="px-2 py-1 text-xs bg-surface-hover hover:bg-accent/10 hover:text-accent border border-border-subtle rounded transition-colors"
                    >
                      {getFileName(file)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Instructions */}
          <div>
            <label className="text-sm font-medium text-text-primary mb-2 block">Instructions</label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Describe what changes you want to make across these files..."
              className="w-full h-24 px-3 py-2 bg-surface border border-border-subtle rounded-lg text-sm text-text-primary placeholder-text-muted resize-none focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-status-error/10 border border-status-error/20 rounded-lg text-sm text-status-error">
              {error}
            </div>
          )}

          {/* Plan Preview */}
          {plan && (
            <div className="border border-border-subtle rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-surface border-b border-border-subtle">
                <h3 className="text-sm font-medium text-text-primary">Edit Plan</h3>
                <p className="text-xs text-text-muted mt-0.5">{plan.edits.length} file(s) will be modified</p>
              </div>
              
              <div className="divide-y divide-border-subtle">
                {plan.edits.map((edit) => (
                  <div key={edit.filePath} className="bg-background">
                    <button
                      onClick={() => toggleEditExpanded(edit.filePath)}
                      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-surface-hover transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {expandedEdits.has(edit.filePath) ? (
                          <ChevronDown className="w-4 h-4 text-text-muted" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-text-muted" />
                        )}
                        <FileCode className="w-4 h-4 text-accent" />
                        <span className="text-sm text-text-primary">{getFileName(edit.filePath)}</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handlePreviewFile(edit)
                        }}
                        className="text-xs text-accent hover:underline"
                      >
                        Preview
                      </button>
                    </button>
                    
                    {expandedEdits.has(edit.filePath) && (
                      <div className="px-4 pb-3">
                        <pre className="p-3 bg-[#0d0d0d] rounded-lg text-xs text-text-secondary overflow-x-auto max-h-48 custom-scrollbar">
                          {edit.newContent.slice(0, 2000)}
                          {edit.newContent.length > 2000 && '\n... (truncated)'}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-border bg-surface/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-text-muted hover:text-text-primary transition-colors"
          >
            Cancel
          </button>
          
          {!plan ? (
            <button
              onClick={handleGenerate}
              disabled={selectedFiles.length === 0 || !instructions.trim() || isProcessing}
              className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Plan
                </>
              )}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPlan(null)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm text-text-muted hover:text-text-primary border border-border-subtle rounded-lg transition-colors"
              >
                <XCircle className="w-4 h-4" />
                Discard
              </button>
              <button
                onClick={handleApplyPlan}
                disabled={isProcessing}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Applying...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Apply All
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
