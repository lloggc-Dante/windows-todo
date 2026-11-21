import { app, BrowserWindow, ipcMain, Menu, powerMonitor, Tray } from 'electron'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { createDatabase } from './db/database'
import { TaskStore } from './db/task-store'
import { WindowsNotifier } from './notifier'
import { registerTaskIpc } from './ipc'
import { ReminderScheduler } from './reminder-scheduler'
import { createTrayIcon } from './tray-icon'
import { WindowController } from './window-controller'
import { WindowsIntegration } from './windows-integration'

app.setAppUserModelId('com.windows-todo.app')

function startApplication(): void {
  const window = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 760,
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
  mkdirSync(dataDirectory, { recursive: true })
  const db = createDatabase(join(dataDirectory, 'tasks.db'))
  const store = new TaskStore(db)
  const scheduler = new ReminderScheduler(db, store, new WindowsNotifier(), controller)
  integration.setCloseToTray(store.getSetting('closeToTray') !== 'false')
  integration.setAutoStart(store.getSetting('autoStart') === 'true')
  registerTaskIpc(db, store, scheduler, integration, window)
  const checkReminders = (): void => {
    void scheduler.reconcile(new Date()).then(() => scheduler.reschedule())
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
  void scheduler.reschedule()
}

app.whenReady().then(() => {
  ipcMain.handle('app:get-version', () => app.getVersion())
  startApplication()
})

app.on('window-all-closed', () => app.quit())
