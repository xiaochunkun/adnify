/**
 * 文件变化监听 Hook
 */
import { useEffect } from 'react'
import { useStore } from '@store'
import { api } from '@renderer/services/electronAPI'
import { getFileName, pathEquals } from '@shared/utils/pathUtils'
import { removeFileFromTypeService } from '@renderer/services/monacoTypeService'

export function useFileWatcher() {
  useEffect(() => {
    const unsubscribe = api.file.onChanged(async (event: { event: string; path: string }) => {
      // 处理文件删除事件 - 清理 Monaco extraLib
      if (event.event === 'delete') {
        removeFileFromTypeService(event.path)
        return
      }

      if (event.event !== 'update') return

      const { openFiles, reloadFileFromDisk } = useStore.getState()
      const openFile = openFiles.find(f => pathEquals(f.path, event.path))

      if (!openFile) return

      const newContent = await api.file.read(event.path)
      if (newContent === null) return

      // 内容相同，不需要操作
      if (newContent === openFile.content) return

      if (openFile.isDirty) {
        // 文件有未保存更改，显示冲突提示
        const shouldReload = confirm(
          `文件 "${getFileName(event.path)}" 已被外部修改。\n\n是否重新加载？（本地更改将丢失）`
        )
        if (shouldReload) {
          reloadFileFromDisk(openFile.path, newContent)
        }
      } else {
        // 文件无更改，直接刷新
        reloadFileFromDisk(openFile.path, newContent)
      }
    })

    return unsubscribe
  }, [])
}
