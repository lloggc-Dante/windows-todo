import type { WindowController } from './window-controller'

interface CloseEvent {
  preventDefault(): void
}

interface ClosableWindow {
  hide(): void
}

interface IntegrationApp {
  quit(): void
  requestSingleInstanceLock(): boolean
  setLoginItemSettings(settings: { openAtLogin: boolean; args: string[] }): void
  on(event: 'second-instance', handler: () => void): void
}

export class WindowsIntegration {
  private closeToTray = true
  private quitting = false

  constructor(
    private readonly app: IntegrationApp,
    private readonly window: ClosableWindow,
    private readonly controller: WindowController,
  ) {}

  handleClose(event: CloseEvent): void {
    if (!this.closeToTray || this.quitting) return
    event.preventDefault()
    this.window.hide()
  }

  setCloseToTray(enabled: boolean): void {
    this.closeToTray = enabled
  }

  setAutoStart(enabled: boolean): void {
    this.app.setLoginItemSettings({ openAtLogin: enabled, args: ['--hidden'] })
  }

  claimSingleInstance(): boolean {
    if (!this.app.requestSingleInstanceLock()) {
      this.app.quit()
      return false
    }
    this.app.on('second-instance', () => this.controller.showMainWindow())
    return true
  }

  allowQuit(): void {
    this.quitting = true
  }

  quit(): void {
    this.allowQuit()
    this.app.quit()
  }
}
