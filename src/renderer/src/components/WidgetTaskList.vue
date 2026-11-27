<script setup lang="ts">
import type { Task } from '../../../../shared/tasks'
import { resolveWidgetReorder } from '../../../shared/widget'

const props = defineProps<{
  tasks: Task[]
  listId: string | null
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

async function drop(targetId: string, event: DragEvent): Promise<void> {
  const draggedId = event.dataTransfer?.getData('text/widget-task-id')
  if (!draggedId || draggedId === targetId || !props.listId) return
  const listId = props.listId
  const ids = await resolveWidgetReorder(
    draggedId,
    targetId,
    () => window.appApi.listTasks(listId),
  )
  emit('reorder', ids)
}
</script>

<template>
  <div
    class="widget-task-list"
    :class="{ 'no-drag': tasks.length > 0 }"
    data-testid="widget-task-list"
    :style="{ height: `${listHeight}px` }"
  >
    <div v-if="tasks.length === 0" class="widget-empty">没有待办任务</div>
    <TransitionGroup tag="div" name="task-list" class="widget-task-rows">
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
    </TransitionGroup>
  </div>
</template>
