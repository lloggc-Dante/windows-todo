import { readFile, stat, writeFile } from 'node:fs/promises'
import type Database from 'better-sqlite3'
import type { BackupData, BackupFile, BackupPreview } from '../shared/backup'
import type { List, Task, TaskCompletion } from '../shared/tasks'
import { TaskStore } from './db/task-store'

const MAX_BACKUP_BYTES = 50 * 1024 * 1024

function record(value: unknown, message = '备份格式无效'): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(message)
  return value as Record<string, unknown>
}

function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value) throw new Error(`备份字段 ${field} 无效`)
  return value
}

function nullableText(value: unknown, field: string): string | null {
  if (value === null) return null
  if (typeof value !== 'string') throw new Error(`备份字段 ${field} 无效`)
  return value
}

function parseList(value: unknown): List {
  const item = record(value)
  return {
    id: text(item.id, 'list.id'),
    name: text(item.name, 'list.name'),
    createdAt: text(item.createdAt, 'list.createdAt'),
    updatedAt: text(item.updatedAt, 'list.updatedAt'),
  }
}

function parseTask(value: unknown): Task {
  const item = record(value)
  if (typeof item.dueHasTime !== 'boolean') throw new Error('备份字段 task.dueHasTime 无效')
  if (!Number.isInteger(item.sortOrder) || (item.sortOrder as number) < 0) {
    throw new Error('备份字段 task.sortOrder 无效')
  }
  if (item.reminderOffsetMinutes !== null
    && (typeof item.reminderOffsetMinutes !== 'number' || !Number.isFinite(item.reminderOffsetMinutes))) {
    throw new Error('备份字段 task.reminderOffsetMinutes 无效')
  }
  return {
    id: text(item.id, 'task.id'),
    listId: text(item.listId, 'task.listId'),
    title: text(item.title, 'task.title'),
    notes: nullableText(item.notes, 'task.notes'),
    dueLocal: nullableText(item.dueLocal, 'task.dueLocal'),
    dueHasTime: item.dueHasTime,
    recurrenceRule: nullableText(item.recurrenceRule, 'task.recurrenceRule'),
    reminderOffsetMinutes: item.reminderOffsetMinutes as number | null,
    sortOrder: item.sortOrder as number,
    completedAt: nullableText(item.completedAt, 'task.completedAt'),
    createdAt: text(item.createdAt, 'task.createdAt'),
    updatedAt: text(item.updatedAt, 'task.updatedAt'),
  }
}

function parseCompletion(value: unknown): TaskCompletion {
  const item = record(value)
  return {
    id: text(item.id, 'completion.id'),
    taskId: text(item.taskId, 'completion.taskId'),
    occurrenceKey: text(item.occurrenceKey, 'completion.occurrenceKey'),
    completedAt: text(item.completedAt, 'completion.completedAt'),
  }
}

function parseBackup(value: unknown): BackupFile {
  const root = record(value)
  if (root.format !== 'windows-todo-backup') throw new Error('不是轻待办备份文件')
  if (root.schemaVersion !== 1) {
    if (typeof root.schemaVersion === 'number' && root.schemaVersion > 1) {
      throw new Error('备份来自较新版本，无法导入')
    }
    throw new Error('备份版本不受支持')
  }
  const data = record(root.data)
  if (!Array.isArray(data.lists) || !Array.isArray(data.tasks) || !Array.isArray(data.completions)) {
    throw new Error('备份数据不完整')
  }
  const lists = data.lists.map(parseList)
  const tasks = data.tasks.map(parseTask)
  const completions = data.completions.map(parseCompletion)
  const settings: Record<string, string> = {}
  for (const [key, value] of Object.entries(record(data.settings))) {
    if (typeof value !== 'string') throw new Error('备份设置无效')
    settings[key] = value
  }

  const listIds = new Set(lists.map(list => list.id))
  const taskIds = new Set(tasks.map(task => task.id))
  if (listIds.size !== lists.length || taskIds.size !== tasks.length) throw new Error('备份包含重复ID')
  for (const task of tasks) {
    if (!listIds.has(task.listId)) throw new Error('任务引用了不存在的清单')
  }
  for (const completion of completions) {
    if (!taskIds.has(completion.taskId)) throw new Error('完成历史引用了不存在的任务')
  }

  return {
    format: 'windows-todo-backup',
    schemaVersion: 1,
    exportedAt: text(root.exportedAt, 'exportedAt'),
    data: { lists, tasks, completions, settings },
  }
}

async function readBackup(filename: string): Promise<BackupFile> {
  const info = await stat(filename)
  if (info.size > MAX_BACKUP_BYTES) throw new Error('备份文件过大')
  return parseBackup(JSON.parse(await readFile(filename, 'utf8')))
}

export async function exportBackup(db: Database.Database, filename: string): Promise<void> {
  const store = new TaskStore(db)
  const lists = store.listLists()
  const tasks = lists.flatMap(list => store.listTasks(list.id))
  const completions = tasks.flatMap(task => store.listCompletions(task.id))
  const rows = db.prepare('SELECT key, value FROM settings ORDER BY key').all() as Array<{
    key: string
    value: string
  }>
  const backup: BackupFile = {
    format: 'windows-todo-backup',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    data: {
      lists,
      tasks,
      completions,
      settings: Object.fromEntries(rows.map(row => [row.key, row.value])),
    },
  }
  await writeFile(filename, JSON.stringify(backup, null, 2), 'utf8')
}

export async function previewBackup(
  _db: Database.Database,
  filename: string,
): Promise<BackupPreview> {
  const backup = await readBackup(filename)
  return {
    exportedAt: backup.exportedAt,
    listCount: backup.data.lists.length,
    taskCount: backup.data.tasks.length,
    completionCount: backup.data.completions.length,
  }
}

export async function replaceFromBackup(db: Database.Database, filename: string): Promise<void> {
  const backup = await readBackup(filename)
  const data: BackupData = backup.data

  db.transaction(() => {
    db.prepare('DELETE FROM reminders').run()
    db.prepare('DELETE FROM task_completions').run()
    db.prepare('DELETE FROM tasks').run()
    db.prepare('DELETE FROM lists').run()
    db.prepare('DELETE FROM settings').run()

    const insertList = db.prepare(
      'INSERT INTO lists(id, name, created_at, updated_at) VALUES (?, ?, ?, ?)',
    )
    for (const list of data.lists) insertList.run(list.id, list.name, list.createdAt, list.updatedAt)

    const insertTask = db.prepare(`
      INSERT INTO tasks(
        id, list_id, title, notes, due_local, due_has_time, recurrence_rule,
        reminder_offset_minutes, sort_order, completed_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    for (const task of data.tasks) {
      insertTask.run(
        task.id, task.listId, task.title, task.notes, task.dueLocal, task.dueHasTime ? 1 : 0,
        task.recurrenceRule, task.reminderOffsetMinutes, task.sortOrder, task.completedAt,
        task.createdAt, task.updatedAt,
      )
    }

    const insertCompletion = db.prepare(
      'INSERT INTO task_completions(id, task_id, occurrence_key, completed_at) VALUES (?, ?, ?, ?)',
    )
    for (const completion of data.completions) {
      insertCompletion.run(
        completion.id, completion.taskId, completion.occurrenceKey, completion.completedAt,
      )
    }

    const insertSetting = db.prepare('INSERT INTO settings(key, value) VALUES (?, ?)')
    for (const [key, value] of Object.entries(data.settings)) insertSetting.run(key, value)
  })()
}
