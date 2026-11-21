<script setup lang="ts">
import type { Task } from '../../../../shared/tasks'

const props = defineProps<{
  tasks: Task[]
  listHeight: number
}>()
const emit = defineEmits<{
  complete: [taskId: string]
  reorder: [orderedTaskIds: string[]]
}>()

function startDrag(taskId: string, event: DragEvent): void {
  event.dataTransfer?.setData('text/widget-task-id', taskId)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

function drop(targetId: string, event: DragEvent): void {
  const draggedId = event.dataTransfer?.getData('text/widget-task-id')
  if (!draggedId || draggedId === targetId) return
  const ids = props.tasks.map(task => task.id)
  const from = ids.indexOf(draggedId)
  const target = ids.indexOf(targetId)
  if (from < 0 || target < 0) return
  ids.splice(from, 1)
  ids.splice(target, 0, draggedId)
  emit('reorder', ids)
}
</script>

<template>
  <div
    class="widget-task-list no-drag"
    data-testid="widget-task-list"
    :style="{ height: `${listHeight}px` }"
  >
    <div v-if="tasks.length === 0" class="widget-empty">没有待办任务</div>
    <div
      v-for="task in tasks"
      :key="task.id"
      class="widget-task-row"
      draggable="true"
      @dragstart="startDrag(task.id, $event)"
      @dragover.prevent
      @drop.prevent="drop(task.id, $event)"
    >
      <span class="widget-drag" aria-hidden="true">⠿</span>
      <button type="button" class="widget-check" aria-label="完成任务" @click="emit('complete', task.id)"></button>
      <span class="widget-task-title" data-widget-task-title>{{ task.title }}</span>
      <small v-if="task.dueLocal">{{ task.dueLocal.replace('T', ' ') }}</small>
    </div>
  </div>
</template>
