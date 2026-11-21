import type Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import { createDatabase } from '../../src/main/db/database'
import { TaskStore } from '../../src/main/db/task-store'
import { ReminderScheduler } from '../../src/main/reminder-scheduler'

class FakeNotifier {
  taskNotifications: Array<{ taskId: string; onClick: () => void }> = []
  summaries: Array<{ count: number; onClick: () => void }> = []

  showTaskReminder(task: { id: string; title: string }, onClick: () => void): void {
    this.taskNotifications.push({ taskId: task.id, onClick })
  }

  showSummary(count: number, onClick: () => void): void {
    this.summaries.push({ count, onClick })
  }
}

let db: Database.Database | undefined
let scheduler: ReminderScheduler | undefined

function setup() {
  db = createDatabase(':memory:')
  const store = new TaskStore(db)
  const notifier = new FakeNotifier()
  const window = { opened: 0, selectedTask: null as string | null }
  scheduler = new ReminderScheduler(db, store, notifier, {
    showMainWindow: () => { window.opened += 1 },
    showTask: (taskId: string) => { window.selectedTask = taskId },
  })
  return { db, store, notifier, window, scheduler }
}

afterEach(() => {
  scheduler?.stop()
  scheduler = undefined
  db?.close()
  db = undefined
})

describe('ReminderScheduler', () => {
  it('does not schedule tasks without a date', async () => {
    const { db, store, notifier, scheduler } = setup()
    const list = store.createList('待办')
    store.createTask(list.id, '无日期任务')

    await scheduler.reconcile(new Date(2026, 10, 20, 10, 0))

    expect(notifier.taskNotifications).toEqual([])
    expect(db.prepare('SELECT * FROM reminders').all()).toEqual([])
  })

  it('uses 09:00 local time for a date-only reminder', async () => {
    const { db, store, scheduler } = setup()
    const list = store.createList('待办')
    const task = store.createTask(list.id, '全天任务')
    store.updateTask(task.id, { dueLocal: '2026-11-22', reminderOffsetMinutes: 0 })

    await scheduler.reschedule()

    expect(db.prepare('SELECT remind_at_utc FROM reminders').get()).toEqual({
      remind_at_utc: new Date(2026, 10, 22, 9, 0).toISOString(),
    })
  })

  it('sends a fresh notification that opens its task exactly once', async () => {
    const { store, notifier, window, scheduler } = setup()
    const list = store.createList('待办')
    const created = store.createTask(list.id, '联系客户')
    const task = store.updateTask(created.id, {
      dueLocal: '2026-11-20T09:00',
      dueHasTime: true,
      reminderOffsetMinutes: 0,
    })
    const now = new Date(2026, 10, 20, 9, 2)

    await scheduler.reconcile(now)
    await scheduler.reconcile(now)

    expect(notifier.taskNotifications.map(item => item.taskId)).toEqual([task.id])
    notifier.taskNotifications[0].onClick()
    expect(window.selectedTask).toBe(task.id)
  })

  it('groups late reminders and opens the main window from the summary', async () => {
    const { store, notifier, window, scheduler } = setup()
    const list = store.createList('待办')
    for (const title of ['任务一', '任务二']) {
      const created = store.createTask(list.id, title)
      store.updateTask(created.id, {
        dueLocal: '2026-11-18T09:00',
        dueHasTime: true,
        reminderOffsetMinutes: 0,
      })
    }

    await scheduler.reconcile(new Date(2026, 10, 20, 10, 0))

    expect(notifier.taskNotifications).toEqual([])
    expect(notifier.summaries).toHaveLength(1)
    expect(notifier.summaries[0].count).toBe(2)
    notifier.summaries[0].onClick()
    expect(window.opened).toBe(1)
  })

  it('marks reminders skipped while notifications are disabled without backfill', async () => {
    const { db, store, notifier, scheduler } = setup()
    const list = store.createList('待办')
    const created = store.createTask(list.id, '不补发')
    store.updateTask(created.id, {
      dueLocal: '2026-11-18T09:00',
      dueHasTime: true,
      reminderOffsetMinutes: 0,
    })
    store.setSetting('notificationsEnabled', 'false')
    const now = new Date(2026, 10, 20, 10, 0)

    await scheduler.reconcile(now)
    store.setSetting('notificationsEnabled', 'true')
    await scheduler.reconcile(now)

    expect(notifier.taskNotifications).toEqual([])
    expect(notifier.summaries).toEqual([])
    expect(db.prepare('SELECT status FROM reminders').get()).toEqual({ status: 'skipped' })
  })

  it('recomputes pending UTC reminders when the system timezone changes', async () => {
    const originalTimezone = process.env.TZ
    try {
      process.env.TZ = 'Asia/Shanghai'
      const { db, store, scheduler } = setup()
      const list = store.createList('待办')
      const created = store.createTask(list.id, '时区任务')
      store.updateTask(created.id, { dueLocal: '2026-11-22', reminderOffsetMinutes: 0 })
      await scheduler.reschedule()
      expect(db.prepare('SELECT remind_at_utc FROM reminders').get()).toEqual({
        remind_at_utc: '2026-11-22T01:00:00.000Z',
      })

      process.env.TZ = 'Europe/Berlin'
      await scheduler.reschedule()
      expect(db.prepare('SELECT remind_at_utc FROM reminders').get()).toEqual({
        remind_at_utc: '2026-11-22T08:00:00.000Z',
      })
    } finally {
      if (originalTimezone === undefined) delete process.env.TZ
      else process.env.TZ = originalTimezone
    }
  })
})
