import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import type { AppApi } from '../shared/contracts'

const api: AppApi = {
  getAppVersion: () => ipcRenderer.invoke('app:get-version'),
  listLists: () => ipcRenderer.invoke('lists:list'),
  createList: name => ipcRenderer.invoke('lists:create', name),
  renameList: (id, name) => ipcRenderer.invoke('lists:rename', id, name),
  deleteList: id => ipcRenderer.invoke('lists:delete', id),
  listTasks: listId => ipcRenderer.invoke('tasks:list', listId),
  createTask: (listId, title) => ipcRenderer.invoke('tasks:create', listId, title),
  updateTask: (id, patch) => ipcRenderer.invoke('tasks:update', id, patch),
  deleteTask: id => ipcRenderer.invoke('tasks:delete', id),
  reorderTasks: (listId, orderedTaskIds) => ipcRenderer.invoke('tasks:reorder', listId, orderedTaskIds),
  moveTaskToList: (taskId, targetListId) => ipcRenderer.invoke('tasks:move', taskId, targetListId),
  completeTask: taskId => ipcRenderer.invoke('tasks:complete', taskId),
  undoLatestCompletion: taskId => ipcRenderer.invoke('tasks:undo-completion', taskId),
  listCompletions: taskId => ipcRenderer.invoke('tasks:completions', taskId),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: patch => ipcRenderer.invoke('settings:update', patch),
  exportBackup: () => ipcRenderer.invoke('backup:export'),
  previewBackup: () => ipcRenderer.invoke('backup:preview'),
  replaceFromBackup: () => ipcRenderer.invoke('backup:replace'),
  getWidgetPresentation: () => ipcRenderer.invoke('widget:get-presentation'),
  setWidgetTaskCount: count => ipcRenderer.invoke('widget:set-task-count', count),
  setWidgetWidth: width => ipcRenderer.invoke('widget:set-width', width),
  hideWidget: () => ipcRenderer.invoke('widget:hide'),
  openMainWindow: () => ipcRenderer.invoke('widget:open-main'),
  getWidgetSelectedList: () => ipcRenderer.invoke('widget:get-selected-list'),
  setWidgetSelectedList: listId => ipcRenderer.invoke('widget:set-selected-list', listId),
  onTasksChanged: callback => {
    const listener = (): void => callback()
    ipcRenderer.on('tasks:changed', listener)
    return () => ipcRenderer.removeListener('tasks:changed', listener)
  },
  onSelectTask: callback => {
    const listener = (_event: IpcRendererEvent, taskId: string): void => callback(taskId)
    ipcRenderer.on('tasks:select', listener)
    return () => ipcRenderer.removeListener('tasks:select', listener)
  },
}

contextBridge.exposeInMainWorld('appApi', api)
