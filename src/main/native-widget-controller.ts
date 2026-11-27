import type { List, Task } from '../shared/tasks'
import type { NativeWidgetCommand, NativeWidgetEvent, NativeWidgetSnapshot } from '../shared/native-widget-protocol'
import { parseNativeWidgetEvent, serializeNativeWidgetCommand } from '../shared/native-widget-protocol'
import type { DisplayInfo, WidgetPosition } from '../shared/widget'
import { clampWidgetWidth, restoreWidgetPosition, resolveWidgetReorder, widgetHeight } from '../shared/widget'

interface SettingsStore {
  getSetting(key: string): string | null
  setSetting(key: string, value: string): void
}

interface NativeWidgetStore {
  listLists(): List[]
  listTasks(listId: string): Task[]
  createTask(listId: string, title: string): unknown
  completeTask(taskId: string, date: Date): unknown
  reorderTasks(listId: string, orderedTaskIds: string[]): unknown
}

interface ScreenService {
  getAllDisplays(): DisplayInfo[]
  getDisplayMatching(bounds: { x: number; y: number; width: number; height: number }): DisplayInfo
  on(event: 'display-metrics-changed' | 'display-added' | 'display-removed', handler: () => void): void
}

interface NativeWidgetProcess {
  stdout: { on(event: 'data', handler: (chunk: Buffer | string) => void): void }
  stdin: { write(line: string): void }
  on(event: 'exit', handler: () => void): void
  on(event: 'error', handler: (error: Error) => void): void
  kill(): void
}

export interface NativeWidgetControllerOptions {
  settings: SettingsStore
  store: NativeWidgetStore
  screen: ScreenService
  enabled?: boolean
  createProcess(): NativeWidgetProcess
  openMain(): void
  broadcast(): void
  reschedule(): Promise<void>
}

export class NativeWidgetController {
  private process: NativeWidgetProcess | undefined
  private ready = false
  private quitting = false
  private inputBuffer = ''
  private position: WidgetPosition

  constructor(private readonly options: NativeWidgetControllerOptions) {
    this.position = this.readPosition()
  }

  initialize(): void {
    const clamp = (): void => this.clampToDisplays()
    this.options.screen.on('display-metrics-changed', clamp)
    this.options.screen.on('display-added', clamp)
    this.options.screen.on('display-removed', clamp)
  }

  show(inactive = false): void {
    void inactive
    if (this.options.enabled === false) return
    this.options.settings.setSetting('widgetVisible', 'true')
    if (!this.process) this.createProcess()
    if (this.ready) this.send({ type: 'visibility', visible: true })
  }

  hide(): void {
    this.options.settings.setSetting('widgetVisible', 'false')
    this.send({ type: 'visibility', visible: false })
  }

  applySettings(): void {
    if (this.options.settings.getSetting('widgetVisible') === 'false') this.hide()
    else this.show(true)
  }

  refresh(): void {
    if (!this.ready) return
    this.send({ type: 'state', snapshot: this.snapshot() })
  }

  allowQuit(): void {
    this.quitting = true
    this.send({ type: 'shutdown' })
    this.process?.kill()
    this.process = undefined
    this.ready = false
  }

  private createProcess(): void {
    const process = this.options.createProcess()
    this.process = process
    this.ready = false
    this.inputBuffer = ''
    process.stdout.on('data', chunk => this.readStdout(chunk))
    process.on('error', error => {
      if (this.process !== process) return
      this.process = undefined
      this.ready = false
      this.options.settings.setSetting('widgetVisible', 'false')
      console.error('原生贴片进程错误', error)
    })
    process.on('exit', () => {
      if (this.process !== process) return
      this.process = undefined
      this.ready = false
      this.inputBuffer = ''
      if (!this.quitting && this.options.settings.getSetting('widgetVisible') !== 'false') {
        this.options.settings.setSetting('widgetVisible', 'false')
        console.error('原生贴片进程已退出')
      }
    })
  }

  private readStdout(chunk: Buffer | string): void {
    this.inputBuffer += chunk.toString()
    let newline = this.inputBuffer.indexOf('\n')
    while (newline >= 0) {
      const line = this.inputBuffer.slice(0, newline).trim()
      this.inputBuffer = this.inputBuffer.slice(newline + 1)
      if (line) {
        try {
          const event = parseNativeWidgetEvent(line)
          void this.handleEvent(event)
        } catch (error) {
          console.error('原生贴片消息无效', error)
        }
      }
      newline = this.inputBuffer.indexOf('\n')
    }
  }

  private async handleEvent(event: NativeWidgetEvent): Promise<void> {
    if (event.type === 'ready') {
      this.ready = true
      this.send({ type: 'init', snapshot: this.snapshot() })
      this.send({ type: 'visibility', visible: true })
      return
    }
    if (event.type === 'openMain') {
      this.options.openMain()
      return
    }
    if (event.type === 'hide') {
      this.hide()
      return
    }
    if (event.type === 'moved') {
      const bounds = { ...this.position, x: event.x, y: event.y }
      const display = this.options.screen.getDisplayMatching(bounds)
      this.position = restoreWidgetPosition({ ...bounds, displayId: display.id }, this.options.screen.getAllDisplays())
      this.persistPosition()
      this.send({ type: 'geometry', position: this.position })
      return
    }
    if (event.type === 'resized') {
      const bounds = { ...this.position, width: clampWidgetWidth(event.width) }
      const display = this.options.screen.getDisplayMatching(bounds)
      this.position = restoreWidgetPosition({ ...bounds, displayId: display.id }, this.options.screen.getAllDisplays())
      this.persistPosition()
      this.send({ type: 'geometry', position: this.position })
      return
    }
    if (event.type === 'error') {
      console.error('原生贴片错误', event.message)
      return
    }

    try {
      switch (event.type) {
        case 'add':
          this.options.store.createTask(this.selectedListId(), event.title)
          break
        case 'complete':
          this.options.store.completeTask(event.taskId, new Date())
          break
        case 'selectList':
          if (!this.options.store.listLists().some(list => list.id === event.listId)) throw new Error('清单不存在')
          this.options.settings.setSetting('widgetSelectedList', event.listId)
          this.refresh()
          break
        case 'reorder': {
          const ids = await resolveWidgetReorder(
            event.draggedId,
            event.targetId,
            () => Promise.resolve(this.options.store.listTasks(event.listId)),
          )
          this.options.store.reorderTasks(event.listId, ids)
          break
        }
      }
      this.send({ type: 'operationResult', action: event.type, success: true, message: '' })
      if (event.type !== 'selectList') {
        this.options.broadcast()
        await this.options.reschedule()
        this.refresh()
      }
    } catch (error) {
      this.send({
        type: 'operationResult',
        action: event.type,
        success: false,
        message: error instanceof Error ? error.message : '操作失败',
      })
      this.refresh()
    }
  }

  private snapshot(): NativeWidgetSnapshot {
    const selectedListId = this.selectedListId()
    const tasks = this.options.store.listTasks(selectedListId).filter(task => task.completedAt === null)
    const bounds = { ...this.position, height: widgetHeight(tasks.length) }
    const display = this.options.screen.getDisplayMatching(bounds)
    this.position = restoreWidgetPosition({
      ...bounds,
      displayId: display.id,
    }, this.options.screen.getAllDisplays())
    return {
      lists: this.options.store.listLists(),
      selectedListId,
      tasks,
      position: this.position,
    }
  }

  private selectedListId(): string {
    const lists = this.options.store.listLists()
    const saved = this.options.settings.getSetting('widgetSelectedList')
    return lists.some(list => list.id === saved) ? saved! : lists[0]?.id ?? ''
  }

  private clampToDisplays(): void {
    this.position = restoreWidgetPosition(this.position, this.options.screen.getAllDisplays())
    this.persistPosition()
    this.send({ type: 'geometry', position: this.position })
  }

  private readPosition(): WidgetPosition {
    const raw = this.options.settings.getSetting('widgetPosition')
    if (raw) {
      try {
        return restoreWidgetPosition(JSON.parse(raw) as WidgetPosition, this.options.screen.getAllDisplays())
      } catch {
        // Invalid saved positions fall back to a visible work area.
      }
    }
    return restoreWidgetPosition(null, this.options.screen.getAllDisplays())
  }

  private persistPosition(): void {
    this.options.settings.setSetting('widgetPosition', JSON.stringify(this.position))
  }

  private send(command: NativeWidgetCommand): void {
    if (!this.process) return
    try {
      this.process.stdin.write(serializeNativeWidgetCommand(command) + '\n')
    } catch (error) {
      console.error('原生贴片写入失败', error)
      this.process = undefined
      this.ready = false
      this.options.settings.setSetting('widgetVisible', 'false')
    }
  }
}
