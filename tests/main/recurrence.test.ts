import type Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import { createDatabase } from '../../src/main/db/database'
import { TaskStore } from '../../src/main/db/task-store'

let db: Database.Database | undefined

function openStore(): TaskStore {
  db = createDatabase(':memory:')
  return new TaskStore(db)
}

afterEach(() => {
  db?.close()
  db = undefined
})

describe('recurring task completion', () => {
  it('advances an early completion from the scheduled occurrence', () => {
    const store = openStore()
    const list = store.createList('待办')
    const created = store.createTask(list.id, '每日阅读')
    const task = store.updateTask(created.id, {
      dueLocal: '2026-11-22T09:00',
      dueHasTime: true,
      recurrenceRule: 'FREQ=DAILY',
    })

    const next = store.completeTask(task.id, new Date(2026, 10, 20, 8, 0))

    expect(next?.dueLocal).toBe('2026-11-23T09:00')
    expect(next?.completedAt).toBeNull()
    expect(store.listCompletions(task.id)).toHaveLength(1)
  })

  it('skips missed occurrences when completing late', () => {
    const store = openStore()
    const list = store.createList('待办')
    const created = store.createTask(list.id, '每日阅读')
    const task = store.updateTask(created.id, {
      dueLocal: '2026-11-18T09:00',
      dueHasTime: true,
      recurrenceRule: 'FREQ=DAILY',
    })

    const next = store.completeTask(task.id, new Date(2026, 10, 20, 12, 0))

    expect(next?.dueLocal).toBe('2026-11-21T09:00')
    expect(store.listCompletions(task.id)).toHaveLength(1)
  })

  it('finishes a recurring task when COUNT has been consumed by skipped occurrences', () => {
    const store = openStore()
    const list = store.createList('待办')
    const created = store.createTask(list.id, '三次任务')
    const task = store.updateTask(created.id, {
      dueLocal: '2026-11-20',
      recurrenceRule: 'FREQ=DAILY;COUNT=3',
    })
    const now = new Date(2026, 10, 24, 10, 0)

    const completed = store.completeTask(task.id, now)

    expect(completed?.completedAt).toBe(now.toISOString())
    expect(store.listCompletions(task.id)).toHaveLength(1)
  })

  it('undoes only the latest completion and restores its occurrence', () => {
    const store = openStore()
    const list = store.createList('待办')
    const created = store.createTask(list.id, '每日阅读')
    const task = store.updateTask(created.id, {
      dueLocal: '2026-11-22',
      recurrenceRule: 'FREQ=DAILY',
    })

    store.completeTask(task.id, new Date(2026, 10, 20, 8, 0))
    const restored = store.undoLatestCompletion(task.id)

    expect(restored.dueLocal).toBe('2026-11-22')
    expect(restored.completedAt).toBeNull()
    expect(store.listCompletions(task.id)).toEqual([])
    expect(() => store.undoLatestCompletion(task.id)).toThrow('没有可撤销的完成记录')
  })

  it('completes and restores a nonrecurring task without a date', () => {
    const store = openStore()
    const list = store.createList('待办')
    const task = store.createTask(list.id, '以后整理书桌')
    const now = new Date(2026, 10, 20, 8, 0)

    expect(store.completeTask(task.id, now)).toMatchObject({
      completedAt: now.toISOString(),
      dueLocal: null,
    })
    expect(store.undoLatestCompletion(task.id)).toMatchObject({
      completedAt: null,
      dueLocal: null,
    })
  })
})


describe('COUNT regression', () => {
  it('finishes after three consecutive completions from the original series anchor', () => {
    const store = openStore()
    const list = store.createList('待办')
    const created = store.createTask(list.id, '三次任务')
    const task = store.updateTask(created.id, {
      dueLocal: '2026-11-20',
      recurrenceRule: 'FREQ=DAILY;COUNT=3',
    })

    const first = store.completeTask(task.id, new Date(2026, 10, 20, 10, 0))
    const second = store.completeTask(task.id, new Date(2026, 10, 21, 10, 0))
    const third = store.completeTask(task.id, new Date(2026, 10, 22, 10, 0))

    expect(first?.dueLocal).toBe('2026-11-21')
    expect(second?.dueLocal).toBe('2026-11-22')
    expect(third?.completedAt).toBe(new Date(2026, 10, 22, 10, 0).toISOString())
    expect(store.completeTask(task.id, new Date(2026, 10, 23, 10, 0))?.completedAt)
      .toBe(third?.completedAt)
  })
})
