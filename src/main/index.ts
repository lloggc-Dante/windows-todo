import { app, BrowserWindow, dialog, ipcMain, Menu, powerMonitor, screen, Tray } from 'electron'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { createDatabase } from './db/database'
import { TaskStore } from './db/task-store'
import { WindowsNotifier } from './notifier'
import { registerTaskIpc } from './ipc'
import { ReminderScheduler } from './reminder-scheduler'
import { createTrayIcon } from './tray-icon'
import { WindowController } from './window-controller'
import { appUserModelId, handleStartupFailure, WindowsIntegration } from './windows-integration'
import { NativeWidgetController } from './native-widget-controller'
import { registerWindowIpc } from './window-ipc'

app.setAppUserModelId(appUserModelId(app.isPackaged))
Menu.setApplicationMenu(null)
if (process.env.WINDOWS_TODO_TEST_DATA_DIR) {
  app.setPath('userData', process.env.WINDOWS_TODO_TEST_DATA_DIR)
}

function startApplication(): void {
  const iconPath = app.isPackaged
    ? join(process.resourcesPath, 'icon.png')
    : join(process.cwd(), 'assets', 'icon.png')
  const window = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 920,
    minHeight: 520,
    show: false,
    frame: false,
    icon: iconPath,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  const controller = new WindowController(window)
  const integration = new WindowsIntegration(app, window, controller)

  if (!integration.claimSingleInstance()) {
    window.destroy()
    return
  }

  const dataDirectory = process.env.WINDOWS_TODO_TEST_DATA_DIR ?? app.getPath('userData')
  let db: ReturnType<typeof createDatabase>
  try {
    mkdirSync(dataDirectory, { recursive: true })
    db = createDatabase(join(dataDirectory, 'tasks.db'))
  } catch (error) {
    handleStartupFailure(app, dialog, window, error)
    return
  }
  const store = new TaskStore(db)
  if (store.listLists().length === 0) store.createList('我的待办')
  const scheduler = new ReminderScheduler(db, store, new WindowsNotifier(), controller)
  const widgetExecutable = app.isPackaged
    ? join(process.resourcesPath, 'native-widget', 'LightTodo.Widget.exe')
    : join(process.cwd(), 'native-widget', 'bin', 'LightTodo.Widget.exe')
  const widget = new NativeWidgetController({
    settings: store,
    store,
    screen,
    enabled: process.platform === 'win32',
    createProcess: () => {
      const child = spawn(widgetExecutable, [], {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      })
      if (!child.stdin || !child.stdout) throw new Error('无法建立原生贴片通信')
      child.stderr?.on('data', chunk => console.error('原生贴片', chunk.toString()))
      return child
    },
    openMain: () => controller.showMainWindow(),
    broadcast: () => {
      for (const target of BrowserWindow.getAllWindows()) target.webContents.send('tasks:changed')
    },
    reschedule: () => scheduler.reschedule(),
  })
  widget.initialize()
  widget.applySettings()
  integration.setCloseToTray(store.getSetting('closeToTray') !== 'false')
  integration.setAutoStart(store.getSetting('autoStart') === 'true')
  registerTaskIpc(db, store, scheduler, integration, window, excludeSenderId => {
    for (const target of BrowserWindow.getAllWindows()) {
      if (target.webContents.id !== excludeSenderId) target.webContents.send('tasks:changed')
    }
    widget.refresh()
  }, () => {
    widget.applySettings()
    widget.refresh()
  })
  registerWindowIpc(controller)
  const checkReminders = (): void => {
    void scheduler.reconcile(new Date())
      .then(() => scheduler.reschedule())
      .catch(error => console.error('提醒核对失败', error))
  }
  powerMonitor.on('resume', checkReminders)
  const reminderInterval = setInterval(checkReminders, 60_000)
  let cleanedUp = false
  const cleanup = (): void => {
    if (cleanedUp) return
    cleanedUp = true
    clearInterval(reminderInterval)
    scheduler.stop()
    db.close()
  }
  integration.setBeforeQuit(() => {
    widget.allowQuit()
    cleanup()
  })
  app.on('will-quit', cleanup)

  const tray = new Tray(createTrayIcon(iconPath))
  tray.setToolTip('轻待办')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '打开', click: () => controller.showMainWindow() },
    { label: '退出', click: () => integration.quit() },
  ]))
  tray.on('click', () => controller.showMainWindow())

  window.on('close', event => integration.handleClose(event))
  app.on('before-quit', () => {
    integration.allowQuit()
    widget.allowQuit()
  })

  if (!process.argv.includes('--hidden')) {
    window.once('ready-to-show', () => controller.showMainWindow())
  }

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }
  void scheduler.reschedule().catch(error => console.error('提醒调度失败', error))
}

app.whenReady().then(() => {
  ipcMain.handle('app:get-version', () => app.getVersion())
  startApplication()
})

app.on('window-all-closed', () => app.quit())
