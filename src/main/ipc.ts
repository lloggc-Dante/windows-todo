import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import type Database from 'better-sqlite3'
import { join } from 'node:path'
import { exportBackup, previewBackup, replaceFromBackup } from './backup'
import type { AppSettings } from '../shared/contracts'
import type { TaskPatch } from '../shared/tasks'
import type { TaskStore } from './db/task-store'
import type { ReminderScheduler } from './reminder-scheduler'
import type { WindowsIntegration } from './windows-integration'

function stringValue(value: unknown, name: string): string {
  if (typeof value !== 'string') throw new Error(`${name}必须是字符串`)
  return value
}

function taskPatch(value: unknown): TaskPatch {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('任务更新格式无效')
  }
  const patch: TaskPatch = {}
  for (const [key, entry] of Object.entries(value)) {
    switch (key) {
      case 'title':
        patch.title = stringValue(entry, '标题')
        break
      case 'notes':
      case 'dueLocal':
      case 'recurrenceRule':
        if (entry !== null && typeof entry !== 'string') throw new Error(`${key}格式无效`)
        patch[key] = entry
        break
      case 'dueHasTime':
        if (typeof entry !== 'boolean') throw new Error('dueHasTime格式无效')
        patch.dueHasTime = entry
        break
      case 'reminderOffsetMinutes':
        if (entry !== null && (typeof entry !== 'number' || !Number.isFinite(entry))) {
          throw new Error('提醒偏移格式无效')
        }
        patch.reminderOffsetMinutes = entry
        break
      default:
        throw new Error('任务更新包含未知字段')
    }
  }
  return patch
}

function broadcastTasksChanged(): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('tasks:changed')
  }
}

export function registerTaskIpc(
  db: Database.Database,
  store: TaskStore,
  scheduler: ReminderScheduler,
  integration: WindowsIntegration,
  window: BrowserWindow,
  broadcast: () => void = broadcastTasksChanged,
): void {
  let pendingBackupPath: string | null = null
  const changed = async <T>(operation: () => T): Promise<T> => {
    const result = operation()
    broadcast()
    await scheduler.reschedule()
    return result
  }

  ipcMain.handle('lists:list', () => store.listLists())
  ipcMain.handle('lists:create', (_event, name) =>
    changed(() => store.createList(stringValue(name, '清单名称'))))
  ipcMain.handle('lists:rename', (_event, id, name) =>
    changed(() => store.renameList(stringValue(id, '清单ID'), stringValue(name, '清单名称'))))
  ipcMain.handle('lists:delete', (_event, id) =>
    changed(() => store.deleteList(stringValue(id, '清单ID'))))
  ipcMain.handle('tasks:list', (_event, listId) => store.listTasks(stringValue(listId, '清单ID')))
  ipcMain.handle('tasks:create', (_event, listId, title) =>
    changed(() => store.createTask(stringValue(listId, '清单ID'), stringValue(title, '标题'))))
  ipcMain.handle('tasks:update', (_event, id, patch) =>
    changed(() => store.updateTask(stringValue(id, '任务ID'), taskPatch(patch))))
  ipcMain.handle('tasks:delete', (_event, id) =>
    changed(() => store.deleteTask(stringValue(id, '任务ID'))))
  ipcMain.handle('tasks:reorder', (_event, listId, ids) => {
    if (!Array.isArray(ids) || ids.some(id => typeof id !== 'string')) {
      throw new Error('任务顺序格式无效')
    }
    return changed(() => store.reorderTasks(stringValue(listId, '清单ID'), ids))
  })
  ipcMain.handle('tasks:move', (_event, taskId, listId) =>
    changed(() => store.moveTaskToList(
      stringValue(taskId, '任务ID'),
      stringValue(listId, '清单ID'),
    )))
  ipcMain.handle('tasks:complete', (_event, taskId) =>
    changed(() => store.completeTask(stringValue(taskId, '任务ID'), new Date())))
  ipcMain.handle('tasks:undo-completion', (_event, taskId) =>
    changed(() => store.undoLatestCompletion(stringValue(taskId, '任务ID'))))
  ipcMain.handle('tasks:completions', (_event, taskId) =>
    store.listCompletions(stringValue(taskId, '任务ID')))

  ipcMain.handle('backup:export', async () => {
    const result = await dialog.showSaveDialog(window, {
      title: '导出轻待办备份',
      defaultPath: join(app.getPath('documents'), 'windows-todo-backup.json'),
      filters: [{ name: 'JSON 备份', extensions: ['json'] }],
    })
    if (result.canceled || !result.filePath) return false
    await exportBackup(db, result.filePath)
    return true
  })
  ipcMain.handle('backup:preview', async () => {
    const result = await dialog.showOpenDialog(window, {
      title: '选择轻待办备份',
      properties: ['openFile'],
      filters: [{ name: 'JSON 备份', extensions: ['json'] }],
    })
    if (result.canceled || !result.filePaths[0]) return null
    pendingBackupPath = result.filePaths[0]
    return previewBackup(db, pendingBackupPath)
  })
  ipcMain.handle('backup:replace', async () => {
    if (!pendingBackupPath) throw new Error('请先选择备份文件')
    await replaceFromBackup(db, pendingBackupPath)
    pendingBackupPath = null
    integration.setCloseToTray(store.getSetting('closeToTray') !== 'false')
    integration.setAutoStart(store.getSetting('autoStart') === 'true')
    broadcast()
    await scheduler.reschedule()
  })

  ipcMain.handle('settings:get', (): AppSettings => ({
    closeToTray: store.getSetting('closeToTray') !== 'false',
    autoStart: store.getSetting('autoStart') === 'true',
    notificationsEnabled: store.getSetting('notificationsEnabled') !== 'false',
    dateOnlyReminderTime: store.getSetting('dateOnlyReminderTime') ?? '09:00',
  }))
  ipcMain.handle('settings:update', async (_event, value): Promise<AppSettings> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('设置格式无效')
    }
    const patch = value as Record<string, unknown>
    for (const [key, entry] of Object.entries(patch)) {
      if (!['closeToTray', 'autoStart', 'notificationsEnabled', 'dateOnlyReminderTime'].includes(key)) {
        throw new Error('设置包含未知字段')
      }
      if (key === 'dateOnlyReminderTime') {
        if (typeof entry !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(entry)) {
          throw new Error('默认提醒时间无效')
        }
      } else if (typeof entry !== 'boolean') {
        throw new Error(`${key}必须是布尔值`)
      }
      store.setSetting(key, String(entry))
    }
    if ('closeToTray' in patch) integration.setCloseToTray(Boolean(patch.closeToTray))
    if ('autoStart' in patch) integration.setAutoStart(Boolean(patch.autoStart))
    await scheduler.reschedule()
    return {
      closeToTray: store.getSetting('closeToTray') !== 'false',
      autoStart: store.getSetting('autoStart') === 'true',
      notificationsEnabled: store.getSetting('notificationsEnabled') !== 'false',
      dateOnlyReminderTime: store.getSetting('dateOnlyReminderTime') ?? '09:00',
    }
  })
}
