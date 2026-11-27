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
    <TransitionGroup tag="div" name="task-list" data-testid="active-task-list" class="task-list">
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
    </TransitionGroup>

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
.task-panel {
  min-width: 0;
  overflow-y: auto;
  padding: 24px 20px;
  border: 1px solid rgb(255 255 255 / 78%);
  border-radius: 18px;
  background: linear-gradient(145deg, rgb(255 255 255 / 72%), rgb(250 253 255 / 46%));
  box-shadow: inset 0 1px #fff, 0 14px 34px rgb(48 68 96 / 10%);
}
.quick-add { display: flex; gap: 10px; margin-bottom: 20px; padding: 5px; border: 1px solid rgb(255 255 255 / 82%); border-radius: 14px; background: rgb(255 255 255 / 38%); box-shadow: inset 0 1px #fff, 0 5px 16px rgb(63 81 109 / 5%); }
.quick-add input { flex: 1; min-width: 0; padding: 8px 11px; border: 0; outline: 0; color: #26364e; background: transparent; }
.quick-add button { padding: 0 18px; border: 1px solid rgb(255 255 255 / 24%); border-radius: 10px; color: white; background: linear-gradient(135deg, #5687df, #4c6fc8); box-shadow: 0 5px 13px rgb(66 106 190 / 20%), inset 0 1px rgb(255 255 255 / 30%); cursor: pointer; }
.empty-state { padding: 48px 0; color: #8b99aa; text-align: center; }
.task-item { display: flex; align-items: center; gap: 10px; min-height: 49px; margin: 6px 0; padding: 10px 11px; border: 1px solid rgb(255 255 255 / 42%); border-radius: 12px; background: linear-gradient(135deg, rgb(255 255 255 / 25%), rgb(247 251 255 / 14%)); box-shadow: inset 0 1px rgb(255 255 255 / 48%); cursor: pointer; }
.task-item:hover { border-color: rgb(255 255 255 / 72%); background: linear-gradient(135deg, rgb(255 255 255 / 48%), rgb(240 247 255 / 30%)); }
.task-item.selected { border-color: rgb(255 255 255 / 92%); background: linear-gradient(135deg, rgb(255 255 255 / 80%), rgb(220 234 253 / 56%)); box-shadow: 0 8px 18px rgb(56 80 116 / 10%), inset 3px 0 #5d86cf; }
.task-item.selected [data-task-title] { color: #285ba9; font-weight: 650; }
.complete-button { flex: none; width: 20px; height: 20px; padding: 0; border: 1px solid #86a4d7; border-radius: 50%; background: rgb(255 255 255 / 22%); color: transparent; cursor: pointer; }
.complete-button:hover { border-color: #4f6fd4; background: #6a91ee; }
.drag-handle { color: #aebccc; cursor: grab; }
.task-copy { min-width: 0; }
.task-copy small { color: #8291a3; }
.completed-toggle { width: 100%; margin-top: 16px; padding: 12px; border: 0; background: transparent; color: #7d8b9d; text-align: left; cursor: pointer; }
.completed-item { display: flex; justify-content: space-between; padding: 10px; color: #94a3b8; }
.completed-item span { text-decoration: line-through; }
.completed-item button { border: 0; background: transparent; color: #2563eb; cursor: pointer; }
</style>
