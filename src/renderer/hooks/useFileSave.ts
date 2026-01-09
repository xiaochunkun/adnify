/**
 * 文件保存相关 Hook
 * 统一处理保存、自动保存、关闭确认等逻辑
 */
import { useCallback, useRef, useEffect } from 'react'
import { useStore } from '@store'
import { api } from '@renderer/services/electronAPI'
import { getFileName } from '@shared/utils/pathUtils'
import { toast } from '@renderer/components/common/ToastProvider'
import { t } from '@renderer/i18n'
import { getEditorConfig } from '@renderer/config/editorConfig'

export function useFileSave() {
  const { openFiles, markFileSaved, closeFile, language } = useStore()
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null)

  // 保存单个文件
  const saveFile = useCallback(async (filePath: string): Promise<boolean> => {
    const file = openFiles.find(f => f.path === filePath)
    if (!file) return false

    try {
      const success = await api.file.write(file.path, file.content)
      if (success) {
        markFileSaved(file.path)
        toast.success(
          language === 'zh' ? '文件已保存' : 'File Saved',
          getFileName(file.path)
        )
      } else {
        toast.error(
          language === 'zh' ? '保存失败' : 'Save Failed',
          language === 'zh' ? '无法写入文件' : 'Could not write to file'
        )
      }
      return success
    } catch (error) {
      toast.error(
        language === 'zh' ? '保存失败' : 'Save Failed',
        String(error)
      )
      return false
    }
  }, [openFiles, markFileSaved, language])

  // 关闭文件（带保存提示）
  const closeFileWithConfirm = useCallback(async (filePath: string) => {
    const file = openFiles.find(f => f.path === filePath)
    if (file?.isDirty) {
      const fileName = getFileName(filePath)
      const { globalConfirm } = await import('@renderer/components/common/ConfirmDialog')
      const result = await globalConfirm({
        title: language === 'zh' ? '未保存的更改' : 'Unsaved Changes',
        message: t('confirmUnsavedChanges', language, { name: fileName }),
        confirmText: language === 'zh' ? '保存' : 'Save',
        cancelText: language === 'zh' ? '不保存' : "Don't Save",
        variant: 'warning',
      })
      if (result) {
        await saveFile(filePath)
      }
    }
    closeFile(filePath)
  }, [openFiles, closeFile, saveFile, language])

  // 关闭其他文件
  const closeOtherFiles = useCallback(async (keepPath: string) => {
    for (const file of openFiles) {
      if (file.path !== keepPath) {
        await closeFileWithConfirm(file.path)
      }
    }
  }, [openFiles, closeFileWithConfirm])

  // 关闭所有文件
  const closeAllFiles = useCallback(async () => {
    for (const file of [...openFiles]) {
      await closeFileWithConfirm(file.path)
    }
  }, [openFiles, closeFileWithConfirm])

  // 关闭右侧文件
  const closeFilesToRight = useCallback(async (filePath: string) => {
    const index = openFiles.findIndex(f => f.path === filePath)
    if (index >= 0) {
      for (let i = openFiles.length - 1; i > index; i--) {
        await closeFileWithConfirm(openFiles[i].path)
      }
    }
  }, [openFiles, closeFileWithConfirm])

  // 触发自动保存
  const triggerAutoSave = useCallback((filePath: string) => {
    const config = getEditorConfig()
    if (config.autoSave === 'off') return

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
      autoSaveTimerRef.current = null
    }

    if (config.autoSave === 'afterDelay') {
      autoSaveTimerRef.current = setTimeout(async () => {
        const file = openFiles.find(f => f.path === filePath)
        if (file?.isDirty) {
          const success = await api.file.write(file.path, file.content)
          if (success) {
            markFileSaved(file.path)
          }
        }
      }, config.autoSaveDelay)
    }
  }, [openFiles, markFileSaved])

  // 失去焦点时自动保存
  useEffect(() => {
    const config = getEditorConfig()
    if (config.autoSave !== 'onFocusChange') return

    const handleBlur = async () => {
      for (const file of openFiles) {
        if (file.isDirty) {
          const success = await api.file.write(file.path, file.content)
          if (success) {
            markFileSaved(file.path)
          }
        }
      }
    }

    window.addEventListener('blur', handleBlur)
    return () => window.removeEventListener('blur', handleBlur)
  }, [openFiles, markFileSaved])

  // 清理定时器
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
      }
    }
  }, [])

  return {
    saveFile,
    closeFileWithConfirm,
    closeOtherFiles,
    closeAllFiles,
    closeFilesToRight,
    triggerAutoSave,
  }
}
