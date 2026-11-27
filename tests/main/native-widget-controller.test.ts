import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import { NativeWidgetController } from '../../src/main/native-widget-controller'
import type { List, Task } from '../../src/shared/tasks'

class FakeProcess extends EventEmitter {
  stdout = new EventEmitter()
  writes: string[] = []
  killed = false
  stdin = { write: (line: string) => { this.writes.push(line) } }
  kill(): void { this.killed = true }
  emitLine(value: unknown): void { this.stdout.emit('data', JSON.stringify(value) + '\n') }
  commands(): Array<Record<string, unknown>> {
    return this.writes.map(line => JSON.parse(line) as Record<string, unknown>)
  }
}

class FakeStore {
  values = new Map<string, string>()
  lists: List[] = [{ id: 'list-1', name: '我的待办', createdAt: '', updatedAt: '' }]
  tasks: Task[] = [makeTask('task-1', '任务一'), makeTask('task-2', '任务二')]
  failAdd = false
  getSetting(key: string): string | null { return this.values.get(key) ?? null }
  setSetting(key: string, value: string): void { this.values.set(key, value) }
  listLists(): List[] { return this.lists }
  listTasks(listId: string): Task[] { return this.tasks.filter(task => task.listId === listId) }
  createTask(listId: string, title: string): Task {
    if (this.failAdd) throw new Error('添加失败')
    const task = makeTask(`task-${this.tasks.length + 1}`, title)
    this.tasks.unshift(task)
    return task
  }
  completeTask(id: string): Task | null {
    const task = this.tasks.find(item => item.id === id)
    if (!task) throw new Error('任务不存在')
    task.completedAt = new Date().toISOString()
    return task
  }
  reorderTasks(listId: string, ids: string[]): Task[] {
    const ordered = ids.map(id => this.tasks.find(task => task.id === id && task.listId === listId)!)
    this.tasks = [...ordered, ...this.tasks.filter(task => !ids.includes(task.id))]
    return ordered
  }
}

function makeTask(id: string, title: string): Task {
  return {
    id, listId: 'list-1', title, notes: null, dueLocal: null, dueHasTime: false,
    recurrenceRule: null, seriesStart: null, reminderOffsetMinutes: null,
    sortOrder: 0, completedAt: null, createdAt: '', updatedAt: '',
  }
}

function setup() {
  const store = new FakeStore()
  const processes: FakeProcess[] = []
  const displays = [
    { id: 1, workArea: { x: 0, y: 0, width: 1920, height: 1080 } },
    { id: 2, workArea: { x: 1920, y: 0, width: 1280, height: 1080 } },
  ]
  const broadcast = vi.fn()
  const reschedule = vi.fn(() => Promise.resolve())
  const openMain = vi.fn()
  const controller = new NativeWidgetController({
    settings: store,
    store,
    screen: {
      getAllDisplays: () => displays,
      getDisplayMatching: bounds => displays.find(display => {
        const centerX = bounds.x + bounds.width / 2
        return centerX >= display.workArea.x && centerX < display.workArea.x + display.workArea.width
      }) ?? displays[0],
      on: () => undefined,
    },
    createProcess: () => {
      const process = new FakeProcess()
      processes.push(process)
      return process
    },
    openMain,
    broadcast,
    reschedule,
  })
  controller.initialize()
  return { controller, store, processes, broadcast, reschedule, openMain }
}

async function flush(): Promise<void> {
  await new Promise(resolve => setImmediate(resolve))
  await new Promise(resolve => setImmediate(resolve))
}

describe('NativeWidgetController', () => {
  it('buffers split stdout and sends init after ready', () => {
    const { controller, processes } = setup()
    controller.show()
    const process = processes[0]
    process.stdout.emit('data', '{"type":"re')
    expect(process.writes).toHaveLength(0)
    process.stdout.emit('data', 'ady"}\n')
    const commands = process.commands()
    expect(commands[0].type).toBe('init')
    expect((commands[0].snapshot as { tasks: Task[] }).tasks).toHaveLength(2)
  })

  it('maps add and complete operations and publishes refreshed state', async () => {
    const { controller, store, processes, broadcast, reschedule } = setup()
    controller.show()
    processes[0].emitLine({ type: 'ready' })
    processes[0].emitLine({ type: 'add', title: '中文任务' })
    await flush()
    expect(store.tasks[0].title).toBe('中文任务')
    expect(broadcast).toHaveBeenCalled()
    expect(reschedule).toHaveBeenCalled()
    expect(processes[0].commands().some(command => command.type === 'state')).toBe(true)
    processes[0].emitLine({ type: 'complete', taskId: 'task-1' })
    await flush()
    expect(store.tasks.find(task => task.id === 'task-1')?.completedAt).not.toBeNull()
  })

  it('returns a failed add result without losing composer content', async () => {
    const { controller, store, processes } = setup()
    store.failAdd = true
    controller.show()
    processes[0].emitLine({ type: 'ready' })
    processes[0].emitLine({ type: 'add', title: '保留这段文字' })
    await flush()
    expect(processes[0].commands()).toContainEqual({
      type: 'operationResult', action: 'add', success: false, message: '添加失败',
    })
  })

  it('resolves reorder against the latest database tasks', async () => {
    const { controller, store, processes } = setup()
    store.tasks.push(makeTask('task-3', '并发新增'))
    controller.show()
    processes[0].emitLine({ type: 'ready' })
    processes[0].emitLine({ type: 'reorder', listId: 'list-1', draggedId: 'task-2', targetId: 'task-1' })
    await flush()
    expect(store.tasks.map(task => task.id)).toEqual(['task-2', 'task-1', 'task-3'])
  })

  it('switches lists, opens main, hides, and recreates after process exit', async () => {
    const { controller, store, processes, openMain } = setup()
    store.lists.push({ id: 'list-2', name: '生活', createdAt: '', updatedAt: '' })
    controller.show()
    processes[0].emitLine({ type: 'ready' })
    processes[0].emitLine({ type: 'selectList', listId: 'list-2' })
    processes[0].emitLine({ type: 'openMain' })
    await flush()
    expect(store.getSetting('widgetSelectedList')).toBe('list-2')
    expect(openMain).toHaveBeenCalled()
    controller.hide()
    expect(store.getSetting('widgetVisible')).toBe('false')
    processes[0].emit('exit')
    controller.show()
    expect(processes).toHaveLength(2)
    expect(store.getSetting('widgetVisible')).toBe('true')
  })

  it('moves onto the display matching the new bounds instead of the saved display', () => {
    const { controller, store, processes } = setup()
    controller.show()
    processes[0].emitLine({ type: 'ready' })
    processes[0].emitLine({ type: 'moved', x: 2200, y: 100 })
    expect(JSON.parse(store.getSetting('widgetPosition')!)).toMatchObject({ displayId: 2, x: 2200, y: 100 })
    expect(processes[0].commands().at(-1)).toMatchObject({ type: 'geometry', position: { displayId: 2, x: 2200 } })
  })

  it('resets a failed child process and allows a later retry', () => {
    const { controller, store, processes } = setup()
    controller.show()
    processes[0].emit('error', new Error('spawn failed'))
    expect(store.getSetting('widgetVisible')).toBe('false')
    controller.show()
    expect(processes).toHaveLength(2)
  })

  it('persists moved geometry, clamps width, and shuts down cleanly', () => {
    const { controller, store, processes } = setup()
    controller.show()
    processes[0].emitLine({ type: 'ready' })
    processes[0].emitLine({ type: 'moved', x: 120, y: 160 })
    processes[0].emitLine({ type: 'resized', width: 900 })
    expect(JSON.parse(store.getSetting('widgetPosition')!)).toMatchObject({ x: 120, y: 160, width: 480 })
    controller.allowQuit()
    expect(processes[0].commands().at(-1)?.type).toBe('shutdown')
    expect(processes[0].killed).toBe(true)
  })
})
