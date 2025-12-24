/**
 * Request Body Editor
 * 完整请求体编辑器 - 支持查看和修改 API 请求参数
 */

import { useState, useEffect, useCallback } from 'react'
import { Code2, RotateCcw, AlertTriangle, Check } from 'lucide-react'

// 默认请求体模板
const DEFAULT_REQUEST_BODY = {
    model: '{{model}}',      // 会被实际模型名替换
    max_tokens: 8192,
    stream: true,
    temperature: 0.7,
    // 以下为可选参数
    // top_p: 0.9,
    // presence_penalty: 0,
    // frequency_penalty: 0,
}

// 不同厂商的默认参数
const PROVIDER_DEFAULTS: Record<string, Record<string, unknown>> = {
    openai: {
        model: '{{model}}',
        max_tokens: 8192,
        stream: true,
        temperature: 0.7,
    },
    anthropic: {
        model: '{{model}}',
        max_tokens: 8192,
        stream: true,
    },
    deepseek: {
        model: '{{model}}',
        max_tokens: 8192,
        stream: true,
        temperature: 0.7,
        // reasoning_effort: 'medium',  // 仅 R1 模型
    },
    gemini: {
        model: '{{model}}',
        maxOutputTokens: 8192,
        // Gemini 使用不同的参数名
    },
    ollama: {
        model: '{{model}}',
        stream: true,
        options: {
            num_predict: 8192,
            temperature: 0.7,
        }
    }
}

interface RequestBodyEditorProps {
    providerId: string
    requestBody?: Record<string, unknown>
    onChange: (body: Record<string, unknown>) => void
    language: 'en' | 'zh'
}

export default function RequestBodyEditor({
    providerId,
    requestBody,
    onChange,
    language
}: RequestBodyEditorProps) {
    const [jsonText, setJsonText] = useState('')
    const [parseError, setParseError] = useState<string | null>(null)
    const [saved, setSaved] = useState(false)

    // 初始化或 provider 变更时，重置为对应的默认值
    useEffect(() => {
        const defaultBody = PROVIDER_DEFAULTS[providerId] || DEFAULT_REQUEST_BODY
        const initialBody = requestBody || defaultBody
        setJsonText(JSON.stringify(initialBody, null, 2))
        setParseError(null)
    }, [providerId])

    // 当外部 requestBody 变更时同步
    useEffect(() => {
        if (requestBody) {
            setJsonText(JSON.stringify(requestBody, null, 2))
        }
    }, [requestBody])

    // 处理文本变更
    const handleTextChange = useCallback((text: string) => {
        setJsonText(text)
        setSaved(false)

        try {
            const parsed = JSON.parse(text)
            setParseError(null)
            onChange(parsed)
            setSaved(true)
            setTimeout(() => setSaved(false), 1500)
        } catch (e: any) {
            setParseError(e.message)
        }
    }, [onChange])

    // 重置为默认值
    const handleReset = useCallback(() => {
        const defaultBody = PROVIDER_DEFAULTS[providerId] || DEFAULT_REQUEST_BODY
        const text = JSON.stringify(defaultBody, null, 2)
        setJsonText(text)
        setParseError(null)
        onChange(defaultBody)
    }, [providerId, onChange])

    return (
        <div className="space-y-3">
            {/* 标题栏 */}
            <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs font-medium text-text-secondary">
                    <Code2 className="w-3.5 h-3.5" />
                    {language === 'zh' ? '请求体配置' : 'Request Body'}
                </label>
                <div className="flex items-center gap-2">
                    {saved && (
                        <span className="flex items-center gap-1 text-[10px] text-green-500">
                            <Check className="w-3 h-3" />
                            {language === 'zh' ? '已保存' : 'Saved'}
                        </span>
                    )}
                    <button
                        onClick={handleReset}
                        className="flex items-center gap-1 px-2 py-1 text-[10px] text-text-muted hover:text-text-primary transition-colors rounded hover:bg-surface/50"
                        title={language === 'zh' ? '重置为默认' : 'Reset to default'}
                    >
                        <RotateCcw className="w-3 h-3" />
                        {language === 'zh' ? '重置' : 'Reset'}
                    </button>
                </div>
            </div>

            {/* 说明 */}
            <p className="text-[10px] text-text-muted">
                {language === 'zh'
                    ? '编辑发送给 API 的请求体。`{{model}}` 会被替换为实际模型名。'
                    : 'Edit the request body sent to API. `{{model}}` will be replaced with actual model name.'}
            </p>

            {/* JSON 编辑器 */}
            <div className="relative">
                <textarea
                    value={jsonText}
                    onChange={(e) => handleTextChange(e.target.value)}
                    className={`
                        w-full px-3 py-2 text-xs font-mono leading-5
                        bg-surface/50 border rounded-lg text-text-primary 
                        focus:outline-none resize-none
                        ${parseError
                            ? 'border-red-500/50 focus:border-red-500'
                            : 'border-border-subtle focus:border-accent'}
                    `}
                    rows={10}
                    spellCheck={false}
                />

                {/* 错误提示 */}
                {parseError && (
                    <div className="absolute bottom-2 left-2 right-2 flex items-center gap-1.5 px-2 py-1 text-[10px] text-red-400 bg-red-500/10 rounded">
                        <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">JSON Error: {parseError}</span>
                    </div>
                )}
            </div>

            {/* 常用字段提示 */}
            <div className="text-[10px] text-text-muted space-y-1">
                <div className="font-medium">{language === 'zh' ? '常用字段：' : 'Common fields:'}</div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 pl-2">
                    <code className="text-accent/70">temperature</code>
                    <code className="text-accent/70">top_p</code>
                    <code className="text-accent/70">max_tokens</code>
                    <code className="text-accent/70">presence_penalty</code>
                    <code className="text-accent/70">frequency_penalty</code>
                </div>
            </div>
        </div>
    )
}
