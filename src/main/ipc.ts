import { ipcMain } from 'electron'
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

export function registerTaskIpc(
  store: TaskStore,
  scheduler: ReminderScheduler,
  integration: WindowsIntegration,
): void {
  const changed = async <T>(operation: () => T): Promise<T> => {
    const result = operation()
    await scheduler.reschedule()
    return result
  }

  ipcMain.handle('lists:list', () => store.listLists())
  ipcMain.handle('lists:create', (_event, name) => store.createList(stringValue(name, '清单名称')))
  ipcMain.handle('lists:rename', (_event, id, name) =>
    store.renameList(stringValue(id, '清单ID'), stringValue(name, '清单名称')))
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
    return store.reorderTasks(stringValue(listId, '清单ID'), ids)
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
