import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import type { List, Task, TaskCompletion, TaskPatch } from '../../shared/tasks'
import { assertLocalDateTime } from '../../shared/local-date-time'
import { assertValidRecurrenceRule, nextOccurrence } from '../recurrence'

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
  series_start: string | null
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
    seriesStart: row.series_start,
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
    this.db.transaction(() => {
      this.db.prepare(
        'UPDATE tasks SET sort_order = sort_order + 1 WHERE list_id = ? AND completed_at IS NULL',
      ).run(listId)
      this.db.prepare(`
        INSERT INTO tasks(id, list_id, title, sort_order, created_at, updated_at)
        VALUES (?, ?, ?, 0, ?, ?)
      `).run(id, listId, normalizedTitle, now, now)
    })()
    return this.getTask(id)
  }

  listTasks(listId: string): Task[] {
    const rows = this.db.prepare(
      `SELECT * FROM tasks WHERE list_id = ?
       ORDER BY completed_at IS NOT NULL, sort_order, completed_at DESC, created_at, id`,
    ).all(listId) as TaskRow[]
    return rows.map(toTask)
  }

  listAllTasks(): Task[] {
    const rows = this.db.prepare(
      `SELECT * FROM tasks
       ORDER BY list_id, completed_at IS NOT NULL, sort_order, completed_at DESC, created_at, id`,
    ).all() as TaskRow[]
    return rows.map(toTask)
  }

  setSetting(key: string, value: string): void {
    this.db.prepare(`
      INSERT INTO settings(key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(key, value)
  }

  getSetting(key: string): string | null {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
      | { value: string }
      | undefined
    return row?.value ?? null
  }

  reorderTasks(listId: string, orderedTaskIds: string[]): Task[] {
    if (new Set(orderedTaskIds).size !== orderedTaskIds.length) {
      throw new Error('任务顺序包含重复任务')
    }

    const currentIds = this.db.prepare(
      'SELECT id FROM tasks WHERE list_id = ? AND completed_at IS NULL',
    ).all(listId) as Array<{ id: string }>
    const expectedIds = new Set(currentIds.map(row => row.id))
    const suppliedIds = new Set(orderedTaskIds)
    const sameTasks = expectedIds.size === suppliedIds.size
      && [...expectedIds].every(id => suppliedIds.has(id))
    if (!sameTasks) {
      throw new Error('任务顺序必须包含清单中的全部未完成任务')
    }

    const update = this.db.prepare(
      'UPDATE tasks SET sort_order = ?, updated_at = ? WHERE id = ? AND list_id = ?',
    )
    this.db.transaction(() => {
      const now = new Date().toISOString()
      orderedTaskIds.forEach((id, index) => update.run(index, now, id, listId))
    })()
    return this.listTasks(listId).filter(task => task.completedAt === null)
  }

  moveTaskToList(taskId: string, targetListId: string): Task {
    const task = this.getTask(taskId)
    this.getList(targetListId)

    this.db.transaction(() => {
      if (task.completedAt === null) {
        this.db.prepare(
          'UPDATE tasks SET sort_order = sort_order + 1 WHERE list_id = ? AND completed_at IS NULL',
        ).run(targetListId)
      }
      this.db.prepare(
        'UPDATE tasks SET list_id = ?, sort_order = 0, updated_at = ? WHERE id = ?',
      ).run(targetListId, new Date().toISOString(), taskId)
      this.rebalanceList(task.listId)
    })()
    return this.getTask(taskId)
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
    assertLocalDateTime(dueLocal, dueHasTime)
    assertValidRecurrenceRule(dueLocal ? recurrenceRule : null)

    const recurrenceChanged = patch.recurrenceRule !== undefined
      && patch.recurrenceRule !== current.recurrenceRule
    const dueChanged = patch.dueLocal !== undefined && patch.dueLocal !== current.dueLocal
    const timeModeChanged = patch.dueHasTime !== undefined && patch.dueHasTime !== current.dueHasTime
    let seriesStart = dueLocal && recurrenceRule ? current.seriesStart : null
    if (recurrenceRule && dueLocal
      && (!seriesStart || recurrenceChanged || dueChanged || timeModeChanged)) {
      seriesStart = dueLocal
    }

    this.db.prepare(`
      UPDATE tasks SET
        title = ?, notes = ?, due_local = ?, due_has_time = ?, recurrence_rule = ?, series_start = ?,
        reminder_offset_minutes = ?, updated_at = ?
      WHERE id = ?
    `).run(
      title,
      patch.notes === undefined ? current.notes : patch.notes,
      dueLocal,
      dueHasTime ? 1 : 0,
      dueLocal ? recurrenceRule : null,
      seriesStart,
      dueLocal ? reminderOffsetMinutes : null,
      new Date().toISOString(),
      id,
    )
    return this.getTask(id)
  }

  deleteTask(id: string): void {
    this.db.prepare('DELETE FROM tasks WHERE id = ?').run(id)
  }

  completeTask(taskId: string, now: Date): Task | null {
    const task = this.getTask(taskId)
    if (task.completedAt) return task

    const completedAt = now.toISOString()
    const occurrenceKey = task.dueLocal ?? `floating:${task.id}`
    const next = nextOccurrence(task, now)

    this.db.transaction(() => {
      this.db.prepare(
        'INSERT INTO task_completions(id, task_id, occurrence_key, completed_at) VALUES (?, ?, ?, ?)',
      ).run(randomUUID(), taskId, occurrenceKey, completedAt)
      this.db.prepare(
        "UPDATE reminders SET status = 'skipped' WHERE task_id = ? AND occurrence_key = ? AND status = 'pending'",
      ).run(taskId, occurrenceKey)
      this.db.prepare(`
        UPDATE tasks SET due_local = ?, completed_at = ?, updated_at = ? WHERE id = ?
      `).run(next?.local ?? task.dueLocal, next ? null : completedAt, completedAt, taskId)
    })()
    return this.getTask(taskId)
  }

  undoLatestCompletion(taskId: string): Task {
    this.getTask(taskId)
    const completion = this.db.prepare(`
      SELECT * FROM task_completions WHERE task_id = ?
      ORDER BY completed_at DESC, rowid DESC LIMIT 1
    `).get(taskId) as {
      id: string
      occurrence_key: string
    } | undefined
    if (!completion) throw new Error('没有可撤销的完成记录')

    this.db.transaction(() => {
      const task = this.getTask(taskId)
      this.db.prepare('DELETE FROM task_completions WHERE id = ?').run(completion.id)
      this.db.prepare('DELETE FROM reminders WHERE task_id = ? AND occurrence_key = ?')
        .run(taskId, completion.occurrence_key)
      this.db.prepare(`
        UPDATE tasks SET due_local = ?, completed_at = NULL, updated_at = ? WHERE id = ?
      `).run(
        task.recurrenceRule ? completion.occurrence_key : task.dueLocal,
        new Date().toISOString(),
        taskId,
      )
    })()
    return this.getTask(taskId)
  }

  listCompletions(taskId: string): TaskCompletion[] {
    const rows = this.db.prepare(`
      SELECT * FROM task_completions WHERE task_id = ? ORDER BY completed_at DESC, rowid DESC
    `).all(taskId) as Array<{
      id: string
      task_id: string
      occurrence_key: string
      completed_at: string
    }>
    return rows.map(row => ({
      id: row.id,
      taskId: row.task_id,
      occurrenceKey: row.occurrence_key,
      completedAt: row.completed_at,
    }))
  }

  getTask(id: string): Task {
    const row = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow | undefined
    if (!row) throw new Error('任务不存在')
    return toTask(row)
  }

  private rebalanceList(listId: string): void {
    const rows = this.db.prepare(
      'SELECT id FROM tasks WHERE list_id = ? AND completed_at IS NULL ORDER BY sort_order, created_at, id',
    ).all(listId) as Array<{ id: string }>
    const update = this.db.prepare('UPDATE tasks SET sort_order = ? WHERE id = ?')
    rows.forEach((row, index) => update.run(index, row.id))
  }

  private getList(id: string): List {
    const row = this.db.prepare('SELECT * FROM lists WHERE id = ?').get(id) as ListRow | undefined
    if (!row) throw new Error('清单不存在')
    return toList(row)
  }
}
