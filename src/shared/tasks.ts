export interface List {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

export interface Task {
  id: string
  listId: string
  title: string
  notes: string | null
  dueLocal: string | null
  dueHasTime: boolean
  recurrenceRule: string | null
  reminderOffsetMinutes: number | null
  sortOrder: number
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface TaskPatch {
  title?: string
  notes?: string | null
  dueLocal?: string | null
  dueHasTime?: boolean
  recurrenceRule?: string | null
  reminderOffsetMinutes?: number | null
}

export interface TaskCompletion {
  id: string
  taskId: string
  occurrenceKey: string
  completedAt: string
}
