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

describe('manual task ordering', () => {
  it('inserts new tasks at the top of their list', () => {
    const store = openStore()
    const list = store.createList('待办')
    const first = store.createTask(list.id, '先创建')
    const second = store.createTask(list.id, '后创建')

    expect(store.listTasks(list.id).map(task => task.id)).toEqual([second.id, first.id])
  })

  it('persists an explicit drag order as contiguous positions', () => {
    const store = openStore()
    const list = store.createList('待办')
    const first = store.createTask(list.id, '一')
    const second = store.createTask(list.id, '二')
    const third = store.createTask(list.id, '三')

    const reordered = store.reorderTasks(list.id, [second.id, third.id, first.id])

    expect(reordered.map(task => task.id)).toEqual([second.id, third.id, first.id])
    expect(reordered.map(task => task.sortOrder)).toEqual([0, 1, 2])
    expect(store.listTasks(list.id).map(task => task.id)).toEqual([second.id, third.id, first.id])
  })

  it('moves a task to the top of another list and rebalances the source', () => {
    const store = openStore()
    const source = store.createList('来源')
    const target = store.createList('目标')
    const first = store.createTask(source.id, '一')
    const second = store.createTask(source.id, '二')
    const existing = store.createTask(target.id, '已有')

    const moved = store.moveTaskToList(first.id, target.id)

    expect(moved.listId).toBe(target.id)
    expect(moved.sortOrder).toBe(0)
    expect(store.listTasks(target.id).map(task => task.id)).toEqual([first.id, existing.id])
    expect(store.listTasks(source.id).map(task => task.id)).toEqual([second.id])
    expect(store.listTasks(source.id)[0].sortOrder).toBe(0)
  })

  it('rejects duplicate, foreign, and missing task IDs without changing order', () => {
    const store = openStore()
    const list = store.createList('待办')
    const otherList = store.createList('其他')
    const first = store.createTask(list.id, '一')
    const second = store.createTask(list.id, '二')
    const foreign = store.createTask(otherList.id, '外部')
    const before = store.listTasks(list.id)

    expect(() => store.reorderTasks(list.id, [first.id, first.id])).toThrow('任务顺序包含重复任务')
    expect(() => store.reorderTasks(list.id, [first.id, foreign.id])).toThrow('任务顺序必须包含清单中的全部未完成任务')
    expect(() => store.reorderTasks(list.id, [first.id])).toThrow('任务顺序必须包含清单中的全部未完成任务')
    expect(store.listTasks(list.id)).toEqual(before)
    expect(store.listTasks(list.id).map(task => task.id)).toContain(second.id)
  })
})
