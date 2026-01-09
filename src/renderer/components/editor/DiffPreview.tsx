/**
 * Diff 预览组件
 */
import { memo, useCallback } from 'react'
import { FileCode, X } from 'lucide-react'
import { getFileName } from '@shared/utils/pathUtils'
import { t } from '@renderer/i18n'
import { SafeDiffEditor } from './SafeDiffEditor'
import { getLanguage } from './utils/languageMap'
import type { DiffView } from '@store'

interface DiffPreviewProps {
  diff: DiffView
  isPending: boolean
  language: 'en' | 'zh'
  onClose: () => void
  onAccept?: () => void
  onReject?: () => void
}

export const DiffPreview = memo(function DiffPreview({
  diff,
  isPending,
  language,
  onClose,
  onAccept,
  onReject,
}: DiffPreviewProps) {
  const handleClose = useCallback(() => {
    setTimeout(() => onClose(), 0)
  }, [onClose])

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border-subtle bg-surface/50">
        <div className="flex items-center gap-2">
          <FileCode className="w-4 h-4 text-accent" />
          <span className="text-sm font-medium text-text-primary">
            {getFileName(diff.filePath)}
          </span>
          <span className="text-xs text-text-muted">
            {diff.original ? 'Modified' : 'New File'}
          </span>
          {isPending && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-amber-500/20 text-amber-400 rounded">
              Pending
            </span>
          )}
        </div>
        <button
          onClick={handleClose}
          className="px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text-primary hover:bg-surface-active rounded-md transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Monaco Diff Editor */}
      <div className="flex-1">
        <SafeDiffEditor
          key={`diff-${diff.filePath}-${diff.original?.length || 0}-${diff.modified?.length || 0}`}
          language={getLanguage(diff.filePath)}
          original={diff.original}
          modified={diff.modified}
          options={{
            readOnly: true,
            renderSideBySide: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 13,
            lineNumbers: 'on',
            glyphMargin: false,
            folding: true,
            lineDecorationsWidth: 0,
            lineNumbersMinChars: 3,
          }}
        />
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border-subtle bg-surface/50">
        {isPending ? (
          <>
            <button
              onClick={onReject}
              className="px-4 py-2 text-sm font-medium text-text-muted hover:text-status-error hover:bg-status-error/10 rounded-md transition-colors"
            >
              {t('rejectChanges', language)}
            </button>
            <button
              onClick={onAccept}
              className="px-4 py-2 text-sm font-medium bg-status-success text-white hover:bg-status-success/90 rounded-md transition-colors"
            >
              {t('acceptChanges', language)}
            </button>
          </>
        ) : (
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-text-muted hover:text-text-primary hover:bg-surface-active rounded-md transition-colors"
          >
            Close
          </button>
        )}
      </div>
    </div>
  )
})
