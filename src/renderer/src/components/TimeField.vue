<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import FloatingPopover from './FloatingPopover.vue'

defineOptions({ inheritAttrs: false })
const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{
  'update:modelValue': [value: string]
  change: [value: string]
}>()
const root = ref<HTMLElement | null>(null)
const text = ref(props.modelValue)
const lastValid = ref(props.modelValue)
const open = ref(false)
const hours = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0'))
const minutes = Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, '0'))

watch(() => props.modelValue, value => { text.value = value; if (valid(value)) lastValid.value = value })
function valid(value: string): boolean { return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value) }
function outside(event: PointerEvent): void { if (!root.value?.contains(event.target as Node)) open.value = false }
onMounted(() => document.addEventListener('pointerdown', outside))
onUnmounted(() => document.removeEventListener('pointerdown', outside))

function input(value: string): void {
  text.value = value
  if (valid(value)) lastValid.value = value
  emit('update:modelValue', value)
}
function blur(): void {
  if (valid(text.value)) {
    lastValid.value = text.value
    emit('change', text.value)
  } else { text.value = lastValid.value; emit('update:modelValue', lastValid.value) }
}
function chooseHour(hour: string): void {
  const value = `${hour}:${valid(text.value) ? text.value.slice(3) : '00'}`
  text.value = value
  lastValid.value = value
  emit('update:modelValue', value)
  emit('change', value)
}
function chooseMinute(minute: string): void {
  const value = `${valid(text.value) ? text.value.slice(0, 2) : '09'}:${minute}`
  text.value = value
  lastValid.value = value
  emit('update:modelValue', value)
  emit('change', value)
  open.value = false
}
</script>

<template>
  <div ref="root" class="time-field" @keydown.esc="open = false">
    <div class="time-input-row">
      <input v-bind="$attrs" :value="text" type="text" inputmode="numeric" placeholder="HH:mm" @input="input(($event.target as HTMLInputElement).value)" @blur="blur" />
      <button type="button" aria-label="打开时间选择" @click="open = !open">◷</button>
    </div>
    <FloatingPopover :open="open" :anchor="root" :max-height="230" :width="220">
      <div class="time-popover">
      <div><strong>时</strong><button v-for="hour in hours" :key="hour" type="button" :aria-label="`${hour} 时`" @click="chooseHour(hour)">{{ hour }}</button></div>
      <div><strong>分</strong><button v-for="minute in minutes" :key="minute" type="button" :aria-label="`${minute} 分`" @click="chooseMinute(minute)">{{ minute }}</button></div>
      </div>
    </FloatingPopover>
  </div>
</template>

<style scoped>
.time-field { position: relative; }
.time-input-row { display: flex; gap: 6px; }
.time-input-row input { min-width: 0; flex: 1; }
.time-input-row button { width: 36px; border: 0; border-radius: 7px; color: #526277; background: #f1f5f9bf; cursor: pointer; }
.time-popover { position: static; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; width: 100%; height: 100%; max-height: inherit; padding: 12px; border: 1px solid #ffffffc9; border-radius: 16px; background: linear-gradient(135deg,#f8fbffcf,#e5eefb96); box-shadow: 0 18px 40px #1e325038; backdrop-filter: blur(24px); }
.time-popover > div { overflow-y: auto; scrollbar-width: thin; }
.time-popover strong { display: block; padding: 4px; color: #8290a5; text-align: center; }
.time-popover button { width: 100%; padding: 6px; border: 0; border-radius: 7px; color: #425b78; background: transparent; cursor: pointer; }
.time-popover button:hover { background: #ffffffb8; }
</style>
