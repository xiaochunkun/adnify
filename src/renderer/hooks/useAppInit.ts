/**
 * 应用初始化 Hook
 */
import { useEffect, useRef, useCallback } from 'react'
import { api } from '@renderer/services/electronAPI'
import { initializeApp, registerSettingsSync } from '@renderer/services/initService'
import { initWorkspaceStateSync } from '@renderer/services/workspaceStateService'

interface InitResult {
  shouldShowOnboarding: boolean
}

interface UseAppInitOptions {
  onInitialized?: (result: InitResult) => void
}

export function useAppInit(options: UseAppInitOptions = {}) {
  const initRef = useRef(false)

  const updateLoaderStatus = useCallback((status: string) => {
    const statusEl = document.querySelector('#initial-loader .loader-status')
    if (statusEl) statusEl.textContent = status
  }, [])

  const removeInitialLoader = useCallback(() => {
    const loader = document.getElementById('initial-loader')
    const root = document.getElementById('root')

    if (root) root.classList.add('ready')

    if (loader) {
      requestAnimationFrame(() => {
        loader.classList.add('fade-out')
        setTimeout(() => loader.remove(), 300)
      })
    }
  }, [])

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true

    const init = async () => {
      const result = await initializeApp(updateLoaderStatus)

      // 注册设置同步
      const unsubscribe = registerSettingsSync()
      window.__settingsUnsubscribe = unsubscribe

      // 短暂延迟后完成初始化
      setTimeout(() => {
        removeInitialLoader()
        api.appReady()
        options.onInitialized?.(result)
      }, 50)
    }

    init()

    return () => {
      const unsubscribe = window.__settingsUnsubscribe
      if (unsubscribe) {
        unsubscribe()
        delete window.__settingsUnsubscribe
      }
    }
  }, [updateLoaderStatus, removeInitialLoader, options])

  // 初始化工作区状态同步
  useEffect(() => {
    return initWorkspaceStateSync()
  }, [])
}
