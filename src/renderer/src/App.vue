<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import ListSidebar from './components/ListSidebar.vue'
import TaskDetail from './components/TaskDetail.vue'
import TaskList from './components/TaskList.vue'
import { useTasksStore } from './stores/tasks'

const store = useTasksStore()
const {
  lists,
  selectedListId,
  selectedTaskId,
  selectedTask,
  activeTasks,
  completedTasks,
  showCompleted,
  error,
} = storeToRefs(store)
let unsubscribe: (() => void) | undefined

onMounted(async () => {
  try {
    await store.initialize()
    unsubscribe = window.appApi.onSelectTask(taskId => {
      void store.selectTaskById(taskId)
    })
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '应用初始化失败'
  }
})

onUnmounted(() => unsubscribe?.())
</script>

<template>
  <main class="app-shell" data-testid="app-shell">
    <div v-if="error" class="error-banner" role="alert">{{ error }}</div>
    <ListSidebar
      :lists="lists"
      :selected-list-id="selectedListId"
      @select="store.selectList"
      @create="store.addList"
      @rename="store.renameList"
      @remove="store.deleteList"
    />
    <TaskList
      :active-tasks="activeTasks"
      :completed-tasks="completedTasks"
      :selected-task-id="selectedTaskId"
      :show-completed="showCompleted"
      @add="store.addTask"
      @select="store.selectedTaskId = $event"
      @complete="store.completeTask"
      @reorder="store.reorder"
      @toggle-completed="store.showCompleted = !store.showCompleted"
      @undo="store.undoCompletion"
    />
    <TaskDetail
      :task="selectedTask"
      :lists="lists"
      @save="store.updateSelected"
      @move="store.moveTask"
      @remove="store.deleteTask"
    />
  </main>
</template>

<style>
:root {
  font-family: "Segoe UI", "Microsoft YaHei", sans-serif;
  color: #202124;
  background: #f5f6f8;
  font-synthesis: none;
}

* { box-sizing: border-box; }
body { margin: 0; }
button, input, textarea, select { font: inherit; }
.app-shell { position: relative; display: grid; grid-template-columns: 220px minmax(320px, 1fr) 320px; height: 100vh; overflow: hidden; }
.error-banner { position: absolute; z-index: 10; top: 8px; left: 50%; transform: translateX(-50%); padding: 10px 18px; border-radius: 8px; background: #fee2e2; color: #991b1b; }
@media (max-width: 900px) {
  .app-shell { grid-template-columns: 180px minmax(300px, 1fr); }
  .task-detail { display: none; }
}
</style>
