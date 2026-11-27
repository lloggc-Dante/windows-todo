import { expect, test } from '@playwright/test'
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { serializeNativeWidgetCommand } from '../../src/shared/native-widget-protocol'

test('native layered widget accepts Unicode state and recovers from an invalid command', async () => {
  const child = spawn(join(process.cwd(), 'native-widget/bin/LightTodo.Widget.exe'), [], {
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  })
  const events: Array<{ type: string; message?: string }> = []
  let buffer = ''
  child.stdout.on('data', chunk => {
    buffer += chunk.toString()
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() ?? ''
    for (const line of lines) if (line) events.push(JSON.parse(line))
  })
  try {
    await expect.poll(() => events.some(event => event.type === 'ready')).toBe(true)
    const tasks = Array.from({ length: 9 }, (_, index) => ({
      id: `task-${index}`,
      listId: 'list-1',
      title: index === 0 ? '原生中文任务' : `任务 ${index}`,
      dueLocal: null,
      completedAt: null,
    }))
    child.stdin.write(serializeNativeWidgetCommand({
      type: 'init',
      snapshot: {
        lists: [{ id: 'list-1', name: '我的待办', createdAt: '', updatedAt: '' }],
        selectedListId: 'list-1',
        tasks,
        position: { displayId: 4239051520, x: 80, y: 80, width: 360, height: 472 },
      },
    }) + '\n')
    child.stdin.write('{"type":"invalid-command"}\n')
    await expect.poll(() => events.some(event => event.type === 'error')).toBe(true)
    const exited = new Promise<number | null>(resolve => child.once('exit', resolve))
    child.stdin.write(serializeNativeWidgetCommand({ type: 'shutdown' }) + '\n')
    expect(await exited).toBe(0)
    expect(events.filter(event => event.type === 'error')).toHaveLength(1)
  } finally {
    if (child.exitCode === null) child.kill()
  }
})
