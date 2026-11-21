import { ipcMain } from 'electron'
import type { WidgetWindowController } from './widget-window-controller'
import type { WindowController } from './window-controller'

export function registerWidgetIpc(
  widget: WidgetWindowController,
  mainWindow: WindowController,
): void {
  ipcMain.handle('widget:get-presentation', () => widget.presentation)
  ipcMain.handle('widget:set-task-count', (_event, count) => {
    if (typeof count !== 'number' || !Number.isFinite(count)) {
      throw new Error('贴片任务数量无效')
    }
    widget.setTaskCount(count)
  })
  ipcMain.handle('widget:hide', () => widget.hide())
  ipcMain.handle('widget:open-main', () => mainWindow.showMainWindow())
}
