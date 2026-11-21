<script setup lang="ts">
import { ref } from 'vue'
import type { Task } from '../../../../shared/tasks'

const props = defineProps<{
  activeTasks: Task[]
  completedTasks: Task[]
  selectedTaskId: string | null
  showCompleted: boolean
}>()
const emit = defineEmits<{
  add: [title: string]
  select: [id: string]
  complete: [id: string]
  reorder: [ids: string[]]
  toggleCompleted: []
  undo: [id: string]
}>()
const title = ref('')

function addTask(): void {
  if (!title.value.trim()) return
  emit('add', title.value)
  title.value = ''
}

function startDrag(taskId: string, event: DragEvent): void {
  event.dataTransfer?.setData('text/task-id', taskId)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

function drop(targetId: string, event: DragEvent): void {
  const draggedId = event.dataTransfer?.getData('text/task-id')
  if (!draggedId || draggedId === targetId) return
  const ids = props.activeTasks.map(task => task.id)
  const from = ids.indexOf(draggedId)
  const target = ids.indexOf(targetId)
  if (from < 0 || target < 0) return
  ids.splice(from, 1)
  ids.splice(target, 0, draggedId)
  emit('reorder', ids)
}
</script>

<template>
  <section class="task-panel">
    <form class="quick-add" @submit.prevent="addTask">
      <input
        v-model="title"
        data-testid="quick-add-input"
        aria-label="添加任务"
        placeholder="添加任务，回车保存"
      />
      <button type="submit">添加</button>
    </form>

    <div v-if="activeTasks.length === 0" class="empty-state">没有待办任务，轻松一下吧。</div>
    <div data-testid="active-task-list" class="task-list">
      <div
        v-for="task in activeTasks"
        :key="task.id"
        class="task-item"
        :class="{ selected: task.id === selectedTaskId }"
        draggable="true"
        @dragstart="startDrag(task.id, $event)"
        @dragover.prevent
        @drop.prevent="drop(task.id, $event)"
        @click="emit('select', task.id)"
      >
        <button type="button" class="complete-button" aria-label="完成任务" @click.stop="emit('complete', task.id)">○</button>
        <span class="drag-handle" aria-hidden="true">⠿</span>
        <div class="task-copy">
          <div data-task-title>{{ task.title }}</div>
          <small v-if="task.dueLocal">{{ task.dueLocal.replace('T', ' ') }}<span v-if="task.recurrenceRule"> · 重复</span></small>
        </div>
      </div>
    </div>

    <button
      v-if="completedTasks.length > 0"
      type="button"
      data-testid="completed-toggle"
      class="completed-toggle"
      @click="emit('toggleCompleted')"
    >
      {{ showCompleted ? '▾' : '▸' }} 已完成 {{ completedTasks.length }}
    </button>
    <div v-show="showCompleted" data-testid="completed-task-list" class="completed-list">
      <div v-for="task in completedTasks" :key="task.id" class="completed-item">
        <span>{{ task.title }}</span>
        <button type="button" @click="emit('undo', task.id)">撤销完成</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.task-panel { min-width: 0; overflow-y: auto; padding: 26px 24px; background: #fff; }
.quick-add { display: flex; gap: 10px; margin-bottom: 22px; }
.quick-add input { flex: 1; min-width: 0; padding: 12px 14px; border: 1px solid #cbd5e1; border-radius: 9px; }
.quick-add button { border: 0; border-radius: 9px; padding: 0 18px; background: #2563eb; color: white; cursor: pointer; }
.empty-state { padding: 48px 0; color: #94a3b8; text-align: center; }
.task-item { display: flex; align-items: center; gap: 10px; padding: 13px 10px; border-bottom: 1px solid #edf0f4; border-radius: 7px; cursor: pointer; }
.task-item:hover { background: #f8fafc; }
.task-item.selected { background: #edf4ff; }
.complete-button { border: 0; background: transparent; color: #2563eb; font-size: 22px; cursor: pointer; }
.drag-handle { color: #cbd5e1; cursor: grab; }
.task-copy { min-width: 0; }
.task-copy small { color: #64748b; }
.completed-toggle { width: 100%; margin-top: 20px; padding: 12px; border: 0; background: transparent; color: #64748b; text-align: left; cursor: pointer; }
.completed-item { display: flex; justify-content: space-between; padding: 10px; color: #94a3b8; }
.completed-item span { text-decoration: line-through; }
.completed-item button { border: 0; background: transparent; color: #2563eb; cursor: pointer; }
</style>
