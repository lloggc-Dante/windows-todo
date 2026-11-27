import { describe, expect, it, vi } from 'vitest'
import { WindowController } from '../../src/main/window-controller'
import { appUserModelId, handleStartupFailure, WindowsIntegration } from '../../src/main/windows-integration'

describe('application identity', () => {
  it('keeps development shortcuts separate from the installed app', () => {
    expect(appUserModelId(true)).toBe('com.windows-todo.app')
    expect(appUserModelId(false)).toBe('com.windows-todo.app.dev')
  })
})

class FakeApp {
  quitRequested = false
  lockAvailable = true
  exitCode: number | null = null
  loginSettings: Record<string, unknown> | undefined
  private readonly handlers = new Map<string, () => void>()

  quit(): void {
    this.quitRequested = true
  }

  exit(code: number): void {
    this.exitCode = code
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
    destroyed: false,
    visible: false,
    focused: false,
    restored: false,
    selectedTask: null as string | null,
    hide() {
      this.hidden = true
    },
    destroy() {
      this.destroyed = true
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
    minimize() {},
    isMaximized() { return false },
    maximize() {},
    unmaximize() {},
    close() {},
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
    expect(window.destroyed).toBe(true)
    prevented = false
    integration.handleClose(closeEvent)
    expect(app.quitRequested).toBe(true)
    expect(prevented).toBe(false)
  })

  it('quits the whole app instead of destroying the main window when tray closing is disabled', () => {
    const app = new FakeApp()
    const integration = new WindowsIntegration(app, createWindow(), new WindowController(createWindow()))
    integration.setCloseToTray(false)
    let prevented = false

    integration.handleClose({ preventDefault: () => { prevented = true } })

    expect(prevented).toBe(true)
    expect(app.quitRequested).toBe(true)
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


describe('startup failures', () => {
  it('shows a useful database error, destroys the blank window, and exits', () => {
    const app = new FakeApp()
    const window = { destroyed: false, destroy() { this.destroyed = true } }
    let errorMessage = ''
    const dialog = {
      showErrorBox(title: string, message: string) {
        errorMessage = `${title}: ${message}`
      },
    }

    handleStartupFailure(app, dialog, window, new Error('数据库版本较新'))

    expect(errorMessage).toContain('无法打开待办数据')
    expect(errorMessage).toContain('数据库版本较新')
    expect(window.destroyed).toBe(true)
    expect(app.quitRequested).toBe(true)
  })
})


describe('immediate quit', () => {
  it('exits with code zero even if graceful quit would fail', () => {
    const app = new FakeApp()
    app.quit = () => {
      throw new Error('不应调用可能卡住的 app.quit')
    }
    const integration = new WindowsIntegration(app, createWindow(), new WindowController(createWindow()))
    expect(() => integration.quit()).not.toThrow()
    expect(app.exitCode).toBe(0)
  })

  it('runs native widget and database cleanup before immediate exit', () => {
    const app = new FakeApp()
    const integration = new WindowsIntegration(app, createWindow(), new WindowController(createWindow()))
    let cleaned = false
    integration.setBeforeQuit(() => { cleaned = true })
    integration.quit()
    expect(cleaned).toBe(true)
    expect(app.exitCode).toBe(0)
  })

  it('exits immediately with code zero', () => {
    const app = new FakeApp()
    const integration = new WindowsIntegration(app, createWindow(), new WindowController(createWindow()))
    integration.quit()
    expect(app.exitCode).toBe(0)
  })
})
