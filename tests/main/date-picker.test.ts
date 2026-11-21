import { describe, expect, it } from 'vitest'
import { calendarMonth } from '../../src/renderer/src/date-picker'

describe('calendarMonth', () => {
  it('builds a Monday-first six-week grid across month boundaries', () => {
    const days = calendarMonth(2026, 0)
    expect(days).toHaveLength(42)
    expect(days[0]).toEqual({ date: '2025-12-29', inMonth: false })
    expect(days[41]).toEqual({ date: '2026-02-08', inMonth: false })
  })

  it('includes leap day in leap-year February', () => {
    expect(calendarMonth(2024, 1)).toContainEqual({ date: '2024-02-29', inMonth: true })
  })
})
