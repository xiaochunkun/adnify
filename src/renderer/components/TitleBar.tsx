import { Minus, Square, X, Settings, Sparkles } from 'lucide-react'
import { useStore } from '../store'
import { t } from '../i18n'

export default function TitleBar() {
  const { setShowSettings, language } = useStore()

  return (
    <div className="h-12 bg-editor-sidebar border-b border-editor-border flex items-center justify-between px-4 drag-region">
      {/* Logo */}
      <div className="flex items-center gap-3 no-drag">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <span className="font-semibold text-lg gradient-text">{t('app.name', language)}</span>
      </div>

      {/* Center - can add tabs or breadcrumb here */}
      <div className="flex-1" />

      {/* Controls */}
      <div className="flex items-center gap-2 no-drag">
        <button
          onClick={() => setShowSettings(true)}
          className="p-2 rounded-lg hover:bg-editor-hover transition-colors"
          title={t('settings', language)}
        >
          <Settings className="w-4 h-4 text-editor-text-muted" />
        </button>

        <div className="w-px h-6 bg-editor-border mx-2" />

        <button
          onClick={() => window.electronAPI.minimize()}
          className="p-2 rounded-lg hover:bg-editor-hover transition-colors"
        >
          <Minus className="w-4 h-4 text-editor-text-muted" />
        </button>
        <button
          onClick={() => window.electronAPI.maximize()}
          className="p-2 rounded-lg hover:bg-editor-hover transition-colors"
        >
          <Square className="w-3.5 h-3.5 text-editor-text-muted" />
        </button>
        <button
          onClick={() => window.electronAPI.close()}
          className="p-2 rounded-lg hover:bg-red-500/20 transition-colors group"
        >
          <X className="w-4 h-4 text-editor-text-muted group-hover:text-red-400" />
        </button>
      </div>
    </div>
  )
}
