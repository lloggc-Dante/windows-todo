import { describe, expect, it } from 'vitest'
import { WindowController } from '../../src/main/window-controller'
import { WindowsIntegration } from '../../src/main/windows-integration'

class FakeApp {
  quitRequested = false
  lockAvailable = true
  loginSettings: Record<string, unknown> | undefined
  private readonly handlers = new Map<string, () => void>()

  quit(): void {
    this.quitRequested = true
  }

  requestSingleInstanceLock(): boolean {
    return this.lockAvailable
  }

  setLoginItemSettings(settings: Record<string, unknown>): void {
    this.loginSettings = settings
  }

  on(event: string, handler: () => void): void {
    this.handlers.set(event, handler)
  }

  emit(event: string): void {
    this.handlers.get(event)?.()
  }
}

function createWindow() {
  const window = {
    hidden: false,
    visible: false,
    focused: false,
    restored: false,
    selectedTask: null as string | null,
    hide() {
      this.hidden = true
    },
    show() {
      this.visible = true
    },
    focus() {
      this.focused = true
    },
    isMinimized() {
      return true
    },
    restore() {
      this.restored = true
    },
    webContents: {
      send: (channel: string, taskId: string) => {
        if (channel === 'tasks:select') window.selectedTask = taskId
      },
    },
  }
  return window
}

describe('WindowsIntegration', () => {
  it('hides on close by default and really quits from the tray', () => {
    const app = new FakeApp()
    const window = createWindow()
    const integration = new WindowsIntegration(app, window, new WindowController(window))
    let prevented = false
    const closeEvent = { preventDefault: () => { prevented = true } }

    integration.handleClose(closeEvent)
    expect(prevented).toBe(true)
    expect(window.hidden).toBe(true)

    integration.quit()
    prevented = false
    integration.handleClose(closeEvent)
    expect(app.quitRequested).toBe(true)
    expect(prevented).toBe(false)
  })

  it('can be configured to close normally instead of using the tray', () => {
    const integration = new WindowsIntegration(new FakeApp(), createWindow(), new WindowController(createWindow()))
    integration.setCloseToTray(false)
    let prevented = false

    integration.handleClose({ preventDefault: () => { prevented = true } })

    expect(prevented).toBe(false)
  })

  it('configures hidden login auto-start in both directions', () => {
    const app = new FakeApp()
    const integration = new WindowsIntegration(app, createWindow(), new WindowController(createWindow()))

    integration.setAutoStart(true)
    expect(app.loginSettings).toEqual({ openAtLogin: true, args: ['--hidden'] })
    integration.setAutoStart(false)
    expect(app.loginSettings).toEqual({ openAtLogin: false, args: ['--hidden'] })
  })

  it('restores the existing window on a second instance', () => {
    const app = new FakeApp()
    const window = createWindow()
    const controller = new WindowController(window)
    const integration = new WindowsIntegration(app, window, controller)

    expect(integration.claimSingleInstance()).toBe(true)
    app.emit('second-instance')
    expect(window.visible).toBe(true)
    expect(window.focused).toBe(true)

    const otherApp = new FakeApp()
    otherApp.lockAvailable = false
    const other = new WindowsIntegration(otherApp, createWindow(), controller)
    expect(other.claimSingleInstance()).toBe(false)
    expect(otherApp.quitRequested).toBe(true)
  })
})

describe('WindowController', () => {
  it('restores, focuses, and selects a task in the existing window', () => {
    const window = createWindow()
    const controller = new WindowController(window)

    controller.showTask('task-123')

    expect(window.restored).toBe(true)
    expect(window.visible).toBe(true)
    expect(window.focused).toBe(true)
    expect(window.selectedTask).toBe('task-123')
  })
})
