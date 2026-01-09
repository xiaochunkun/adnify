/**
 * LSP 集成 Hook
 */
import { useEffect, useCallback } from 'react'
import { useStore } from '@store'
import { logger } from '@utils/Logger'
import {
  startLspServer,
  didOpenDocument,
  goToDefinition,
  lspUriToPath,
  onDiagnostics,
} from '@services/lspService'
import { registerLspProviders } from '@services/lspProviders'
import { pathLinkService } from '@services/pathLinkService'
import type { editor } from 'monaco-editor'

const SUPPORTED_LANGUAGES = [
  'typescript', 'typescriptreact', 'javascript', 'javascriptreact',
  'html', 'htm', 'vue', 'svelte',
  'css', 'scss', 'less',
  'markdown'
]

export function useLspIntegration() {
  const workspacePath = useStore((state) => state.workspacePath)
  const isLspReady = useStore((state) => state.isLspReady)
  const setIsLspReady = useStore((state) => state.setIsLspReady)

  // 启动 LSP 服务器
  useEffect(() => {
    if (workspacePath && !isLspReady) {
      logger.ui.info('[LSP] Starting server for workspace:', workspacePath)
      startLspServer(workspacePath).then((success) => {
        if (success) {
          logger.ui.info('[LSP] Server started successfully')
          setIsLspReady(true)
        } else {
          logger.ui.warn('[LSP] Server failed to start')
        }
      })
    }
  }, [workspacePath, isLspReady, setIsLspReady])

  // 注册 LSP 提供者到 Monaco
  const registerProviders = useCallback((monaco: typeof import('monaco-editor')) => {
    registerLspProviders(monaco)

    // 注册定义提供者
    monaco.languages.registerDefinitionProvider(
      ['typescript', 'typescriptreact', 'javascript', 'javascriptreact'],
      {
        provideDefinition: async (model, position) => {
          try {
            const filePath = model.uri.fsPath || lspUriToPath(model.uri.toString())
            const result = await goToDefinition(
              filePath,
              position.lineNumber - 1,
              position.column - 1
            )

            if (!result) return null

            const locations = Array.isArray(result) ? result : [result]
            if (locations.length === 0) return null

            return locations
              .filter((loc: any) => loc && (loc.uri || loc.targetUri))
              .map((loc: any) => {
                const uri = loc.uri || loc.targetUri
                const range = loc.range || loc.targetSelectionRange || loc.targetRange

                if (!uri || !range || !range.start) return null

                return {
                  uri: monaco.Uri.parse(uri),
                  range: {
                    startLineNumber: range.start.line + 1,
                    startColumn: range.start.character + 1,
                    endLineNumber: range.end.line + 1,
                    endColumn: range.end.character + 1,
                  },
                }
              })
              .filter(Boolean) as import('monaco-editor').languages.Location[]
          } catch (error) {
            logger.ui.error('[LSP] Definition provider error:', error)
            return null
          }
        },
      }
    )

    // 注册路径链接提供者
    monaco.languages.registerLinkProvider(SUPPORTED_LANGUAGES, pathLinkService.createLinkProvider())
  }, [])

  // 设置诊断监听
  const setupDiagnostics = useCallback((monaco: typeof import('monaco-editor')) => {
    return onDiagnostics((uri, diagnostics) => {
      const model = monaco.editor.getModels().find(m => m.uri.toString() === uri)
      if (model) {
        const markers = diagnostics.map(d => ({
          severity: d.severity === 1 ? monaco.MarkerSeverity.Error
            : d.severity === 2 ? monaco.MarkerSeverity.Warning
              : d.severity === 3 ? monaco.MarkerSeverity.Info
                : monaco.MarkerSeverity.Hint,
          message: d.message,
          startLineNumber: d.range.start.line + 1,
          startColumn: d.range.start.character + 1,
          endLineNumber: d.range.end.line + 1,
          endColumn: d.range.end.character + 1,
          source: d.source,
          code: d.code?.toString(),
        }))
        monaco.editor.setModelMarkers(model, 'lsp', markers)
      }
    })
  }, [])

  // 设置 Ctrl+Click 链接跳转
  const setupLinkNavigation = useCallback((editor: editor.IStandaloneCodeEditor) => {
    editor.onMouseDown((e) => {
      if (!e.event.ctrlKey && !e.event.metaKey) return

      const model = editor.getModel()
      if (!model) return

      const position = e.target.position
      if (!position) return

      const language = model.getLanguageId()
      const content = model.getValue()

      const linkPath = pathLinkService.getLinkAtPosition(content, language, position.lineNumber, position.column)
      if (linkPath) {
        const { activeFilePath } = useStore.getState()
        if (activeFilePath) {
          e.event.preventDefault()
          e.event.stopPropagation()
          pathLinkService.handlePathClick(linkPath, activeFilePath)
        }
      }
    })
  }, [])

  // 通知 LSP 文件已打开
  const notifyFileOpened = useCallback((filePath: string, content: string) => {
    if (isLspReady) {
      didOpenDocument(filePath, content)
    }
  }, [isLspReady])

  return {
    isLspReady,
    registerProviders,
    setupDiagnostics,
    setupLinkNavigation,
    notifyFileOpened,
  }
}
