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
.list-sidebar {
  min-height: 0;
  padding: 20px 12px;
  border: 1px solid rgb(255 255 255 / 62%);
  border-radius: 18px;
  color: #66778d;
  background: linear-gradient(145deg, rgb(255 255 255 / 42%), rgb(244 248 252 / 24%));
  box-shadow: inset 0 1px rgb(255 255 255 / 72%), 0 10px 28px rgb(52 73 99 / 7%);
}
.brand { padding: 0 10px 25px; color: #22334a; font-size: 23px; font-weight: 700; letter-spacing: -.04em; }
.list-create { display: flex; gap: 6px; padding: 0 4px 18px; }
.list-create input { min-width: 0; flex: 1; }
.list-row { display: flex; align-items: center; gap: 2px; margin: 4px 0; padding: 3px 5px; border: 1px solid transparent; border-radius: 11px; }
.list-row.selected { border-color: rgb(255 255 255 / 72%); color: #315fae; background: linear-gradient(135deg, rgb(255 255 255 / 64%), rgb(224 236 252 / 44%)); box-shadow: 0 5px 15px rgb(59 84 120 / 8%), inset 0 1px #fff; font-weight: 650; }
.list-name { flex: 1; padding: 9px 6px; border: 0; background: transparent; text-align: left; cursor: pointer; }
.icon-button { opacity: 0; border: 0; background: transparent; cursor: pointer; }
.list-row:hover .icon-button, .list-row.selected .icon-button { opacity: 1; }
input { padding: 8px; border: 1px solid rgb(255 255 255 / 65%); border-radius: 10px; outline: 0; background: rgb(255 255 255 / 38%); }
input:focus { border-color: #fff; background: rgb(255 255 255 / 58%); }
button { font: inherit; }
</style>
