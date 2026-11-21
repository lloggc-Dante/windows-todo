export interface MainWindow {
  show(): void
  focus(): void
  isMinimized(): boolean
  restore(): void
  minimize(): void
  isMaximized(): boolean
  maximize(): void
  unmaximize(): void
  close(): void
  webContents: {
    send(channel: string, taskId: string): void
  }
}

export class WindowController {
  constructor(private readonly window: MainWindow) {}

  showMainWindow(): void {
    if (this.window.isMinimized()) this.window.restore()
    this.window.show()
    this.window.focus()
  }

  minimize(): void {
    this.window.minimize()
  }

  toggleMaximize(): void {
    if (this.window.isMaximized()) this.window.unmaximize()
    else this.window.maximize()
  }

  close(): void {
    this.window.close()
  }

  showTask(taskId: string): void {
    this.showMainWindow()
    this.window.webContents.send('tasks:select', taskId)
  }
}
