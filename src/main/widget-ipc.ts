import { ipcMain } from 'electron'
import type { WidgetWindowController } from './widget-window-controller'
import type { WindowController } from './window-controller'
import type { TaskStore } from './db/task-store'

export function registerWidgetIpc(
  widget: WidgetWindowController,
  mainWindow: WindowController,
  store: TaskStore,
): void {
  ipcMain.handle('widget:get-presentation', () => widget.presentation)
  ipcMain.handle('widget:set-task-count', (_event, count) => {
    if (typeof count !== 'number' || !Number.isFinite(count)) {
      throw new Error('贴片任务数量无效')
    }
    widget.setTaskCount(count)
  })
  ipcMain.handle('widget:set-width', (_event, width) => {
    if (typeof width !== 'number' || !Number.isFinite(width)) throw new Error('贴片宽度无效')
    widget.setWidth(width)
  })
  ipcMain.handle('widget:hide', () => widget.hide())
  ipcMain.handle('widget:open-main', () => mainWindow.showMainWindow())
  ipcMain.handle('widget:get-selected-list', () => store.getSetting('widgetSelectedList'))
  ipcMain.handle('widget:set-selected-list', (_event, listId) => {
    if (typeof listId !== 'string' || !store.listLists().some(list => list.id === listId)) {
      throw new Error('贴片清单无效')
    }
    store.setSetting('widgetSelectedList', listId)
  })
}
