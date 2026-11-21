import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { List, Task, TaskPatch } from '../../../shared/tasks'

export const useTasksStore = defineStore('tasks', () => {
  const lists = ref<List[]>([])
  const tasks = ref<Task[]>([])
  const selectedListId = ref<string | null>(null)
  const selectedTaskId = ref<string | null>(null)
  const showCompleted = ref(false)
  const error = ref<string | null>(null)

  const activeTasks = computed(() => tasks.value.filter(task => !task.completedAt))
  const completedTasks = computed(() => tasks.value.filter(task => task.completedAt))
  const selectedTask = computed(() => tasks.value.find(task => task.id === selectedTaskId.value) ?? null)

  async function initialize(): Promise<void> {
    lists.value = await window.appApi.listLists()
    if (lists.value.length === 0) {
      const list = await window.appApi.createList('我的待办')
      lists.value = [list]
    }
    await selectList(lists.value[0].id)
  }

  async function refresh(): Promise<void> {
    const previousListId = selectedListId.value
    lists.value = await window.appApi.listLists()
    if (lists.value.length === 0) {
      const list = await window.appApi.createList('我的待办')
      lists.value = [list]
    }
    const nextListId: string = previousListId !== null && lists.value.some(list => list.id === previousListId)
      ? previousListId
      : lists.value[0].id
    if (nextListId !== selectedListId.value) {
      await selectList(nextListId)
      return
    }
    tasks.value = await window.appApi.listTasks(nextListId)
    if (!tasks.value.some(task => task.id === selectedTaskId.value)) selectedTaskId.value = null
  }

  async function selectList(listId: string): Promise<void> {
    selectedListId.value = listId
    selectedTaskId.value = null
    showCompleted.value = false
    tasks.value = await window.appApi.listTasks(listId)
  }

  async function addList(name: string): Promise<void> {
    const list = await window.appApi.createList(name)
    lists.value = await window.appApi.listLists()
    await selectList(list.id)
  }

  async function renameList(id: string, name: string): Promise<void> {
    await window.appApi.renameList(id, name)
    lists.value = await window.appApi.listLists()
  }

  async function deleteList(id: string): Promise<void> {
    await window.appApi.deleteList(id)
    lists.value = await window.appApi.listLists()
    if (lists.value.length === 0) {
      const list = await window.appApi.createList('我的待办')
      lists.value = [list]
    }
    await selectList(lists.value[0].id)
  }

  async function addTask(title: string): Promise<void> {
    if (!selectedListId.value) return
    const task = await window.appApi.createTask(selectedListId.value, title)
    tasks.value = await window.appApi.listTasks(selectedListId.value)
    selectedTaskId.value = task.id
  }

  async function updateSelected(patch: TaskPatch): Promise<void> {
    if (!selectedTaskId.value || !selectedListId.value) return
    await window.appApi.updateTask(selectedTaskId.value, patch)
    tasks.value = await window.appApi.listTasks(selectedListId.value)
  }

  async function deleteTask(taskId: string): Promise<void> {
    if (!selectedListId.value) return
    await window.appApi.deleteTask(taskId)
    selectedTaskId.value = null
    tasks.value = await window.appApi.listTasks(selectedListId.value)
  }

  async function completeTask(taskId: string): Promise<void> {
    if (!selectedListId.value) return
    const completed = await window.appApi.completeTask(taskId)
    if (selectedTaskId.value === taskId && completed?.completedAt) selectedTaskId.value = null
    tasks.value = await window.appApi.listTasks(selectedListId.value)
  }

  async function undoCompletion(taskId: string): Promise<void> {
    if (!selectedListId.value) return
    await window.appApi.undoLatestCompletion(taskId)
    tasks.value = await window.appApi.listTasks(selectedListId.value)
  }

  async function reorder(orderedTaskIds: string[]): Promise<void> {
    if (!selectedListId.value) return
    await window.appApi.reorderTasks(selectedListId.value, orderedTaskIds)
    tasks.value = await window.appApi.listTasks(selectedListId.value)
  }

  async function moveTask(taskId: string, targetListId: string): Promise<void> {
    await window.appApi.moveTaskToList(taskId, targetListId)
    await selectList(targetListId)
    selectedTaskId.value = taskId
  }

  async function selectTaskById(taskId: string): Promise<void> {
    for (const list of lists.value) {
      const listTasks = await window.appApi.listTasks(list.id)
      if (listTasks.some(task => task.id === taskId)) {
        await selectList(list.id)
        selectedTaskId.value = taskId
        return
      }
    }
  }

  return {
    lists,
    tasks,
    selectedListId,
    selectedTaskId,
    showCompleted,
    error,
    activeTasks,
    completedTasks,
    selectedTask,
    initialize,
    refresh,
    selectList,
    addList,
    renameList,
    deleteList,
    addTask,
    updateSelected,
    deleteTask,
    completeTask,
    undoCompletion,
    reorder,
    moveTask,
    selectTaskById,
  }
})
