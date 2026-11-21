import type {
  DisplayInfo,
  WidgetPosition,
  WidgetPresentation,
} from '../shared/widget'
import { restoreWidgetPosition, widgetHeight, WIDGET_WIDTH } from '../shared/widget'

interface SettingsStore {
  getSetting(key: string): string | null
  setSetting(key: string, value: string): void
}

interface ScreenService {
  getAllDisplays(): DisplayInfo[]
  getDisplayMatching(bounds: { x: number; y: number; width: number; height: number }): DisplayInfo
  on(event: 'display-metrics-changed', handler: () => void): void
}

interface WidgetWindow {
  setBackgroundMaterial(material: string): void
  setBounds(bounds: { x: number; y: number; width: number; height: number }): void
  getBounds(): { x: number; y: number; width: number; height: number }
  show(): void
  showInactive(): void
  hide(): void
  on(event: string, handler: (event?: { preventDefault(): void }) => void): void
}

export interface WidgetControllerOptions {
  presentation: WidgetPresentation
  hidden: boolean
  settings: SettingsStore
  screen: ScreenService
  createWindow(options: Record<string, unknown>): WidgetWindow
  loadWindow(window: WidgetWindow): void
}

export class WidgetWindowController {
  readonly presentation: WidgetPresentation
  private window: WidgetWindow | undefined
  private taskCount = 0
  private position: WidgetPosition | null = null

  constructor(private readonly options: WidgetControllerOptions) {
    this.presentation = options.presentation
  }

  initialize(): void {
    if (this.window) return
    this.position = this.readPosition()
    const initialPosition = this.position ?? restoreWidgetPosition(null, this.options.screen.getAllDisplays())
    this.position = initialPosition
    const presentation = this.presentation
    this.window = this.options.createWindow({
      x: initialPosition.x,
      y: initialPosition.y,
      width: WIDGET_WIDTH,
      height: widgetHeight(this.taskCount),
      show: false,
      frame: false,
      transparent: presentation.transparent,
      alwaysOnTop: false,
      skipTaskbar: true,
      resizable: false,
      roundedCorners: presentation.roundedCorners,
    })
    if (presentation.backgroundMaterial === 'acrylic') {
      this.window.setBackgroundMaterial('acrylic')
    }
    this.window.on('moved', () => this.persistPosition())
    this.window.on('close', event => {
      event?.preventDefault()
      this.hide()
    })
    this.options.screen.on('display-metrics-changed', () => this.clampToDisplays())
    this.options.loadWindow(this.window)
  }

  setTaskCount(count: number): void {
    this.taskCount = count
    if (!this.window) return
    this.window.setBounds({ ...this.window.getBounds(), width: WIDGET_WIDTH, height: widgetHeight(count) })
    this.persistPosition()
  }

  show(inactive = false): void {
    this.initialize()
    this.options.settings.setSetting('widgetVisible', 'true')
    if (inactive) this.window?.showInactive()
    else this.window?.show()
  }

  hide(): void {
    this.options.settings.setSetting('widgetVisible', 'false')
    this.window?.hide()
  }

  applySettings(): void {
    if (this.options.settings.getSetting('widgetVisible') === 'false') {
      this.window?.hide()
      return
    }
    this.show(this.options.hidden)
  }

  clampToDisplays(): void {
    if (!this.window) return
    const displays = this.options.screen.getAllDisplays()
    this.position = restoreWidgetPosition(this.readPosition(), displays)
    this.window.setBounds({
      x: this.position.x,
      y: this.position.y,
      width: WIDGET_WIDTH,
      height: this.position.height,
    })
    this.persistPosition()
  }

  private readPosition(): WidgetPosition | null {
    const raw = this.options.settings.getSetting('widgetPosition')
    if (raw) {
      try {
        return JSON.parse(raw) as WidgetPosition
      } catch {
        // Invalid saved positions fall back to a visible work area.
      }
    }
    return restoreWidgetPosition(null, this.options.screen.getAllDisplays())
  }

  private persistPosition(): void {
    if (!this.window) return
    const bounds = this.window.getBounds()
    const display = this.options.screen.getDisplayMatching(bounds)
    this.position = { ...bounds, displayId: display.id }
    this.options.settings.setSetting('widgetPosition', JSON.stringify(this.position))
  }
}
