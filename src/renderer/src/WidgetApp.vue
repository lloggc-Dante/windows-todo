<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { widgetRows } from '../../shared/widget'
import type { WidgetPresentation } from '../../shared/widget'
import WidgetTaskList from './components/WidgetTaskList.vue'
import { useTasksStore } from './stores/tasks'

const store = useTasksStore()
const { lists, activeTasks, selectedListId } = storeToRefs(store)
const presentation = ref<WidgetPresentation>({
  mode: 'css',
  transparent: true,
  roundedCorners: false,
  backgroundMaterial: 'none',
})
const title = ref('')
const actionError = ref('')
const listHeight = computed(() => widgetRows(activeTasks.value.length) * 42)
let unsubscribe: (() => void) | undefined

watch(() => activeTasks.value.length, async count => {
  await nextTick()
  await window.appApi.setWidgetTaskCount(count)
}, { immediate: true })

onMounted(async () => {
  presentation.value = await window.appApi.getWidgetPresentation()
  await store.initialize()
  const savedList = await window.appApi.getWidgetSelectedList()
  if (savedList && lists.value.some(list => list.id === savedList)) {
    await store.selectList(savedList)
  } else if (selectedListId.value) {
    await window.appApi.setWidgetSelectedList(selectedListId.value)
  }
  unsubscribe = window.appApi.onTasksChanged(() => {
    void (async () => {
      await store.refresh()
      const refreshedList = await window.appApi.getWidgetSelectedList()
      if (refreshedList && refreshedList !== selectedListId.value
        && lists.value.some(list => list.id === refreshedList)) {
        await store.selectList(refreshedList)
      }
    })()
  })
})

onUnmounted(() => unsubscribe?.())

function errorText(reason: unknown): string {
  return reason instanceof Error ? reason.message : '操作失败，请重试'
}

function openMain(): void {
  void window.appApi.openMainWindow()
}

function hideWidget(): void {
  void window.appApi.hideWidget()
}

async function reorder(ids: string[]): Promise<void> {
  try {
    actionError.value = ''
    await store.reorder(ids)
  } catch (reason) {
    actionError.value = errorText(reason)
    await store.refresh()
  }
}

function beginResize(event: PointerEvent): void {
  event.preventDefault()
  const startX = event.clientX
  const startWidth = document.documentElement.clientWidth
  const onMove = (moveEvent: PointerEvent): void => {
    void window.appApi.setWidgetWidth(startWidth + moveEvent.clientX - startX)
  }
  const onUp = (): void => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}

async function addTask(): Promise<void> {
  if (!title.value.trim()) return
  const value = title.value
  try {
    actionError.value = ''
    await store.addTask(value)
    title.value = ''
  } catch (reason) {
    actionError.value = errorText(reason)
  }
}

async function selectList(event: Event): Promise<void> {
  const listId = (event.target as HTMLSelectElement).value
  await store.selectList(listId)
  await window.appApi.setWidgetSelectedList(listId)
}
</script>

<template>
  <main class="widget-shell" :class="`mode-${presentation.mode}`" data-testid="desktop-widget">
    <header class="widget-header">
      <span class="widget-grip" aria-hidden="true">⠿</span>
      <select
        class="no-drag widget-list-select"
        data-testid="widget-list-select"
        aria-label="贴片清单"
        :value="selectedListId"
        @change="selectList"
      >
        <option v-for="list in lists" :key="list.id" :value="list.id">{{ list.name }}</option>
      </select>
      <span class="widget-count">{{ activeTasks.length }} 项</span>
      <button class="no-drag widget-menu-button" type="button" title="打开主窗口" @click="openMain">↗</button>
      <button class="no-drag widget-menu-button" type="button" title="隐藏贴片" @click="hideWidget">×</button>
    </header>

    <WidgetTaskList
      :tasks="activeTasks"
      :list-id="selectedListId"
      :list-height="listHeight"
      @complete="store.completeTask"
      @reorder="reorder"
    />

    <form class="widget-composer no-drag" @submit.prevent="addTask">
      <input
        v-model="title"
        data-testid="widget-quick-add"
        aria-label="贴片添加任务"
        placeholder="添加新待办，回车保存"
      />
      <button type="submit" aria-label="贴片添加">＋</button>
    </form>
    <div class="widget-resize-handle no-drag" data-testid="widget-resize-handle" @pointerdown="beginResize"></div>
    <div v-if="actionError" class="widget-error" role="status">{{ actionError }}</div>
  </main>
</template>
