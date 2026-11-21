import { app, BrowserWindow, ipcMain, Menu, Tray } from 'electron'
import { join } from 'node:path'
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
}

app.whenReady().then(() => {
  ipcMain.handle('app:get-version', () => app.getVersion())
  startApplication()
})

app.on('window-all-closed', () => app.quit())
