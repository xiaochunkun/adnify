/**
 * 工具调用日志内容组件
 * 用于在 BottomBarPopover 中显示
 */

import { useState } from 'react'
import { Trash2, Download, Copy, Check, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from './ui'
import { JsonHighlight } from '@/renderer/utils/jsonHighlight'
import { useStore } from '@/renderer/store'

interface ToolCallLogContentProps {
    language?: 'en' | 'zh'
}

export default function ToolCallLogContent({ language = 'zh' }: ToolCallLogContentProps) {
    const { toolCallLogs: logs, clearToolCallLogs } = useStore()
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
    const [filter, setFilter] = useState<'all' | 'request' | 'response'>('all')
    const [copiedId, setCopiedId] = useState<string | null>(null)

    const toggleExpand = (id: string) => {
        const newExpanded = new Set(expandedIds)
        if (newExpanded.has(id)) {
            newExpanded.delete(id)
        } else {
            newExpanded.add(id)
        }
        setExpandedIds(newExpanded)
    }

    const handleCopy = async (id: string, data: unknown) => {
        await navigator.clipboard.writeText(JSON.stringify(data, null, 2))
        setCopiedId(id)
        setTimeout(() => setCopiedId(null), 2000)
    }

    const handleExport = () => {
        const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `tool-logs-${new Date().toISOString().slice(0, 10)}.json`
        a.click()
        URL.revokeObjectURL(url)
    }

    const filteredLogs = filter === 'all' ? logs : logs.filter(log => log.type === filter)

    return (
        <div className="h-full flex flex-col">
            {/* 工具栏 */}
            <div className="flex items-center gap-2 px-2 py-1.5 border-b border-border-subtle bg-surface/30">
                <select
                    value={filter}
                    onChange={e => setFilter(e.target.value as 'all' | 'request' | 'response')}
                    className="px-1.5 py-0.5 text-[10px] bg-surface border border-border-subtle rounded text-text-secondary outline-none focus:border-accent/50"
                >
                    <option value="all">{language === 'zh' ? '全部' : 'All'}</option>
                    <option value="request">{language === 'zh' ? '请求' : 'Req'}</option>
                    <option value="response">{language === 'zh' ? '响应' : 'Res'}</option>
                </select>
                <div className="flex-1" />
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleExport}
                    className="h-6 px-1.5 text-[10px] gap-1 text-text-muted hover:text-text-primary"
                    title={language === 'zh' ? '导出日志' : 'Export Logs'}
                >
                    <Download className="w-3 h-3" />
                    <span className="hidden sm:inline">{language === 'zh' ? '导出' : 'Export'}</span>
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearToolCallLogs}
                    className="h-6 px-1.5 text-[10px] gap-1 text-text-muted hover:text-red-400 hover:bg-red-500/10"
                    title={language === 'zh' ? '清除日志' : 'Clear Logs'}
                >
                    <Trash2 className="w-3 h-3" />
                    <span className="hidden sm:inline">{language === 'zh' ? '清除' : 'Clear'}</span>
                </Button>
            </div>

            {/* 日志列表 */}
            <div className="flex-1 overflow-auto">
                {filteredLogs.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-text-muted text-xs">
                        {language === 'zh' ? '暂无日志' : 'No logs'}
                    </div>
                ) : (
                    <div className="divide-y divide-border-subtle">
                        {filteredLogs.map(log => (
                            <div key={log.id}>
                                <button
                                    onClick={() => toggleExpand(log.id)}
                                    className="w-full flex items-center gap-1.5 px-2 py-1.5 hover:bg-surface/50 text-left"
                                >
                                    {expandedIds.has(log.id)
                                        ? <ChevronDown className="w-3 h-3 text-text-muted" />
                                        : <ChevronRight className="w-3 h-3 text-text-muted" />
                                    }
                                    <span className={`px-1 py-0.5 text-[9px] rounded font-medium ${log.type === 'request' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'
                                        }`}>
                                        {log.type === 'request' ? 'REQ' : 'RES'}
                                    </span>
                                    <span className="text-[10px] font-medium text-text-primary truncate flex-1">{log.toolName}</span>
                                    {log.duration && <span className="text-[9px] text-text-muted">{log.duration}ms</span>}
                                </button>

                                {expandedIds.has(log.id) && (
                                    <div className="relative px-2 pb-2">
                                        <button
                                            onClick={() => handleCopy(log.id, log.data)}
                                            className="absolute top-1 right-2 p-0.5 hover:bg-surface rounded"
                                        >
                                            {copiedId === log.id
                                                ? <Check className="w-3 h-3 text-green-400" />
                                                : <Copy className="w-3 h-3 text-text-muted" />
                                            }
                                        </button>
                                        <div className="bg-surface/50 rounded p-1.5 overflow-auto max-h-32">
                                            <JsonHighlight data={log.data} maxHeight="max-h-28" />
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
