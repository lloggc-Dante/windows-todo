import { describe, expect, it } from 'vitest'
import {
  restoreWidgetPosition,
  resolveWidgetPresentation,
  widgetHeight,
  widgetRows,
} from '../../src/shared/widget'

describe('widget geometry', () => {
  it.each([
    { count: 0, rows: 1, height: 178 },
    { count: 1, rows: 1, height: 178 },
    { count: 8, rows: 8, height: 472 },
    { count: 9, rows: 8, height: 472 },
    { count: -4, rows: 1, height: 178 },
    { count: Number.NaN, rows: 1, height: 178 },
  ])('uses $rows rows and $height px for $count tasks', ({ count, rows, height }) => {
    expect(widgetRows(count)).toBe(rows)
    expect(widgetHeight(count)).toBe(height)
  })
})

describe('platform presentation', () => {
  it('uses non-transparent Acrylic with native corners on Windows 11 22H2+', () => {
    expect(resolveWidgetPresentation({ platform: 'win32', release: '10.0.22621' })).toEqual({
      mode: 'acrylic',
      transparent: false,
      roundedCorners: true,
      backgroundMaterial: 'acrylic',
    })
  })

  it('uses transparent CSS corners on Windows 10', () => {
    expect(resolveWidgetPresentation({ platform: 'win32', release: '10.0.19045' })).toEqual({
      mode: 'css',
      transparent: true,
      roundedCorners: false,
      backgroundMaterial: 'none',
    })
  })
})

describe('position restoration', () => {
  const displays = [
    { id: 1, workArea: { x: 0, y: 0, width: 1920, height: 1080 } },
    { id: 2, workArea: { x: 1920, y: 0, width: 1280, height: 1024 } },
  ]

  it('keeps a saved position on its original display', () => {
    expect(restoreWidgetPosition({
      displayId: 2, x: 2100, y: 200, width: 520, height: 300,
    }, displays)).toEqual({ displayId: 2, x: 2100, y: 200, width: 520, height: 300 })
  })

  it('falls back to an existing display and clamps the widget into its work area', () => {
    expect(restoreWidgetPosition({
      displayId: 99, x: 9999, y: -50, width: 520, height: 300,
    }, displays)).toEqual({ displayId: 1, x: 1400, y: 0, width: 520, height: 300 })
  })
})
