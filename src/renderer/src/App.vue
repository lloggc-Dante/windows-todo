<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import AdvancedSettings from './components/AdvancedSettings.vue'
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
const settingsOpen = ref(false)

onMounted(async () => {
  store.$onAction(({ after, onError }) => {
    after(() => { error.value = null })
    onError(reason => {
      error.value = reason instanceof Error ? reason.message : '操作失败'
    })
  })
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
    <button class="settings-toggle" data-testid="settings-toggle" type="button" aria-label="打开设置" @click="settingsOpen = true">⚙</button>
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
      @undo="store.undoCompletion"
    />
    <AdvancedSettings
      v-if="settingsOpen"
      @close="settingsOpen = false"
      @imported="store.initialize"
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
.settings-toggle { position: absolute; z-index: 12; top: 8px; right: 10px; width: 34px; height: 34px; border: 0; border-radius: 50%; background: transparent; color: #64748b; font-size: 18px; cursor: pointer; }
.settings-toggle:hover { background: #e2e8f0; }
@media (max-width: 900px) {
  .app-shell { grid-template-columns: 180px minmax(300px, 1fr); }
  .task-detail { display: none; }
}
</style>
