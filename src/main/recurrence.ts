import rrulePackage from 'rrule'
import type { Task } from '../shared/tasks'

const { rrulestr } = rrulePackage

export interface Occurrence {
  local: string
  hasTime: boolean
}

interface LocalDateTime {
  date: Date
  hasTime: boolean
}

function parseLocal(value: string): LocalDateTime {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(value)
  if (!match) throw new Error('无效的本地日期时间')
  const [, year, month, day, hour, minute] = match
  const hasTime = hour !== undefined
  const date = new Date(Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour ?? 0),
    Number(minute ?? 0),
  ))
  if (
    date.getUTCFullYear() !== Number(year)
    || date.getUTCMonth() !== Number(month) - 1
    || date.getUTCDate() !== Number(day)
    || date.getUTCHours() !== Number(hour ?? 0)
    || date.getUTCMinutes() !== Number(minute ?? 0)
  ) {
    throw new Error('无效的本地日期时间')
  }
  return { date, hasTime }
}

function floatingNow(now: Date): Date {
  return new Date(Date.UTC(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
    now.getMilliseconds(),
  ))
}

function pad(value: number): string {
  return value.toString().padStart(2, '0')
}

function formatLocal(date: Date, hasTime: boolean): string {
  const day = `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
  return hasTime ? `${day}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}` : day
}

export function nextOccurrence(task: Task, now = new Date()): Occurrence | null {
  if (!task.recurrenceRule || !task.dueLocal) return null

  const current = parseLocal(task.dueLocal)
  const currentTime = current.date.getTime()
  const nowTime = floatingNow(now).getTime()
  const after = new Date(Math.max(currentTime, nowTime))
  const until = new Date(after)
  until.setUTCFullYear(until.getUTCFullYear() + 100)
  const rule = rrulestr(task.recurrenceRule, {
    dtstart: current.date,
  })
  const next = rule.between(after, until, false)[0]

  return next ? { local: formatLocal(next, task.dueHasTime), hasTime: task.dueHasTime } : null
}
