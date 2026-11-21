<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import type { AppSettings } from '../../../../shared/contracts'
import type { BackupPreview } from '../../../../shared/backup'

const emit = defineEmits<{
  close: []
  imported: []
}>()
const settings = reactive<AppSettings>({
  closeToTray: true,
  autoStart: false,
  notificationsEnabled: true,
  dateOnlyReminderTime: '09:00',
})
const preview = ref<BackupPreview | null>(null)
const status = ref('')
const busy = ref(false)

onMounted(async () => {
  Object.assign(settings, await window.appApi.getSettings())
})

async function saveSettings(): Promise<void> {
  Object.assign(settings, await window.appApi.updateSettings({ ...settings }))
}

async function exportData(): Promise<void> {
  busy.value = true
  try {
    const exported = await window.appApi.exportBackup()
    status.value = exported ? '备份已导出' : '已取消导出'
  } finally {
    busy.value = false
  }
}

async function chooseBackup(): Promise<void> {
  busy.value = true
  try {
    preview.value = await window.appApi.previewBackup()
    status.value = preview.value ? '请核对备份内容，导入将替换全部数据' : '已取消导入'
  } finally {
    busy.value = false
  }
}

async function confirmImport(): Promise<void> {
  if (!window.confirm('确定替换当前全部数据吗？此操作无法撤销。')) return
  busy.value = true
  try {
    await window.appApi.replaceFromBackup()
    preview.value = null
    status.value = '导入完成'
    emit('imported')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="settings-backdrop" @click.self="emit('close')">
    <section class="settings-panel" data-testid="settings-panel" aria-label="设置">
      <header>
        <h2>设置</h2>
        <button type="button" aria-label="关闭设置" @click="emit('close')">×</button>
      </header>
      <label class="setting-row">
        <span>关闭窗口时隐藏到托盘</span>
        <input v-model="settings.closeToTray" type="checkbox" @change="saveSettings" />
      </label>
      <label class="setting-row">
        <span>登录 Windows 后自动启动</span>
        <input v-model="settings.autoStart" type="checkbox" @change="saveSettings" />
      </label>
      <label class="setting-row">
        <span>启用 Windows 系统通知</span>
        <input v-model="settings.notificationsEnabled" type="checkbox" @change="saveSettings" />
      </label>
      <label class="setting-row">
        <span>仅日期任务的提醒时间</span>
        <input v-model="settings.dateOnlyReminderTime" type="time" @change="saveSettings" />
      </label>

      <details data-testid="advanced-settings" class="advanced-settings">
        <summary data-testid="advanced-toggle">高级与数据管理</summary>
        <div data-testid="advanced-backup-controls" class="backup-controls">
          <p>备份仅在你主动操作时创建。导入会替换当前全部数据。</p>
          <div class="backup-actions">
            <button type="button" :disabled="busy" @click="exportData">导出备份</button>
            <button type="button" :disabled="busy" @click="chooseBackup">导入备份</button>
          </div>
          <div v-if="preview" class="backup-preview">
            <strong>备份内容</strong>
            <span>{{ preview.listCount }} 个清单</span>
            <span>{{ preview.taskCount }} 个任务</span>
            <span>{{ preview.completionCount }} 条完成历史</span>
            <button type="button" :disabled="busy" @click="confirmImport">确认替换全部数据</button>
          </div>
          <p v-if="status" role="status">{{ status }}</p>
        </div>
      </details>
    </section>
  </div>
</template>

<style scoped>
.settings-backdrop { position: fixed; z-index: 30; inset: 0; display: grid; place-items: center; background: rgb(15 23 42 / 35%); }
.settings-panel { width: min(520px, 90vw); max-height: 85vh; overflow-y: auto; padding: 24px; border-radius: 14px; background: white; box-shadow: 0 24px 70px rgb(15 23 42 / 25%); }
header { display: flex; align-items: center; justify-content: space-between; }
h2 { margin: 0; }
header button { border: 0; background: transparent; font-size: 24px; cursor: pointer; }
.setting-row { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 15px 0; border-bottom: 1px solid #edf0f4; }
.advanced-settings { margin-top: 22px; color: #475569; }
summary { padding: 12px 0; cursor: pointer; user-select: none; }
.backup-controls { padding: 12px; border-radius: 9px; background: #f8fafc; }
.backup-actions { display: flex; gap: 10px; }
.backup-actions button, .backup-preview button { padding: 9px 12px; border: 1px solid #cbd5e1; border-radius: 7px; background: white; cursor: pointer; }
.backup-preview { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; padding: 14px; background: #fff7ed; color: #9a3412; }
[role='status'] { color: #2563eb; }
</style>
