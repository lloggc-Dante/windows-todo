import type Database from 'better-sqlite3'
import type { Task } from '../shared/tasks'
import type { TaskStore } from './db/task-store'
import type { NotificationWindow, Notifier } from './notifier'

interface DueReminder {
  id: string
  task_id: string
  title: string
  remind_at_utc: string
}

const LATE_THRESHOLD_MS = 5 * 60 * 1000
const MAX_TIMER_MS = 2_147_000_000

function reminderTime(task: Task, dateOnlyTime: string): string | null {
  if (!task.dueLocal || task.reminderOffsetMinutes === null || task.completedAt) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(task.dueLocal)
  if (!match) throw new Error('无效的提醒日期')
  const fallback = /^(\d{2}):(\d{2})$/.exec(dateOnlyTime)
  const hour = task.dueHasTime ? Number(match[4]) : Number(fallback?.[1] ?? 9)
  const minute = task.dueHasTime ? Number(match[5]) : Number(fallback?.[2] ?? 0)
  const due = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    hour,
    minute,
  )
  return new Date(due.getTime() - task.reminderOffsetMinutes * 60_000).toISOString()
}

export class ReminderScheduler {
  private timer: NodeJS.Timeout | undefined
  private queue: Promise<void> = Promise.resolve()
  private stopped = false

  constructor(
    private readonly db: Database.Database,
    private readonly store: TaskStore,
    private readonly notifier: Notifier,
    private readonly window: NotificationWindow,
  ) {}

  reschedule(): Promise<void> {
    return this.enqueue(async () => {
      if (this.stopped) return
      this.syncSchedules()
      if (this.timer) clearTimeout(this.timer)
      const next = this.db.prepare(
        "SELECT remind_at_utc FROM reminders WHERE status = 'pending' ORDER BY remind_at_utc LIMIT 1",
      ).get() as { remind_at_utc: string } | undefined
      if (!next) return

      const delay = Math.max(0, new Date(next.remind_at_utc).getTime() - Date.now())
      this.timer = setTimeout(() => {
        void this.reconcile(new Date()).then(() => this.reschedule())
      }, Math.min(delay, MAX_TIMER_MS))
      this.timer.unref()
    })
  }

  reconcile(now: Date): Promise<void> {
    return this.enqueue(async () => {
      if (this.stopped) return
      this.syncSchedules()
      const nowUtc = now.toISOString()

      if (this.store.getSetting('notificationsEnabled') === 'false') {
        this.db.prepare(`
          UPDATE reminders SET status = 'skipped'
          WHERE status = 'pending' AND remind_at_utc <= ?
        `).run(nowUtc)
        return
      }

      const due = this.db.prepare(`
        SELECT reminders.id, reminders.task_id, reminders.remind_at_utc, tasks.title
        FROM reminders JOIN tasks ON tasks.id = reminders.task_id
        WHERE reminders.status = 'pending' AND reminders.remind_at_utc <= ?
        ORDER BY reminders.remind_at_utc, reminders.id
      `).all(nowUtc) as DueReminder[]
      if (due.length === 0) return

      const fresh = due.filter(item =>
        now.getTime() - new Date(item.remind_at_utc).getTime() <= LATE_THRESHOLD_MS)
      const late = due.filter(item => !fresh.includes(item))

      for (const item of fresh) {
        this.notifier.showTaskReminder(
          { id: item.task_id, title: item.title },
          () => this.window.showTask(item.task_id),
        )
      }
      if (late.length > 0) {
        this.notifier.showSummary(late.length, () => this.window.showMainWindow())
      }

      const markSent = this.db.prepare(
        "UPDATE reminders SET status = 'sent', sent_at = ? WHERE id = ? AND status = 'pending'",
      )
      this.db.transaction(() => {
        for (const item of due) markSent.run(nowUtc, item.id)
      })()
    })
  }

  stop(): void {
    this.stopped = true
    if (this.timer) clearTimeout(this.timer)
    this.timer = undefined
  }

  private syncSchedules(): void {
    const dateOnlyTime = this.store.getSetting('dateOnlyReminderTime') ?? '09:00'
    const tasks = this.store.listAllTasks()
    const insert = this.db.prepare(`
      INSERT INTO reminders(id, task_id, occurrence_key, remind_at_utc)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(task_id, occurrence_key) DO UPDATE SET
        remind_at_utc = excluded.remind_at_utc
      WHERE reminders.status = 'pending'
    `)

    this.db.transaction(() => {
      this.db.prepare("DELETE FROM reminders WHERE status = 'pending'").run()
      for (const task of tasks) {
        const remindAt = reminderTime(task, dateOnlyTime)
        if (remindAt && task.dueLocal) {
          insert.run(crypto.randomUUID(), task.id, task.dueLocal, remindAt)
        }
      }
    })()
  }

  private enqueue(operation: () => Promise<void>): Promise<void> {
    const result = this.queue.then(operation)
    this.queue = result.catch(() => undefined)
    return result
  }
}
