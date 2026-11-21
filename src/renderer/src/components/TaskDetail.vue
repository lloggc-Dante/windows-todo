<script setup lang="ts">
import { reactive, watch } from 'vue'
import type { List, Task, TaskPatch } from '../../../../shared/tasks'

const props = defineProps<{
  task: Task | null
  lists: List[]
}>()
const emit = defineEmits<{
  save: [patch: TaskPatch]
  move: [taskId: string, listId: string]
  remove: [taskId: string]
}>()
const draft = reactive({
  title: '',
  notes: '',
  date: '',
  hasTime: false,
  time: '09:00',
  recurrence: '',
  reminder: '',
})

watch(() => props.task, task => {
  draft.title = task?.title ?? ''
  draft.notes = task?.notes ?? ''
  draft.date = task?.dueLocal?.slice(0, 10) ?? ''
  draft.hasTime = task?.dueHasTime ?? false
  draft.time = task?.dueLocal?.includes('T') ? task.dueLocal.slice(11) : '09:00'
  draft.recurrence = task?.recurrenceRule?.match(/FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)/)?.[1] ?? ''
  draft.reminder = task?.reminderOffsetMinutes?.toString() ?? ''
}, { immediate: true })

function save(): void {
  const dueLocal = draft.date
    ? `${draft.date}${draft.hasTime ? `T${draft.time}` : ''}`
    : null
  emit('save', {
    title: draft.title,
    notes: draft.notes.trim() || null,
    dueLocal,
    dueHasTime: Boolean(draft.date && draft.hasTime),
    recurrenceRule: dueLocal && draft.recurrence ? `FREQ=${draft.recurrence}` : null,
    reminderOffsetMinutes: dueLocal && draft.reminder !== '' ? Number(draft.reminder) : null,
  })
}
</script>

<template>
  <aside class="task-detail">
    <template v-if="task">
      <h2>任务详情</h2>
      <label>清单</label>
      <select :value="task.listId" aria-label="所属清单" @change="emit('move', task.id, ($event.target as HTMLSelectElement).value)">
        <option v-for="list in lists" :key="list.id" :value="list.id">{{ list.name }}</option>
      </select>
      <label>标题</label>
      <input v-model="draft.title" data-testid="task-title-input" />
      <label>备注</label>
      <textarea v-model="draft.notes" rows="5" placeholder="可选" />
      <label>截止日期（可选）</label>
      <input v-model="draft.date" data-testid="due-date-input" type="date" />
      <label v-if="draft.date" class="inline-field">
        <input v-model="draft.hasTime" type="checkbox" /> 指定时间
      </label>
      <input v-if="draft.date && draft.hasTime" v-model="draft.time" type="time" aria-label="截止时间" />
      <template v-if="draft.date">
        <label>重复</label>
        <select v-model="draft.recurrence" aria-label="重复规则">
          <option value="">不重复</option>
          <option value="DAILY">每天</option>
          <option value="WEEKLY">每周</option>
          <option value="MONTHLY">每月</option>
          <option value="YEARLY">每年</option>
        </select>
        <label>提醒</label>
        <select v-model="draft.reminder" aria-label="提醒时间">
          <option value="">不提醒</option>
          <option value="0">到期时</option>
          <option value="5">提前 5 分钟</option>
          <option value="30">提前 30 分钟</option>
          <option value="60">提前 1 小时</option>
          <option value="1440">提前 1 天</option>
        </select>
      </template>
      <div class="detail-actions">
        <button class="save" type="button" @click="save">保存</button>
        <button class="delete" type="button" @click="emit('remove', task.id)">删除</button>
      </div>
    </template>
    <div v-else class="detail-placeholder">选择一个任务查看详情</div>
  </aside>
</template>

<style scoped>
.task-detail { overflow-y: auto; padding: 26px 22px; background: #f8fafc; border-left: 1px solid #e2e8f0; }
h2 { margin: 0 0 22px; font-size: 18px; }
label { display: block; margin: 14px 0 6px; color: #64748b; font-size: 13px; }
input:not([type='checkbox']), textarea, select { box-sizing: border-box; width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 7px; background: white; font: inherit; }
textarea { resize: vertical; }
.inline-field { display: flex; align-items: center; gap: 6px; }
.detail-actions { display: flex; gap: 10px; margin-top: 24px; }
.detail-actions button { flex: 1; padding: 10px; border: 0; border-radius: 7px; cursor: pointer; }
.save { background: #2563eb; color: white; }
.delete { background: #fee2e2; color: #b91c1c; }
.detail-placeholder { padding-top: 80px; color: #94a3b8; text-align: center; }
</style>
