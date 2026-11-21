<script setup lang="ts">
import { ref } from 'vue'
import type { List } from '../../../../shared/tasks'

const props = defineProps<{
  lists: List[]
  selectedListId: string | null
}>()
const emit = defineEmits<{
  select: [id: string]
  create: [name: string]
  rename: [id: string, name: string]
  remove: [id: string]
}>()
const newName = ref('')
const editingId = ref<string | null>(null)
const editingName = ref('')

async function createList(): Promise<void> {
  if (!newName.value.trim()) return
  emit('create', newName.value)
  newName.value = ''
}

function beginRename(list: List): void {
  editingId.value = list.id
  editingName.value = list.name
}

function saveRename(): void {
  if (editingId.value && editingName.value.trim()) {
    emit('rename', editingId.value, editingName.value)
  }
  editingId.value = null
}

function removeList(id: string): void {
  if (window.confirm('删除清单及其中所有任务？')) emit('remove', id)
}
</script>

<template>
  <aside class="list-sidebar">
    <div class="brand">轻待办</div>
    <form class="list-create" @submit.prevent="createList">
      <input v-model="newName" aria-label="新清单名称" placeholder="新建清单" />
      <button type="submit" aria-label="添加清单">＋</button>
    </form>
    <nav class="lists" aria-label="任务清单">
      <div
        v-for="list in props.lists"
        :key="list.id"
        class="list-row"
        :class="{ selected: list.id === selectedListId }"
      >
        <template v-if="editingId === list.id">
          <input v-model="editingName" aria-label="编辑清单名称" @keyup.enter="saveRename" />
          <button type="button" @click="saveRename">保存</button>
        </template>
        <template v-else>
          <button class="list-name" type="button" @click="emit('select', list.id)">
            {{ list.name }}
          </button>
          <button class="icon-button" type="button" aria-label="重命名清单" @click="beginRename(list)">✎</button>
          <button class="icon-button" type="button" aria-label="删除清单" @click="removeList(list.id)">×</button>
        </template>
      </div>
    </nav>
  </aside>
</template>

<style scoped>
.list-sidebar { padding: 24px 14px; background: #eef1f6; border-right: 1px solid #dfe3ea; }
.brand { padding: 0 12px 24px; font-size: 24px; font-weight: 700; color: #1f2937; }
.list-create { display: flex; gap: 6px; padding: 0 6px 18px; }
.list-create input { min-width: 0; flex: 1; }
.list-row { display: flex; align-items: center; border-radius: 8px; padding: 3px 6px; gap: 2px; }
.list-row.selected { background: #dbe7ff; color: #174ca2; }
.list-name { flex: 1; text-align: left; border: 0; background: transparent; padding: 9px 6px; cursor: pointer; }
.icon-button { opacity: 0; border: 0; background: transparent; cursor: pointer; }
.list-row:hover .icon-button, .list-row.selected .icon-button { opacity: 1; }
input { border: 1px solid #cbd5e1; border-radius: 7px; padding: 8px; }
button { font: inherit; }
</style>
