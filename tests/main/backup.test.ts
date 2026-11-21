import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import { exportBackup, previewBackup, replaceFromBackup } from '../../src/main/backup'
import { createDatabase } from '../../src/main/db/database'
import { TaskStore } from '../../src/main/db/task-store'

const databases: Database.Database[] = []
const directories: string[] = []

function openStore() {
  const db = createDatabase(':memory:')
  databases.push(db)
  return { db, store: new TaskStore(db) }
}

function tempDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), 'windows-todo-backup-'))
  directories.push(directory)
  return directory
}

afterEach(() => {
  for (const db of databases.splice(0)) db.close()
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

describe('manual backup', () => {
  it('round-trips order, no-date tasks, recurrence, settings, and completion history', async () => {
    const source = openStore()
    const list = source.store.createList('个人')
    const noDate = source.store.createTask(list.id, '以后整理书桌')
    const recurring = source.store.createTask(list.id, '每日阅读')
    source.store.updateTask(recurring.id, {
      dueLocal: '2026-11-22',
      recurrenceRule: 'FREQ=DAILY',
      reminderOffsetMinutes: 0,
    })
    source.store.completeTask(recurring.id, new Date(2026, 10, 20, 8, 0))
    source.store.reorderTasks(list.id, [noDate.id, recurring.id])
    source.store.setSetting('dateOnlyReminderTime', '08:30')
    const filename = join(tempDirectory(), 'backup.json')
    await exportBackup(source.db, filename)

    const target = openStore()
    const obsoleteList = target.store.createList('应被替换')
    target.store.createTask(obsoleteList.id, '旧数据')
    expect(await previewBackup(target.db, filename)).toMatchObject({
      listCount: 1,
      taskCount: 2,
      completionCount: 1,
    })
    await replaceFromBackup(target.db, filename)

    expect(target.store.listLists().map(item => item.name)).toEqual(['个人'])
    expect(target.store.listTasks(list.id).map(task => task.id)).toEqual([noDate.id, recurring.id])
    expect(target.store.getTask(noDate.id).dueLocal).toBeNull()
    expect(target.store.getTask(recurring.id).dueLocal).toBe('2026-11-23')
    expect(target.store.listCompletions(recurring.id)).toHaveLength(1)
    expect(target.store.getSetting('dateOnlyReminderTime')).toBe('08:30')
    expect(JSON.parse(readFileSync(filename, 'utf8'))).toMatchObject({
      format: 'windows-todo-backup',
      schemaVersion: 1,
    })
  })

  it.each([
    { name: 'malformed.json', content: '{not json' },
    {
      name: 'future.json',
      content: JSON.stringify({
        format: 'windows-todo-backup',
        schemaVersion: 99,
        exportedAt: new Date().toISOString(),
        data: { lists: [], tasks: [], completions: [], settings: {} },
      }),
    },
  ])('rejects $name without changing existing data', async ({ name, content }) => {
    const target = openStore()
    const list = target.store.createList('保留')
    const task = target.store.createTask(list.id, '原数据')
    const filename = join(tempDirectory(), name)
    writeFileSync(filename, content)

    await expect(replaceFromBackup(target.db, filename)).rejects.toThrow()
    expect(target.store.listLists().map(item => item.name)).toEqual(['保留'])
    expect(target.store.listTasks(list.id).map(item => item.id)).toEqual([task.id])
  })

  it('rejects inconsistent foreign keys before replacing data', async () => {
    const source = openStore()
    const list = source.store.createList('个人')
    source.store.createTask(list.id, '任务')
    const filename = join(tempDirectory(), 'inconsistent.json')
    await exportBackup(source.db, filename)
    const backup = JSON.parse(readFileSync(filename, 'utf8'))
    backup.data.tasks[0].listId = 'missing-list'
    writeFileSync(filename, JSON.stringify(backup))
    const target = openStore()
    const preserved = target.store.createList('保留')

    await expect(replaceFromBackup(target.db, filename)).rejects.toThrow('引用了不存在的清单')
    expect(target.store.listLists().map(item => item.id)).toEqual([preserved.id])
  })
})


describe('backup date invariants', () => {
  it('rejects an inconsistent due date during preview', async () => {
    const source = openStore()
    const list = source.store.createList('个人')
    source.store.createTask(list.id, '任务')
    const filename = join(tempDirectory(), 'invalid-date.json')
    await exportBackup(source.db, filename)
    const backup = JSON.parse(readFileSync(filename, 'utf8'))
    backup.data.tasks[0].dueLocal = '2026-11-22T'
    backup.data.tasks[0].dueHasTime = true
    writeFileSync(filename, JSON.stringify(backup))
    const target = openStore()

    await expect(previewBackup(target.db, filename)).rejects.toThrow('无效')
  })
})
