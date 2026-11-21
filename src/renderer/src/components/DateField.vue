<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { calendarMonth, validCalendarDate } from '../date-picker'

defineOptions({ inheritAttrs: false })
const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const root = ref<HTMLElement | null>(null)
const text = ref(props.modelValue)
const lastValid = ref(validCalendarDate(props.modelValue) ? props.modelValue : '')
const open = ref(false)
const viewDate = ref(new Date())
const year = computed(() => viewDate.value.getFullYear())
const month = computed(() => viewDate.value.getMonth())
const days = computed(() => calendarMonth(year.value, month.value))

watch(() => props.modelValue, value => {
  text.value = value
  if (validCalendarDate(value)) lastValid.value = value
})

function outside(event: PointerEvent): void {
  if (!root.value?.contains(event.target as Node)) open.value = false
}
onMounted(() => document.addEventListener('pointerdown', outside))
onUnmounted(() => document.removeEventListener('pointerdown', outside))

function input(value: string): void {
  text.value = value
  if (validCalendarDate(value)) lastValid.value = value
  emit('update:modelValue', value)
}

function blur(): void {
  if (!text.value || validCalendarDate(text.value)) {
    lastValid.value = text.value
    emit('update:modelValue', text.value)
  } else {
    text.value = lastValid.value
    emit('update:modelValue', lastValid.value)
  }
}

function show(): void {
  const source = validCalendarDate(props.modelValue) ? new Date(`${props.modelValue}T00:00:00`) : new Date()
  viewDate.value = new Date(source.getFullYear(), source.getMonth(), 1)
  open.value = true
}

function moveMonth(offset: number): void {
  viewDate.value = new Date(year.value, month.value + offset, 1)
}

function choose(date: string): void {
  lastValid.value = date
  text.value = date
  emit('update:modelValue', date)
  open.value = false
}

function clear(): void {
  text.value = ''
  lastValid.value = ''
  emit('update:modelValue', '')
  open.value = false
}
</script>

<template>
  <div ref="root" class="date-field" @keydown.esc="open = false">
    <div class="date-input-row">
      <input
        v-bind="$attrs"
        :value="text"
        type="text"
        inputmode="numeric"
        placeholder="YYYY-MM-DD"
        @input="input(($event.target as HTMLInputElement).value)"
        @blur="blur"
      />
      <button type="button" aria-label="打开日历" @click="open ? open = false : show()">▦</button>
      <button v-if="text" type="button" aria-label="清除日期" @click="clear">×</button>
    </div>
    <div v-if="open" class="date-popover">
      <header><button type="button" aria-label="上个月" @click="moveMonth(-1)">‹</button><strong>{{ year }} 年 {{ month + 1 }} 月</strong><button type="button" aria-label="下个月" @click="moveMonth(1)">›</button></header>
      <div class="weekdays"><span v-for="day in ['一','二','三','四','五','六','日']" :key="day">{{ day }}</span></div>
      <div class="calendar-grid">
        <button
          v-for="day in days"
          :key="day.date"
          type="button"
          :class="{ outside: !day.inMonth, selected: day.date === modelValue }"
          @click="choose(day.date)"
        >{{ Number(day.date.slice(-2)) }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.date-field { position: relative; }
.date-input-row { display: flex; gap: 6px; }
.date-input-row input { min-width: 0; flex: 1; }
.date-input-row button, .date-popover button { border: 0; border-radius: 7px; color: #526277; background: rgb(241 245 249 / 75%); cursor: pointer; }
.date-input-row button { width: 34px; }
.date-popover { position: absolute; z-index: 65; top: calc(100% + 8px); left: 0; width: 282px; padding: 12px; border: 1px solid #ffffffc9; border-radius: 16px; background: linear-gradient(135deg,#f8fbfff5,#e5eefbea); box-shadow: 0 18px 40px #1e325038; backdrop-filter: blur(24px); }
.date-popover header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.date-popover header button { width: 30px; height: 28px; }
.weekdays, .calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; text-align: center; }
.weekdays { margin-bottom: 5px; color: #8290a5; font-size: 11px; }
.calendar-grid button { height: 30px; background: transparent; }
.calendar-grid button:hover { background: #ffffffb8; }
.calendar-grid button.outside { color: #a5b0c0; }
.calendar-grid button.selected { color: white; background: linear-gradient(135deg,#79a7f4,#827be4); }
</style>
