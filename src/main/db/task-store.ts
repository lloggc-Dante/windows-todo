import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import type { List, Task, TaskPatch } from '../../shared/tasks'

interface ListRow {
  id: string
  name: string
  created_at: string
  updated_at: string
}

interface TaskRow {
  id: string
  list_id: string
  title: string
  notes: string | null
  due_local: string | null
  due_has_time: number
  recurrence_rule: string | null
  reminder_offset_minutes: number | null
  sort_order: number
  completed_at: string | null
  created_at: string
  updated_at: string
}

function toList(row: ListRow): List {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    listId: row.list_id,
    title: row.title,
    notes: row.notes,
    dueLocal: row.due_local,
    dueHasTime: row.due_has_time === 1,
    recurrenceRule: row.recurrence_rule,
    reminderOffsetMinutes: row.reminder_offset_minutes,
    sortOrder: row.sort_order,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function requiredName(value: string, message: string): string {
  const trimmed = value.trim()
  if (!trimmed) throw new Error(message)
  return trimmed
}

export class TaskStore {
  constructor(private readonly db: Database.Database) {}

  createList(name: string): List {
    const id = randomUUID()
    const now = new Date().toISOString()
    const normalizedName = requiredName(name, '清单名称不能为空')
    this.db.prepare('INSERT INTO lists(id, name, created_at, updated_at) VALUES (?, ?, ?, ?)')
      .run(id, normalizedName, now, now)
    return { id, name: normalizedName, createdAt: now, updatedAt: now }
  }

  listLists(): List[] {
    const rows = this.db.prepare('SELECT * FROM lists ORDER BY created_at, id').all() as ListRow[]
    return rows.map(toList)
  }

  renameList(id: string, name: string): List {
    const normalizedName = requiredName(name, '清单名称不能为空')
    const result = this.db.prepare('UPDATE lists SET name = ?, updated_at = ? WHERE id = ?')
      .run(normalizedName, new Date().toISOString(), id)
    if (result.changes === 0) throw new Error('清单不存在')
    return this.getList(id)
  }

  deleteList(id: string): void {
    this.db.prepare('DELETE FROM lists WHERE id = ?').run(id)
  }

  createTask(listId: string, title: string): Task {
    const id = randomUUID()
    const now = new Date().toISOString()
    const normalizedTitle = requiredName(title, '任务标题不能为空')
    const nextOrder = this.db.prepare(
      'SELECT COALESCE(MAX(sort_order), -1) + 1 AS value FROM tasks WHERE list_id = ?',
    ).get(listId) as { value: number }

    this.db.prepare(`
      INSERT INTO tasks(id, list_id, title, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, listId, normalizedTitle, nextOrder.value, now, now)
    return this.getTask(id)
  }

  listTasks(listId: string): Task[] {
    const rows = this.db.prepare(
      'SELECT * FROM tasks WHERE list_id = ? ORDER BY sort_order, created_at, id',
    ).all(listId) as TaskRow[]
    return rows.map(toTask)
  }

  updateTask(id: string, patch: TaskPatch): Task {
    const current = this.getTask(id)
    const title = patch.title === undefined
      ? current.title
      : requiredName(patch.title, '任务标题不能为空')
    const dueLocal = patch.dueLocal === undefined ? current.dueLocal : patch.dueLocal
    const recurrenceRule = patch.recurrenceRule === undefined
      ? current.recurrenceRule
      : patch.recurrenceRule
    const reminderOffsetMinutes = patch.reminderOffsetMinutes === undefined
      ? current.reminderOffsetMinutes
      : patch.reminderOffsetMinutes

    if (!dueLocal && recurrenceRule) throw new Error('重复任务需要截止日期')
    if (!dueLocal && reminderOffsetMinutes !== null) throw new Error('提醒需要截止日期')
    if (reminderOffsetMinutes !== null && reminderOffsetMinutes < 0) {
      throw new Error('提醒偏移不能为负数')
    }

    const dueHasTime = dueLocal
      ? (patch.dueHasTime === undefined ? current.dueHasTime : patch.dueHasTime)
      : false

    this.db.prepare(`
      UPDATE tasks SET
        title = ?, notes = ?, due_local = ?, due_has_time = ?, recurrence_rule = ?,
        reminder_offset_minutes = ?, updated_at = ?
      WHERE id = ?
    `).run(
      title,
      patch.notes === undefined ? current.notes : patch.notes,
      dueLocal,
      dueHasTime ? 1 : 0,
      dueLocal ? recurrenceRule : null,
      dueLocal ? reminderOffsetMinutes : null,
      new Date().toISOString(),
      id,
    )
    return this.getTask(id)
  }

  deleteTask(id: string): void {
    this.db.prepare('DELETE FROM tasks WHERE id = ?').run(id)
  }

  getTask(id: string): Task {
    const row = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow | undefined
    if (!row) throw new Error('任务不存在')
    return toTask(row)
  }

  private getList(id: string): List {
    const row = this.db.prepare('SELECT * FROM lists WHERE id = ?').get(id) as ListRow | undefined
    if (!row) throw new Error('清单不存在')
    return toList(row)
  }
}
