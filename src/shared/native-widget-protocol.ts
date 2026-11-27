import type { List, Task } from './tasks'
import type { WidgetPosition } from './widget'

export type NativeWidgetTask = Pick<Task, 'id' | 'listId' | 'title' | 'dueLocal' | 'completedAt'>

export interface NativeWidgetSnapshot {
  lists: List[]
  selectedListId: string | null
  tasks: NativeWidgetTask[]
  position: WidgetPosition
}

export type NativeWidgetCommand =
  | { type: 'init'; snapshot: NativeWidgetSnapshot }
  | { type: 'state'; snapshot: NativeWidgetSnapshot }
  | { type: 'operationResult'; action: string; success: boolean; message: string }
  | { type: 'visibility'; visible: boolean }
  | { type: 'geometry'; position: WidgetPosition }
  | { type: 'shutdown' }

export type NativeWidgetEvent =
  | { type: 'ready' }
  | { type: 'add'; title: string }
  | { type: 'complete'; taskId: string }
  | { type: 'selectList'; listId: string }
  | { type: 'reorder'; listId: string; draggedId: string; targetId: string }
  | { type: 'moved'; x: number; y: number }
  | { type: 'resized'; width: number }
  | { type: 'openMain' }
  | { type: 'hide' }
  | { type: 'error'; message: string }

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('原生贴片消息格式无效')
  }
  return value as Record<string, unknown>
}

function stringField(value: Record<string, unknown>, key: string): string {
  if (typeof value[key] !== 'string') throw new Error(`原生贴片 ${key} 无效`)
  return value[key] as string
}

function numberField(value: Record<string, unknown>, key: string): number {
  if (typeof value[key] !== 'number' || !Number.isFinite(value[key])) {
    throw new Error(`原生贴片 ${key} 无效`)
  }
  return value[key] as number
}

export function parseNativeWidgetEvent(line: string): NativeWidgetEvent {
  const value = record(JSON.parse(line))
  const type = stringField(value, 'type')
  switch (type) {
    case 'ready': return { type }
    case 'add': return { type, title: stringField(value, 'title') }
    case 'complete': return { type, taskId: stringField(value, 'taskId') }
    case 'selectList': return { type, listId: stringField(value, 'listId') }
    case 'reorder':
      return {
        type,
        listId: stringField(value, 'listId'),
        draggedId: stringField(value, 'draggedId'),
        targetId: stringField(value, 'targetId'),
      }
    case 'moved': return { type, x: numberField(value, 'x'), y: numberField(value, 'y') }
    case 'resized': return { type, width: numberField(value, 'width') }
    case 'openMain': return { type }
    case 'hide': return { type }
    case 'error': return { type, message: stringField(value, 'message') }
    default: throw new Error('未知原生贴片消息')
  }
}

function sortFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortFields)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, sortFields(entry)]))
  }
  return value
}

export function serializeNativeWidgetCommand(command: NativeWidgetCommand): string {
  return JSON.stringify(sortFields(command))
}
