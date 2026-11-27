<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import AdvancedSettings from './components/AdvancedSettings.vue'
import WindowTitlebar from './components/WindowTitlebar.vue'
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
let unsubscribeTasks: (() => void) | undefined
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
    unsubscribeTasks = window.appApi.onTasksChanged(() => {
      void store.refresh()
    })
    unsubscribe = window.appApi.onSelectTask(taskId => {
      void store.selectTaskById(taskId)
    })
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '应用初始化失败'
  }
})

onUnmounted(() => {
  unsubscribe?.()
  unsubscribeTasks?.()
})
</script>

<template>
  <main class="app-shell" data-testid="app-shell">
    <WindowTitlebar />
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
  background: #e8edf3;
  font-synthesis: none;
}

* { box-sizing: border-box; }
body { margin: 0; }
button, input, textarea, select { font: inherit; }
.app-shell {
  position: relative;
  display: grid;
  grid-template-columns: 220px minmax(320px, 1fr) 320px;
  gap: 14px;
  height: 100vh;
  padding: 54px 14px 14px;
  overflow: hidden;
  background:
    radial-gradient(circle at 8% 0%, rgb(203 224 246 / 72%), transparent 36%),
    radial-gradient(circle at 95% 10%, rgb(231 212 237 / 54%), transparent 38%),
    linear-gradient(145deg, #e7edf4, #f3eff5 52%, #e3edf0);
}
.error-banner { position: absolute; z-index: 10; top: 48px; left: 50%; transform: translateX(-50%); padding: 10px 18px; border-radius: 8px; background: #fee2e2; color: #991b1b; }
.settings-toggle { position: absolute; z-index: 12; top: 48px; right: 10px; width: 34px; height: 34px; border: 0; border-radius: 50%; background: transparent; color: #64748b; font-size: 18px; cursor: pointer; }
.settings-toggle:hover { background: #e2e8f0; }
* { scrollbar-width: thin; scrollbar-color: rgb(100 116 139 / 35%) transparent; }
::-webkit-scrollbar { width: 7px; height: 7px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { border-radius: 999px; background: rgb(100 116 139 / 32%); }
::-webkit-scrollbar-thumb:hover { background: rgb(100 116 139 / 52%); }
input[type='checkbox'] {
  appearance: none;
  position: relative;
  width: 38px;
  height: 22px;
  margin: 0;
  border: 1px solid rgb(148 163 184 / 60%);
  border-radius: 999px;
  background: #cbd5e1;
  box-shadow: inset 0 1px 3px rgb(51 65 85 / 15%);
  cursor: pointer;
  transition: background .18s, border-color .18s;
}
input[type='checkbox']::before {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: linear-gradient(145deg, #fff, #edf3fb);
  box-shadow: 0 2px 5px rgb(30 50 80 / 25%);
  transition: transform .18s;
}
input[type='checkbox']:checked { border-color: #6f8fea; background: linear-gradient(135deg, #79a7f4, #827be4); }
input[type='checkbox']:checked::before { transform: translateX(16px); }
input[type='checkbox']:focus-visible { outline: 2px solid #8ab6ff; outline-offset: 3px; }
@media (max-width: 900px) {
  .app-shell { grid-template-columns: 180px minmax(300px, 1fr); }
  .task-detail { display: none; }
}
</style>
