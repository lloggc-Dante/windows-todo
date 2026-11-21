import type { List, Task, TaskCompletion } from './tasks'

export interface BackupData {
  lists: List[]
  tasks: Task[]
  completions: TaskCompletion[]
  settings: Record<string, string>
}

export interface BackupFile {
  format: 'windows-todo-backup'
  schemaVersion: 1
  exportedAt: string
  data: BackupData
}

export interface BackupPreview {
  exportedAt: string
  listCount: number
  taskCount: number
  completionCount: number
}
