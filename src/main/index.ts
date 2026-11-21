import { app, BrowserWindow, dialog, ipcMain, Menu, powerMonitor, screen, Tray } from 'electron'
import { mkdirSync } from 'node:fs'
import { release } from 'node:os'
import { join } from 'node:path'
import { createDatabase } from './db/database'
import { TaskStore } from './db/task-store'
import { WindowsNotifier } from './notifier'
import { registerTaskIpc } from './ipc'
import { ReminderScheduler } from './reminder-scheduler'
import { createTrayIcon } from './tray-icon'
import { WindowController } from './window-controller'
import { handleStartupFailure, WindowsIntegration } from './windows-integration'
import { WidgetWindowController } from './widget-window-controller'
import { registerWidgetIpc } from './widget-ipc'
import { resolveWidgetPresentation } from '../shared/widget'

app.setAppUserModelId('com.windows-todo.app')

function startApplication(): void {
  const window = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 920,
    minHeight: 520,
    show: false,
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
  const widget = new WidgetWindowController({
    presentation: resolveWidgetPresentation({ platform: process.platform, release: release() }),
    hidden: process.argv.includes('--hidden'),
    settings: store,
    screen,
    createWindow: options => new BrowserWindow({
      ...(options as Electron.BrowserWindowConstructorOptions),
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    }),
    loadWindow: widgetWindow => {
      const browserWindow = widgetWindow as unknown as BrowserWindow
      if (process.env.ELECTRON_RENDERER_URL) {
        void browserWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}/widget.html`)
      } else {
        void browserWindow.loadFile(join(__dirname, '../renderer/widget.html'))
      }
    },
  })
  widget.initialize()
  widget.applySettings()
  const scheduler = new ReminderScheduler(db, store, new WindowsNotifier(), controller)
  integration.setCloseToTray(store.getSetting('closeToTray') !== 'false')
  integration.setAutoStart(store.getSetting('autoStart') === 'true')
  registerTaskIpc(db, store, scheduler, integration, window)
  registerWidgetIpc(widget, controller)
  const checkReminders = (): void => {
    void scheduler.reconcile(new Date())
      .then(() => scheduler.reschedule())
      .catch(error => console.error('提醒核对失败', error))
  }
  powerMonitor.on('resume', checkReminders)
  const reminderInterval = setInterval(checkReminders, 60_000)
  app.on('will-quit', () => {
    clearInterval(reminderInterval)
    scheduler.stop()
    db.close()
  })

  const tray = new Tray(createTrayIcon())
  tray.setToolTip('轻待办')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '打开', click: () => controller.showMainWindow() },
    { label: '退出', click: () => integration.quit() },
  ]))
  tray.on('click', () => controller.showMainWindow())

  window.on('close', event => integration.handleClose(event))
  app.on('before-quit', () => integration.allowQuit())

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
