export interface MainWindow {
  show(): void
  focus(): void
  isMinimized(): boolean
  restore(): void
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

  showTask(taskId: string): void {
    this.showMainWindow()
    this.window.webContents.send('tasks:select', taskId)
  }
}
