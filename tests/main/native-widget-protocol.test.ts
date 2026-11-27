import { describe, expect, it } from 'vitest'
import {
  parseNativeWidgetEvent,
  serializeNativeWidgetCommand,
} from '../../src/shared/native-widget-protocol'

describe('native widget protocol', () => {
  it.each([
    ['ready', { type: 'ready' }],
    ['add', { type: 'add', title: '中文任务' }],
    ['complete', { type: 'complete', taskId: 'task-1' }],
    ['selectList', { type: 'selectList', listId: 'list-1' }],
    ['reorder', { type: 'reorder', listId: 'list-1', draggedId: 'task-1', targetId: 'task-2' }],
    ['moved', { type: 'moved', x: 40, y: 80 }],
    ['resized', { type: 'resized', width: 360 }],
    ['openMain', { type: 'openMain' }],
    ['hide', { type: 'hide' }],
    ['error', { type: 'error', message: '显示失败' }],
  ])('parses %s events', (_name, event) => {
    expect(parseNativeWidgetEvent(JSON.stringify(event))).toEqual(event)
  })

  it.each([
    ['invalid JSON', '{'],
    ['unknown event', JSON.stringify({ type: 'unknown' })],
    ['missing title', JSON.stringify({ type: 'add' })],
    ['missing reorder target', JSON.stringify({ type: 'reorder', listId: 'list-1', draggedId: 'task-1' })],
    ['invalid coordinates', JSON.stringify({ type: 'moved', x: '40', y: 80 })],
    ['non-finite width', '{"type":"resized","width":Infinity}'],
    ['array envelope', '[]'],
  ])('rejects %s', (_name, line) => {
    expect(() => parseNativeWidgetEvent(line)).toThrow()
  })

  it('uses stable alphabetical field order for deterministic protocol output', () => {
    const line = serializeNativeWidgetCommand({
      type: 'geometry',
      position: { displayId: 1, x: 40, y: 80, width: 360, height: 178 },
    })
    expect(line.indexOf('"position"')).toBeLessThan(line.indexOf('"type"'))
    expect(line.indexOf('"height"')).toBeLessThan(line.indexOf('"x"'))
  })

  it('serializes commands with Unicode and escaped newlines', () => {
    const line = serializeNativeWidgetCommand({
      type: 'operationResult',
      action: 'add',
      success: false,
      message: '第一行\n第二行',
    })
    expect(line).toContain('第一行\\n第二行')
    expect(line).not.toContain('第一行\n第二行')
    expect(JSON.parse(line)).toMatchObject({ action: 'add', success: false })
  })
})
