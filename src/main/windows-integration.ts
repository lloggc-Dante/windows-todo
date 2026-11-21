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
    if (this.quitting) return
    event.preventDefault()
    if (!this.closeToTray) {
      this.quit()
      return
    }
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


interface StartupDialog {
  showErrorBox(title: string, message: string): void
}

interface StartupWindow {
  destroy(): void
}

export function handleStartupFailure(
  app: Pick<IntegrationApp, 'quit'>,
  dialog: StartupDialog,
  window: StartupWindow,
  error: unknown,
): void {
  const detail = error instanceof Error ? error.message : String(error)
  dialog.showErrorBox(
    '无法打开待办数据',
    `${detail}\n\n请使用手动备份恢复数据，或备份数据目录后联系维护者。应用将退出，不会重置数据库。`,
  )
  window.destroy()
  app.quit()
}
