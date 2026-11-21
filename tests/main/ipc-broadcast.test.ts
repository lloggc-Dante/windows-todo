import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'

const mockState = vi.hoisted(() => ({
  handlers: new Map<string, (event: unknown, ...args: unknown[]) => unknown>(),
  openFiles: [] as string[],
}))

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: (event: unknown, ...args: unknown[]) => unknown) => {
      mockState.handlers.set(channel, handler)
    },
  },
  app: { getPath: () => tmpdir() },
  dialog: {
    showOpenDialog: async () => ({ canceled: false, filePaths: mockState.openFiles }),
    showSaveDialog: async () => ({ canceled: true }),
  },
  BrowserWindow: { getAllWindows: () => [] },
}))

import type Database from 'better-sqlite3'
import { createDatabase } from '../../src/main/db/database'
import { TaskStore } from '../../src/main/db/task-store'
import { exportBackup } from '../../src/main/backup'
import { registerTaskIpc } from '../../src/main/ipc'

let db: Database.Database
let store: TaskStore
let broadcast: Mock<(excludeSenderId?: number) => void>
let directory: string

beforeEach(() => {
  mockState.handlers.clear()
  mockState.openFiles = []
  db = createDatabase(':memory:')
  store = new TaskStore(db)
  broadcast = vi.fn()
  directory = mkdtempSync(join(tmpdir(), 'windows-todo-ipc-'))
  registerTaskIpc(
    db,
    store,
    { reschedule: vi.fn().mockResolvedValue(undefined) } as never,
    { setCloseToTray: vi.fn(), setAutoStart: vi.fn() } as never,
    {} as never,
    broadcast,
  )
})

afterEach(() => {
  db.close()
  rmSync(directory, { recursive: true, force: true })
})

async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  const handler = mockState.handlers.get(channel)
  if (!handler) throw new Error(`Missing handler ${channel}`)
  return await handler({ sender: { id: 1 } }, ...args) as T
}

async function expectOneBroadcast(action: () => Promise<unknown>): Promise<void> {
  broadcast.mockClear()
  await action()
  expect(broadcast).toHaveBeenCalledTimes(1)
}

describe('task IPC broadcasts', () => {
  it('broadcasts each successful mutation exactly once', async () => {
    let list: { id: string } = { id: '' }
    await expectOneBroadcast(async () => { list = await invoke('lists:create', '待办') })
    let task: { id: string } = { id: '' }
    await expectOneBroadcast(async () => { task = await invoke('tasks:create', list.id, '任务') })
    await expectOneBroadcast(() => invoke('tasks:update', task.id, { title: '新标题' }))
    await expectOneBroadcast(() => invoke('tasks:reorder', list.id, [task.id]))
    await expectOneBroadcast(() => invoke('tasks:complete', task.id))
    await expectOneBroadcast(() => invoke('tasks:undo-completion', task.id))
    await expectOneBroadcast(() => invoke('lists:rename', list.id, '新清单'))
    await expectOneBroadcast(() => invoke('tasks:delete', task.id))
    await expectOneBroadcast(() => invoke('lists:delete', list.id))
  })

  it('does not broadcast rejected input', async () => {
    const list = await invoke<{ id: string }>('lists:create', '待办')
    const task = await invoke<{ id: string }>('tasks:create', list.id, '任务')
    broadcast.mockClear()

    await expect(invoke('tasks:update', task.id, { unknown: true })).rejects.toThrow('未知字段')
    expect(broadcast).not.toHaveBeenCalled()
  })

  it('broadcasts a completed backup replacement', async () => {
    const list = await invoke<{ id: string }>('lists:create', '待办')
    await invoke('tasks:create', list.id, '任务')
    const filename = join(directory, 'backup.json')
    await exportBackup(db, filename)
    mockState.openFiles = [filename]
    await invoke('backup:preview')

    await expectOneBroadcast(() => invoke('backup:replace'))
  })
})
