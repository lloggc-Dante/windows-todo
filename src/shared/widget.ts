export const WIDGET_WIDTH = 520
export const WIDGET_MAX_ROWS = 8
export const WIDGET_ROW_HEIGHT = 42
export const WIDGET_BASE_HEIGHT = 136

export interface WidgetPresentation {
  mode: 'acrylic' | 'css'
  transparent: boolean
  roundedCorners: boolean
  backgroundMaterial: 'acrylic' | 'none'
}

export interface WidgetPosition {
  displayId: number
  x: number
  y: number
  width: number
  height: number
}

export interface DisplayInfo {
  id: number
  workArea: {
    x: number
    y: number
    width: number
    height: number
  }
}

export function widgetRows(taskCount: number): number {
  if (!Number.isFinite(taskCount)) return 1
  return Math.min(WIDGET_MAX_ROWS, Math.max(1, Math.floor(taskCount)))
}

export function widgetHeight(taskCount: number): number {
  return WIDGET_BASE_HEIGHT + widgetRows(taskCount) * WIDGET_ROW_HEIGHT
}

export function resolveWidgetPresentation(input: {
  platform: string
  release: string
}): WidgetPresentation {
  const build = Number(input.release.split('.')[2] ?? 0)
  const acrylic = input.platform === 'win32' && Number.isFinite(build) && build >= 22621
  return {
    mode: acrylic ? 'acrylic' : 'css',
    transparent: !acrylic,
    roundedCorners: acrylic,
    backgroundMaterial: acrylic ? 'acrylic' : 'none',
  }
}

export function restoreWidgetPosition(
  saved: WidgetPosition | null,
  displays: DisplayInfo[],
): WidgetPosition {
  const fallbackHeight = widgetHeight(0)
  if (displays.length === 0) {
    return saved ?? { displayId: 0, x: 80, y: 80, width: WIDGET_WIDTH, height: fallbackHeight }
  }

  const display = displays.find(item => item.id === saved?.displayId) ?? displays[0]
  const height = saved && Number.isFinite(saved.height)
    ? Math.min(widgetHeight(WIDGET_MAX_ROWS), Math.max(fallbackHeight, saved.height))
    : fallbackHeight
  const area = display.workArea
  const maxX = area.x + area.width - WIDGET_WIDTH
  const maxY = area.y + area.height - height
  const x = saved && Number.isFinite(saved.x) ? saved.x : area.x + 40
  const y = saved && Number.isFinite(saved.y) ? saved.y : area.y + 40

  return {
    displayId: display.id,
    x: Math.max(area.x, Math.min(x, maxX)),
    y: Math.max(area.y, Math.min(y, maxY)),
    width: WIDGET_WIDTH,
    height,
  }
}
