import type { List, Task, TaskCompletion, TaskPatch } from './tasks'

export interface AppSettings {
  closeToTray: boolean
  autoStart: boolean
  notificationsEnabled: boolean
  dateOnlyReminderTime: string
}

export interface AppApi {
  getAppVersion(): Promise<string>
  listLists(): Promise<List[]>
  createList(name: string): Promise<List>
  renameList(id: string, name: string): Promise<List>
  deleteList(id: string): Promise<void>
  listTasks(listId: string): Promise<Task[]>
  createTask(listId: string, title: string): Promise<Task>
  updateTask(id: string, patch: TaskPatch): Promise<Task>
  deleteTask(id: string): Promise<void>
  reorderTasks(listId: string, orderedTaskIds: string[]): Promise<Task[]>
  moveTaskToList(taskId: string, targetListId: string): Promise<Task>
  completeTask(taskId: string): Promise<Task | null>
  undoLatestCompletion(taskId: string): Promise<Task>
  listCompletions(taskId: string): Promise<TaskCompletion[]>
  getSettings(): Promise<AppSettings>
  updateSettings(patch: Partial<AppSettings>): Promise<AppSettings>
  onSelectTask(callback: (taskId: string) => void): () => void
}

declare global {
  interface Window {
    appApi: AppApi
  }
}

export {}
