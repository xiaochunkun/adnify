/**
 * 工作流预览组件
 * 
 * 在编辑器中预览 .json 格式的工作流文件
 * 显示工作流结构和需求文档
 * 
 * 注意：工作流执行由 Agent 在 Plan 模式下自动完成，此组件仅用于查看
 */

import { useState, useEffect } from 'react'
import { FileText, GitBranch } from 'lucide-react'
import type { Workflow } from '@/renderer/plan/types/workflow'
import { api } from '@/renderer/services/electronAPI'
import { MarkdownPreview } from './FilePreview'

interface WorkflowPreviewProps {
  content: string
  filePath?: string
}

export function WorkflowPreview({ content, filePath }: WorkflowPreviewProps) {
  const [workflow, setWorkflow] = useState<Workflow | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [requirements, setRequirements] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'workflow' | 'requirements'>('workflow')

  // 解析工作流
  useEffect(() => {
    try {
      const parsed = JSON.parse(content)
      setWorkflow(parsed)
      setError(null)
      
      // 尝试加载同名的 .md 文件
      if (filePath) {
        const mdPath = filePath.replace(/\.json$/, '.md')
        loadRequirements(mdPath)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid JSON')
      setWorkflow(null)
    }
  }, [content, filePath])

  // 加载需求文档
  const loadRequirements = async (path: string) => {
    try {
      const content = await api.file.read(path)
      if (content) {
        setRequirements(content)
      }
    } catch (err) {
      console.debug('Requirements file not found:', path)
    }
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="text-red-500 text-lg mb-2">Invalid Workflow</div>
          <div className="text-sm text-text-muted">{error}</div>
        </div>
      </div>
    )
  }

  if (!workflow) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-text-muted">Loading workflow...</div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* 头部 */}
      <div className="border-b border-border p-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">{workflow.name}</h2>
            {workflow.description && (
              <p className="text-sm text-text-muted">{workflow.description}</p>
            )}
          </div>
          
          {/* 统计信息 */}
          <div className="flex items-center gap-4 text-sm text-text-muted">
            <div className="flex items-center gap-1">
              <GitBranch className="w-4 h-4" />
              <span>{workflow.nodes?.length || 0} nodes</span>
            </div>
            <div className="text-xs">v{workflow.version}</div>
          </div>
        </div>
        
        {/* 提示信息 */}
        <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <div className="text-sm text-blue-400">
            💡 <strong>Tip:</strong> This workflow will be executed automatically by the Agent in Plan mode. 
            Check the chat panel to see the execution progress.
          </div>
        </div>
        
        {/* 标签页 */}
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => setActiveTab('workflow')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'workflow'
                ? 'bg-primary text-white'
                : 'text-text-muted hover:text-text-primary hover:bg-surface-hover'
            }`}
          >
            <GitBranch className="w-4 h-4 inline mr-1" />
            Workflow
          </button>
          {requirements && (
            <button
              onClick={() => setActiveTab('requirements')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'requirements'
                  ? 'bg-primary text-white'
                  : 'text-text-muted hover:text-text-primary hover:bg-surface-hover'
              }`}
            >
              <FileText className="w-4 h-4 inline mr-1" />
              Requirements
            </button>
          )}
        </div>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'workflow' ? (
          <WorkflowStructure workflow={workflow} />
        ) : requirements ? (
          <MarkdownPreview content={requirements} />
        ) : (
          <div className="text-center text-text-muted py-8">
            No requirements document found
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * 工作流结构显示
 */
function WorkflowStructure({ workflow }: { workflow: Workflow }) {
  return (
    <div className="space-y-4">
      {/* 配置信息 */}
      <div className="bg-surface rounded-lg p-4 border border-border">
        <h3 className="text-sm font-semibold text-text-primary mb-3">Configuration</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-text-muted">Max Retries:</span>
            <span className="ml-2 text-text-primary">{workflow.config?.maxRetries || 0}</span>
          </div>
          <div>
            <span className="text-text-muted">Timeout:</span>
            <span className="ml-2 text-text-primary">{workflow.config?.timeout || 0}ms</span>
          </div>
          <div>
            <span className="text-text-muted">Continue on Error:</span>
            <span className="ml-2 text-text-primary">
              {workflow.config?.continueOnError ? 'Yes' : 'No'}
            </span>
          </div>
          <div>
            <span className="text-text-muted">Environment:</span>
            <span className="ml-2 text-text-primary">{workflow.config?.environment || 'N/A'}</span>
          </div>
        </div>
      </div>

      {/* 节点列表 */}
      <div className="bg-surface rounded-lg p-4 border border-border">
        <h3 className="text-sm font-semibold text-text-primary mb-3">
          Nodes ({workflow.nodes?.length || 0})
        </h3>
        <div className="space-y-2">
          {workflow.nodes?.map((node) => (
            <div
              key={node.id}
              className="bg-background rounded-lg p-3 border border-border hover:border-primary transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono bg-surface-hover px-2 py-0.5 rounded text-text-muted">
                      {node.type}
                    </span>
                    <span className="text-sm font-medium text-text-primary">{node.label}</span>
                  </div>
                  {node.description && (
                    <p className="text-xs text-text-muted mt-1">{node.description}</p>
                  )}
                  {node.type === 'tool' && (node.config as any).toolName && (
                    <div className="mt-2 text-xs">
                      <span className="text-text-muted">Tool:</span>
                      <span className="ml-1 font-mono text-primary">
                        {(node.config as any).toolName}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 边列表 */}
      {workflow.edges && workflow.edges.length > 0 && (
        <div className="bg-surface rounded-lg p-4 border border-border">
          <h3 className="text-sm font-semibold text-text-primary mb-3">
            Edges ({workflow.edges.length})
          </h3>
          <div className="space-y-1 text-sm">
            {workflow.edges.map((edge) => {
              const sourceNode = workflow.nodes?.find(n => n.id === edge.source)
              const targetNode = workflow.nodes?.find(n => n.id === edge.target)
              
              return (
                <div key={edge.id} className="flex items-center gap-2 text-text-muted">
                  <span className="font-mono text-xs">{sourceNode?.label || edge.source}</span>
                  <span>→</span>
                  <span className="font-mono text-xs">{targetNode?.label || edge.target}</span>
                  {edge.condition && (
                    <span className="text-xs bg-surface-hover px-2 py-0.5 rounded">
                      if: {edge.condition}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
