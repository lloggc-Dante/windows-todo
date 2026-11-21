<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import AppSelect from './AppSelect.vue'
import DateField from './DateField.vue'
import TimeField from './TimeField.vue'
import type { List, Task, TaskCompletion, TaskPatch } from '../../../../shared/tasks'

const props = defineProps<{
  task: Task | null
  lists: List[]
}>()
const emit = defineEmits<{
  save: [patch: TaskPatch]
  move: [taskId: string, listId: string]
  remove: [taskId: string]
  undo: [taskId: string]
}>()
const listOptions = computed(() => props.lists.map(list => ({ value: list.id, label: list.name })))
const recurrenceOptions = [
  { value: '', label: '不重复' },
  { value: 'DAILY', label: '每天' },
  { value: 'WEEKLY', label: '每周' },
  { value: 'MONTHLY', label: '每月' },
  { value: 'YEARLY', label: '每年' },
]
const reminderOptions = [
  { value: '', label: '不提醒' },
  { value: '0', label: '到期时' },
  { value: '5', label: '提前 5 分钟' },
  { value: '30', label: '提前 30 分钟' },
  { value: '60', label: '提前 1 小时' },
  { value: '1440', label: '提前 1 天' },
]
const draft = reactive({
  title: '',
  notes: '',
  date: '',
  hasTime: false,
  time: '09:00',
  recurrence: '',
  reminder: '',
})

const completions = ref<TaskCompletion[]>([])
const recurrenceDirty = ref(false)
let historyRequest = 0

watch(() => props.task, async task => {
  draft.title = task?.title ?? ''
  draft.notes = task?.notes ?? ''
  draft.date = task?.dueLocal?.slice(0, 10) ?? ''
  draft.hasTime = task?.dueHasTime ?? false
  draft.time = task?.dueLocal?.includes('T') ? task.dueLocal.slice(11) : '09:00'
  draft.recurrence = task?.recurrenceRule?.match(/FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)/)?.[1] ?? ''
  draft.reminder = task?.reminderOffsetMinutes?.toString() ?? ''
  recurrenceDirty.value = false
  const request = ++historyRequest
  const history = task ? await window.appApi.listCompletions(task.id) : []
  if (request === historyRequest) completions.value = history
}, { immediate: true })

function save(): void {
  if (draft.date && draft.hasTime && !draft.time) draft.time = '09:00'
  const dueLocal = draft.date
    ? `${draft.date}${draft.hasTime ? `T${draft.time}` : ''}`
    : null
  const recurrenceRule = dueLocal && draft.recurrence
    ? (!recurrenceDirty.value && props.task?.recurrenceRule
      ? props.task.recurrenceRule
      : `FREQ=${draft.recurrence}`)
    : null
  emit('save', {
    title: draft.title,
    notes: draft.notes.trim() || null,
    dueLocal,
    dueHasTime: Boolean(draft.date && draft.hasTime),
    recurrenceRule,
    reminderOffsetMinutes: dueLocal && draft.reminder !== '' ? Number(draft.reminder) : null,
  })
}
</script>

<template>
  <aside class="task-detail">
    <template v-if="task">
      <h2>任务详情</h2>
      <label>清单</label>
      <AppSelect
        :model-value="task.listId"
        :options="listOptions"
        aria-label="所属清单"
        @update:model-value="emit('move', task.id, $event)"
      />
      <label>标题</label>
      <input v-model="draft.title" data-testid="task-title-input" />
      <label>备注</label>
      <textarea v-model="draft.notes" rows="5" placeholder="可选" />
      <label>截止日期（可选）</label>
      <DateField v-model="draft.date" data-testid="due-date-input" aria-label="截止日期" />
      <label v-if="draft.date" class="inline-field">
        <input v-model="draft.hasTime" type="checkbox" /> 指定时间
      </label>
      <TimeField v-if="draft.date && draft.hasTime" v-model="draft.time" aria-label="截止时间" />
      <template v-if="draft.date">
        <label>重复</label>
        <AppSelect
          v-model="draft.recurrence"
          :options="recurrenceOptions"
          aria-label="重复规则"
          @change="recurrenceDirty = true"
        />
        <label>提醒</label>
        <AppSelect
          v-model="draft.reminder"
          :options="reminderOptions"
          aria-label="提醒时间"
        />
      </template>
      <section class="completion-history" data-testid="completion-history">
        <h3>完成历史</h3>
        <p v-if="completions.length === 0">暂无完成记录</p>
        <div v-for="completion in completions" :key="completion.id" class="history-item">
          <span>{{ completion.occurrenceKey.replace('T', ' ') }}</span>
          <small>{{ completion.completedAt.replace('T', ' ').slice(0, 16) }}</small>
        </div>
        <button v-if="completions.length > 0" type="button" class="undo-button" @click="emit('undo', task.id)">撤销最近完成</button>
      </section>
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
.completion-history { margin-top: 22px; padding-top: 12px; border-top: 1px solid #e2e8f0; }
.completion-history h3 { font-size: 14px; }
.completion-history p { color: #94a3b8; }
.history-item { display: flex; flex-direction: column; gap: 3px; padding: 7px 0; color: #475569; }
.history-item small { color: #94a3b8; }
.undo-button { margin-top: 8px; padding: 8px 10px; border: 0; border-radius: 7px; background: #e0e9ff; color: #1d4ed8; cursor: pointer; }
.detail-actions button { flex: 1; padding: 10px; border: 0; border-radius: 7px; cursor: pointer; }
.save { background: #2563eb; color: white; }
.delete { background: #fee2e2; color: #b91c1c; }
.detail-placeholder { padding-top: 80px; color: #94a3b8; text-align: center; }
</style>

<style scoped>
:deep(.date-input-row input), :deep(.time-input-row input) {
  box-sizing: border-box;
  width: 100%;
  padding: 10px;
  border: 1px solid #cbd5e1;
  border-radius: 7px;
  background: rgb(255 255 255 / 72%);
  font: inherit;
}
</style>
