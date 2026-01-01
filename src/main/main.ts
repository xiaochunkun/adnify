/**
 * Adnify Main Process
 * 重构后的主进程入口（支持多窗口和安全模块）
 * 
 * 启动优化策略：
 * 1. 窗口立即显示（show: true）+ 骨架屏
 * 2. 延迟初始化非关键模块
 * 3. 渲染进程就绪后再执行重型操作
 */

import { logger } from '@shared/utils/Logger'
import { app, BrowserWindow, shell, ipcMain } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import Store from 'electron-store'
import { SECURITY_DEFAULTS, WINDOW_DEFAULTS } from '../shared/constants'

// 延迟导入的模块引用
let registerAllHandlers: typeof import('./ipc').registerAllHandlers
let cleanupAllHandlers: typeof import('./ipc').cleanupAllHandlers
let updateLLMServiceWindow: typeof import('./ipc').updateLLMServiceWindow
let lspManager: typeof import('./lspManager').lspManager
let securityManager: typeof import('./security').securityManager
let updateWhitelist: typeof import('./security').updateWhitelist

// 移除硬编码的 SECURITY_DEFAULTS，已从 ../shared/constants 导入

// ==========================================
// Store & Path 初始化
// ==========================================

// 1. 优先初始化 bootstrapStore (存储在默认位置)
const bootstrapStore = new Store({ name: 'bootstrap' })

// Debug logging
logger.system.info('[Main] UserData Path:', app.getPath('userData'))
logger.system.info('[Main] Bootstrap Store Path:', bootstrapStore.path)
logger.system.info('[Main] Bootstrap Store Content:', bootstrapStore.store)

// 2. 检查是否有自定义配置路径
const customConfigPath = bootstrapStore.get('customConfigPath') as string | undefined
logger.system.info('[Main] Read customConfigPath:', customConfigPath)

let mainStore: Store

function initStore() {
  const options: any = { name: 'config' }

  if (customConfigPath && fs.existsSync(customConfigPath)) {
    logger.system.info('[Main] Using custom config path:', customConfigPath)
    options.cwd = customConfigPath
  } else {
    logger.system.info('[Main] Using default config path:', app.getPath('userData'))
    if (customConfigPath) {
      logger.system.info('[Main] Custom path exists?', fs.existsSync(customConfigPath))
    }
  }

  mainStore = new Store(options)
}

initStore()

// ==========================================
// 全局状态
// ==========================================

const windows = new Map<number, BrowserWindow>()
const windowWorkspaces = new Map<number, string[]>()  // 窗口ID -> 项目根路径列表
let lastActiveWindow: BrowserWindow | null = null
let isQuitting = false

function getMainWindow() {
  return lastActiveWindow || Array.from(windows.values())[0] || null
}

// 检查是否已有窗口打开了指定项目
function findWindowByWorkspace(roots: string[]): BrowserWindow | null {
  const normalizedRoots = roots.map(r => r.toLowerCase().replace(/\\/g, '/'))

  for (const [windowId, workspaceRoots] of windowWorkspaces) {
    const normalizedWindowRoots = workspaceRoots.map(r => r.toLowerCase().replace(/\\/g, '/'))

    // 检查是否有相同的根路径
    const hasMatch = normalizedRoots.some(root =>
      normalizedWindowRoots.some(wr => wr === root)
    )

    if (hasMatch) {
      const win = windows.get(windowId)
      if (win && !win.isDestroyed()) {
        return win
      }
    }
  }
  return null
}

// 设置窗口的工作区
function setWindowWorkspace(windowId: number, roots: string[]) {
  windowWorkspaces.set(windowId, roots)
  logger.system.info('[Main] Window workspace set:', windowId, roots)
}
// 清理窗口工作区
function clearWindowWorkspace(windowId: number) {
  windowWorkspaces.delete(windowId)
}
// 获取指定窗口的工作区
function getWindowWorkspace(windowId: number): string[] | null {
  return windowWorkspaces.get(windowId) || null
}

// 单例锁定
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
}

// ==========================================
// 延迟加载模块（启动优化）
// ==========================================

let modulesLoaded = false

async function loadDeferredModules() {
  if (modulesLoaded) return
  modulesLoaded = true
  
  const startTime = Date.now()
  logger.system.info('[Main] Loading deferred modules...')
  
  // 并行加载所有模块
  const [ipcModule, lspModule, securityModule] = await Promise.all([
    import('./ipc'),
    import('./lspManager'),
    import('./security'),
  ])
  
  registerAllHandlers = ipcModule.registerAllHandlers
  cleanupAllHandlers = ipcModule.cleanupAllHandlers
  updateLLMServiceWindow = ipcModule.updateLLMServiceWindow
  lspManager = lspModule.lspManager
  securityManager = securityModule.securityManager
  updateWhitelist = securityModule.updateWhitelist
  
  logger.system.info(`[Main] Deferred modules loaded in ${Date.now() - startTime}ms`)
}

// ==========================================
// 窗口创建
// ==========================================

function createWindow(isEmpty: boolean = false) {
  // 图标路径：Windows 使用 .ico，其他平台使用 .png
  // 开发环境：从项目根目录的 public 文件夹加载
  // 生产环境：从 resources 文件夹加载
  let iconPath: string
  
  if (app.isPackaged) {
    // 生产环境
    iconPath = process.platform === 'win32'
      ? path.join(process.resourcesPath, 'icon.ico')
      : path.join(process.resourcesPath, 'icon.png')
  } else {
    // 开发环境 - 使用 app.getAppPath() 获取正确的项目根目录
    const appRoot = app.getAppPath()
    iconPath = process.platform === 'win32'
      ? path.join(appRoot, 'public/icon.ico')
      : path.join(appRoot, 'public/icon.png')
  }
  
  logger.system.info('[Main] Window icon path:', iconPath, 'exists:', fs.existsSync(iconPath))

  const win = new BrowserWindow({
    width: WINDOW_DEFAULTS.WIDTH,
    height: WINDOW_DEFAULTS.HEIGHT,
    minWidth: WINDOW_DEFAULTS.MIN_WIDTH,
    minHeight: WINDOW_DEFAULTS.MIN_HEIGHT,
    frame: false,
    titleBarStyle: 'hidden',
    icon: iconPath,
    trafficLightPosition: { x: 15, y: 15 },
    backgroundColor: WINDOW_DEFAULTS.BACKGROUND_COLOR,
    show: true,  // 立即显示窗口（配合 HTML 骨架屏实现秒开）
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // 启用 V8 缓存加速
      v8CacheOptions: 'bypassHeatCheck',
    },
  })

  const windowId = win.id
  windows.set(windowId, win)
  lastActiveWindow = win

  win.on('focus', () => {
    lastActiveWindow = win
    if (updateLLMServiceWindow) {
      updateLLMServiceWindow(win)
    }
  })

  win.on('close', async (e) => {
    if (windows.size === 1 && !isQuitting) {
      // 最后一个窗口关闭时，执行全局清理
      isQuitting = true
      e.preventDefault()
      logger.system.info('[Main] Last window closing, starting cleanup...')
      try {
        if (cleanupAllHandlers) cleanupAllHandlers()
        if (lspManager) await lspManager.stopAllServers()
        logger.system.info('[Main] Cleanup completed')
      } catch (err) {
        logger.system.error('[Main] Cleanup error:', err)
      }
      win.destroy()
      app.quit()
    } else {
      // 非最后一个窗口，直接移除引用
      windows.delete(windowId)
      clearWindowWorkspace(windowId)  // 清理窗口-工作区映射
      if (lastActiveWindow === win) {
        lastActiveWindow = Array.from(windows.values())[0] || null
      }
    }
  })

  // 注册快捷键监听 (Frameless window workaround)
  win.webContents.on('before-input-event', (_, input) => {
    // Ctrl+Shift+P: Command Palette
    if ((input.control && input.shift && input.key.toLowerCase() === 'p') || input.key === 'F1') {
      if (input.type === 'keyDown') {
        // Do NOT prevent default, let it propagate to renderer as fallback
        // event.preventDefault() 
        win.webContents.send('workbench:execute-command', 'workbench.action.showCommands')
      }
    }
    // F12: Toggle DevTools
    if (input.key === 'F12' && input.type === 'keyDown') {
      // Do NOT prevent default, let it propagate to renderer as fallback
      // event.preventDefault()
      win.webContents.toggleDevTools()
    }
  })

  // 处理外部链接：在系统默认浏览器中打开
  win.webContents.setWindowOpenHandler(({ url }) => {
    // 允许 devtools 和本地开发链接在应用内打开
    if (url.startsWith('devtools://') || url.startsWith('http://localhost')) {
      return { action: 'allow' }
    }
    // 其他链接在系统浏览器中打开
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // 阻止页面内导航到外部链接
  win.webContents.on('will-navigate', (event, url) => {
    const currentUrl = win.webContents.getURL()
    // 允许本地开发服务器的导航
    if (url.startsWith('http://localhost') || url.startsWith('file://')) {
      return
    }
    // 如果是外部链接，阻止导航并在浏览器中打开
    if (url !== currentUrl) {
      event.preventDefault()
      shell.openExternal(url)
    }
  })

  // 加载页面
  const query = isEmpty ? '?empty=1' : ''
  if (!app.isPackaged) {
    win.loadURL(`http://localhost:5173${query}`)
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'), { query: isEmpty ? { empty: '1' } : undefined })
  }

  return win
}

// ==========================================
// 应用生命周期
// ==========================================

app.whenReady().then(async () => {
  // 第一阶段：立即创建窗口（秒开体验）
  const firstWin = createWindow()
  
  // 立即注册基础窗口控制 IPC（同步导入，非常快）
  const { registerWindowHandlers } = await import('./ipc/window')
  registerWindowHandlers(createWindow)
  
  // 注册最小化的 IPC（app:ready 通知）
  registerMinimalIPC()
  
  // 第二阶段：异步加载其他模块（不阻塞窗口显示）
  setImmediate(async () => {
    await loadDeferredModules()
    
    logger.system.info('[Security] 🔒 初始化安全模块...')

    const securityConfig = mainStore.get('securitySettings', {
      enablePermissionConfirm: true,
      enableAuditLog: true,
      strictWorkspaceMode: true,
      allowedShellCommands: [...SECURITY_DEFAULTS.SHELL_COMMANDS],
      allowedGitSubcommands: [...SECURITY_DEFAULTS.GIT_SUBCOMMANDS],
    }) as any

    securityManager.updateConfig(securityConfig)

    // 初始化白名单
    const shellCommands = securityConfig.allowedShellCommands || [...SECURITY_DEFAULTS.SHELL_COMMANDS]
    const gitCommands = securityConfig.allowedGitSubcommands || [...SECURITY_DEFAULTS.GIT_SUBCOMMANDS]
    updateWhitelist(shellCommands, gitCommands)

    logger.system.info('[Security] ✅ 安全模块已初始化')

    // 注册所有 IPC handlers
    registerAllHandlers({
      getMainWindow,
      createWindow,
      mainStore,
      bootstrapStore,
      setMainStore: (store) => {
        mainStore = store
      },
      // 窗口-工作区管理函数
      findWindowByWorkspace,
      setWindowWorkspace,
      getWindowWorkspace,
    })

    securityManager.setMainWindow(firstWin)

    // 创建应用菜单
    const { Menu } = require('electron')
    const template = [
      {
        label: 'File',
        submenu: [
          { role: 'quit' }
        ]
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'selectAll' }
        ]
      },
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' },
          {
            label: 'Command Palette',
            click: (_: any, focusedWindow: BrowserWindow) => {
              logger.system.info('[Main] Menu: Command Palette triggered')
              if (focusedWindow) {
                logger.system.info('[Main] Sending workbench:execute-command to renderer')
                focusedWindow.webContents.send('workbench:execute-command', 'workbench.action.showCommands')
              } else {
                logger.system.info('[Main] No focused window to send command to')
              }
            }
          }
        ]
      }
    ]
    const menu = Menu.buildFromTemplate(template)
    Menu.setApplicationMenu(menu)
    
    logger.system.info('[Main] All modules initialized')
  })
})

// 最小化 IPC 注册（窗口控制，在模块加载前就需要）
// 注意：这些 handlers 会在 registerAllHandlers 中被覆盖，但由于 ipcMain.on 允许多个监听器，
// 我们使用 ipcMain.handle 的会被后续注册覆盖（handle 只允许一个）
function registerMinimalIPC() {
  // 窗口控制 - 使用 once 风格的检查避免重复
  if (!(ipcMain as any).__minimalIPCRegistered) {
    (ipcMain as any).__minimalIPCRegistered = true
    // app:ready 监听器在 window.ts 中注册，这里不需要重复注册
  }
}

// 处理第二个实例启动（打开新窗口）
app.on('second-instance', () => {
  createWindow(false)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (windows.size === 0) {
    createWindow()
  }
})
