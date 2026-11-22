<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import FloatingPopover from './FloatingPopover.vue'

interface SelectOption {
  value: string
  label: string
}

defineOptions({ inheritAttrs: false })
const props = defineProps<{
  modelValue: string
  options: SelectOption[]
  ariaLabel: string
}>()
const emit = defineEmits<{
  'update:modelValue': [value: string]
  change: [value: string]
}>()
const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const open = ref(false)
const activeIndex = ref(0)
const selectedLabel = computed(() =>
  props.options.find(option => option.value === props.modelValue)?.label ?? '请选择')

function outside(event: PointerEvent): void {
  if (!root.value?.contains(event.target as Node)) open.value = false
}

onMounted(() => document.addEventListener('pointerdown', outside))
onUnmounted(() => document.removeEventListener('pointerdown', outside))

async function show(): Promise<void> {
  open.value = true
  activeIndex.value = Math.max(0, props.options.findIndex(option => option.value === props.modelValue))
  await nextTick()
  root.value?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
}

function close(focus = false): void {
  open.value = false
  if (focus) trigger.value?.focus()
}

function choose(option: SelectOption): void {
  emit('update:modelValue', option.value)
  emit('change', option.value)
  close(true)
}

function keydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    close(true)
    return
  }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    if (!open.value) void show()
    else {
      const direction = event.key === 'ArrowDown' ? 1 : -1
      activeIndex.value = (activeIndex.value + direction + props.options.length) % props.options.length
    }
    return
  }
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    if (!open.value) void show()
    else if (props.options[activeIndex.value]) choose(props.options[activeIndex.value])
    return
  }
  if (event.key === 'Tab') open.value = false
}
</script>

<template>
  <div ref="root" class="app-select" @keydown="keydown">
    <button
      v-bind="$attrs"
      ref="trigger"
      type="button"
      class="app-select-trigger"
      :aria-label="ariaLabel"
      aria-haspopup="listbox"
      :aria-expanded="open"
      @click="open ? close() : show()"
    >
      <span>{{ selectedLabel }}</span><span class="app-select-chevron">⌄</span>
    </button>
    <FloatingPopover :open="open" :anchor="trigger" :max-height="240">
      <div class="app-select-popover" role="listbox" :aria-label="ariaLabel">
        <div
          v-for="(option, index) in options"
          :key="option.value"
          class="app-select-option"
          :class="{ active: index === activeIndex }"
          role="option"
          :aria-selected="option.value === modelValue"
          @pointerenter="activeIndex = index"
          @click.stop="choose(option)"
        >{{ option.label }}</div>
      </div>
    </FloatingPopover>
  </div>
</template>

<style scoped>
.app-select { position: relative; width: 100%; }
.app-select-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid rgb(203 213 225 / 80%);
  border-radius: 10px;
  color: #334155;
  background: linear-gradient(120deg, rgb(255 255 255 / 72%), rgb(244 248 255 / 46%));
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 80%);
  cursor: pointer;
}
.app-select-trigger > span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.app-select-chevron { color: #7283a0; transition: transform .16s; }
.app-select-trigger[aria-expanded='true'] .app-select-chevron { transform: rotate(180deg); }
.app-select-popover {
  position: static;
  max-height: inherit;
  overflow-y: auto;
  -webkit-app-region: no-drag;
  z-index: 60;
  top: calc(100% + 7px);
  left: 0;
  right: 0;
  max-height: inherit;
  overflow-y: auto;
  padding: 6px;
  border: 1px solid rgb(255 255 255 / 78%);
  border-radius: 13px;
  background: linear-gradient(135deg, rgb(248 251 255 / 72%), rgb(229 238 251 / 48%));
  box-shadow: 0 16px 36px rgb(30 50 80 / 22%), inset 0 1px 0 white;
  backdrop-filter: blur(30px) saturate(180%);
}
.app-select-option { padding: 8px 10px; border-radius: 8px; color: #3e526f; cursor: pointer; }
.app-select-option.active { color: #174ca2; background: rgb(255 255 255 / 58%); }
.app-select-option[aria-selected='true'] { font-weight: 600; }
</style>
