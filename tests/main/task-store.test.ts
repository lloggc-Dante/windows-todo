import Database from 'better-sqlite3'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { afterEach, describe, expect, it } from 'vitest'
import { createDatabase } from '../../src/main/db/database'
import { TaskStore } from '../../src/main/db/task-store'

const openDatabases: Database.Database[] = []

function openStore(): { db: Database.Database; store: TaskStore } {
  const db = createDatabase(':memory:')
  openDatabases.push(db)
  return { db, store: new TaskStore(db) }
}

afterEach(() => {
  for (const db of openDatabases.splice(0)) db.close()
})

describe('TaskStore', () => {
  it('creates and reloads a task with only a title', () => {
    const { store } = openStore()
    const list = store.createList('待办')

    const task = store.createTask(list.id, '以后整理书桌')

    expect(task).toMatchObject({
      listId: list.id,
      title: '以后整理书桌',
      notes: null,
      dueLocal: null,
      dueHasTime: false,
      recurrenceRule: null,
      reminderOffsetMinutes: null,
      completedAt: null,
    })
    expect(store.listTasks(list.id)).toEqual([task])
  })

  it('updates optional task fields and trims titles', () => {
    const { store } = openStore()
    const list = store.createList('待办')
    const task = store.createTask(list.id, '初始标题')

    const updated = store.updateTask(task.id, {
      title: '  明早联系客户  ',
      dueLocal: '2026-11-22T09:00',
      dueHasTime: true,
      reminderOffsetMinutes: 15,
    })

    expect(updated.title).toBe('明早联系客户')
    expect(updated.dueLocal).toBe('2026-11-22T09:00')
    expect(updated.reminderOffsetMinutes).toBe(15)
  })

  it.each(['', '   '])('rejects an empty task title: %j', (title) => {
    const { store } = openStore()
    const list = store.createList('待办')
    expect(() => store.createTask(list.id, title)).toThrow('任务标题不能为空')
  })

  it('renames and deletes lists with their tasks', () => {
    const { store } = openStore()
    const list = store.createList('旧名称')
    const task = store.createTask(list.id, '随清单删除')

    expect(store.renameList(list.id, '新名称').name).toBe('新名称')
    store.deleteList(list.id)
    expect(store.listLists()).toEqual([])
    expect(store.listTasks(list.id)).toEqual([])
    expect(() => store.updateTask(task.id, { title: '不存在' })).toThrow('任务不存在')
  })
})

describe('database migrations', () => {
  it('refuses to open a database from a newer schema version', () => {
    const directory = mkdtempSync(join(tmpdir(), 'windows-todo-'))
    const filename = join(directory, `${randomUUID()}.db`)
    const db = new Database(filename)
    db.pragma('user_version = 99')
    db.close()

    try {
      expect(() => createDatabase(filename)).toThrow('数据库版本较新')
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })
})
