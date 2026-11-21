import { describe, expect, it } from 'vitest'
import { resolveWidgetPresentation } from '../../src/shared/widget'
import type { WidgetPosition } from '../../src/shared/widget'
import { WidgetWindowController } from '../../src/main/widget-window-controller'

class FakeSettings {
  values = new Map<string, string>()
  getSetting(key: string): string | null { return this.values.get(key) ?? null }
  setSetting(key: string, value: string): void { this.values.set(key, value) }
}

class FakeWindow {
  bounds = { x: 0, y: 0, width: 520, height: 178 }
  visible = false
  inactiveShown = false
  material: string | null = null
  loaded = false
  private readonly handlers = new Map<string, (event?: { preventDefault(): void }) => void>()

  constructor(public readonly options: Record<string, unknown>) {
    this.bounds = {
      x: options.x as number,
      y: options.y as number,
      width: options.width as number,
      height: options.height as number,
    }
  }
  setBackgroundMaterial(material: string): void { this.material = material }
  setBounds(bounds: { x: number; y: number; width: number; height: number }): void { this.bounds = bounds }
  getBounds(): { x: number; y: number; width: number; height: number } { return this.bounds }
  show(): void { this.visible = true }
  showInactive(): void { this.visible = true; this.inactiveShown = true }
  hide(): void { this.visible = false }
  load(): void { this.loaded = true }
  on(event: string, handler: (event?: { preventDefault(): void }) => void): void {
    this.handlers.set(event, handler)
  }
  emit(event: string, payload?: { preventDefault(): void }): void { this.handlers.get(event)?.(payload) }
  moveTo(x: number, y: number): void {
    this.bounds = { ...this.bounds, x, y }
    this.emit('moved')
  }
}

function setup(release = '10.0.22621', hidden = false) {
  const settings = new FakeSettings()
  const windows: FakeWindow[] = []
  const displays = [{ id: 1, workArea: { x: 0, y: 0, width: 1920, height: 1080 } }]
  const screenHandlers = new Map<string, () => void>()
  const controller = new WidgetWindowController({
    presentation: resolveWidgetPresentation({ platform: 'win32', release }),
    hidden,
    settings,
    screen: {
      getAllDisplays: () => displays,
      getDisplayMatching: () => displays[0],
      on: (event, handler) => screenHandlers.set(event, handler),
    },
    createWindow: options => {
      const window = new FakeWindow(options)
      windows.push(window)
      return window
    },
    loadWindow: window => (window as FakeWindow).load(),
  })
  return { controller, settings, windows, displays, screenHandlers }
}

describe('WidgetWindowController', () => {
  it('creates a non-topmost Acrylic window without transparency on Windows 11', () => {
    const { controller, windows } = setup()
    controller.initialize()
    expect(windows[0].options).toMatchObject({
      frame: false,
      transparent: false,
      alwaysOnTop: false,
      skipTaskbar: true,
      resizable: false,
      roundedCorners: true,
      width: 520,
      height: 178,
    })
    expect(windows[0].material).toBe('acrylic')
    expect(windows[0].loaded).toBe(true)
  })

  it('uses a transparent CSS window without Acrylic on Windows 10', () => {
    const { controller, windows } = setup('10.0.19045')
    controller.initialize()
    expect(windows[0].options.transparent).toBe(true)
    expect(windows[0].options.roundedCorners).toBe(false)
    expect(windows[0].material).toBeNull()
  })

  it('caps height at eight rows and persists moved coordinates', () => {
    const { controller, settings, windows } = setup()
    controller.initialize()
    controller.setTaskCount(9)
    expect(windows[0].bounds.height).toBe(472)
    windows[0].moveTo(300, 240)
    const saved = JSON.parse(settings.getSetting('widgetPosition')!) as WidgetPosition
    expect(saved).toMatchObject({ displayId: 1, x: 300, y: 240, height: 472 })
  })

  it('hides on close and records invisibility', () => {
    const { controller, settings, windows } = setup()
    controller.initialize()
    controller.show()
    let prevented = false
    windows[0].emit('close', { preventDefault: () => { prevented = true } })
    expect(prevented).toBe(true)
    expect(windows[0].visible).toBe(false)
    expect(settings.getSetting('widgetVisible')).toBe('false')
  })

  it('shows without stealing focus during hidden login', () => {
    const { controller, windows } = setup('10.0.22621', true)
    controller.initialize()
    controller.applySettings()
    expect(windows[0].visible).toBe(true)
    expect(windows[0].inactiveShown).toBe(true)
  })

  it('clamps the saved position when display metrics change', () => {
    const { controller, settings, windows, displays, screenHandlers } = setup()
    settings.setSetting('widgetPosition', JSON.stringify({
      displayId: 99, x: 5000, y: 5000, width: 520, height: 300,
    }))
    controller.initialize()
    displays[0].workArea = { x: 0, y: 0, width: 1000, height: 700 }
    screenHandlers.get('display-metrics-changed')?.()
    expect(windows[0].bounds).toMatchObject({ x: 480, y: 400, width: 520, height: 300 })
  })
})
