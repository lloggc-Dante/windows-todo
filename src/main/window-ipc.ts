import { ipcMain } from 'electron'
import type { WindowController } from './window-controller'

export function registerWindowIpc(controller: WindowController): void {
  ipcMain.handle('window:minimize', () => controller.minimize())
  ipcMain.handle('window:toggle-maximize', () => controller.toggleMaximize())
  ipcMain.handle('window:close', () => controller.close())
}
