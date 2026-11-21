export interface LocalDateTimeParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
}

export function parseLocalDateTime(value: string, hasTime: boolean): LocalDateTimeParts {
  const pattern = hasTime
    ? /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/
    : /^(\d{4})-(\d{2})-(\d{2})$/
  const match = pattern.exec(value)
  if (!match) throw new Error('无效的本地日期时间')
  const parts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4] ?? 0),
    minute: Number(match[5] ?? 0),
  }
  const date = new Date(Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
  ))
  if (
    date.getUTCFullYear() !== parts.year
    || date.getUTCMonth() !== parts.month - 1
    || date.getUTCDate() !== parts.day
    || date.getUTCHours() !== parts.hour
    || date.getUTCMinutes() !== parts.minute
  ) {
    throw new Error('无效的本地日期时间')
  }
  return parts
}

export function assertLocalDateTime(value: string | null, hasTime: boolean): void {
  if (value === null) {
    if (hasTime) throw new Error('无效的本地日期时间')
    return
  }
  parseLocalDateTime(value, hasTime)
}
