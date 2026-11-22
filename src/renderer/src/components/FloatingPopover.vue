<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  open: boolean
  anchor: HTMLElement | null
  maxHeight?: number
  width?: number
}>(), { maxHeight: 240 })
const style = ref<Record<string, string>>({})

async function update(): Promise<void> {
  if (!props.open || !props.anchor) return
  await nextTick()
  const rect = props.anchor.getBoundingClientRect()
  const width = Math.min(props.width ?? rect.width, window.innerWidth - 16)
  const below = window.innerHeight - rect.bottom - 8
  const above = rect.top - 8
  const upward = below < Math.min(props.maxHeight, 200) && above > below
  const available = Math.max(80, upward ? above : below)
  const maxHeight = Math.min(props.maxHeight, available)
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))
  const top = upward
    ? Math.max(8, rect.top - maxHeight - 8)
    : Math.min(rect.bottom + 8, window.innerHeight - maxHeight - 8)
  style.value = {
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
    maxHeight: `${maxHeight}px`,
  }
}

watch(() => [props.open, props.anchor], () => void update(), { immediate: true })
onMounted(() => {
  window.addEventListener('resize', update)
  window.addEventListener('scroll', update, true)
})
onUnmounted(() => {
  window.removeEventListener('resize', update)
  window.removeEventListener('scroll', update, true)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="glass-popover">
      <div v-if="open" class="floating-popover" :style="style" @pointerdown.stop>
        <slot />
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.floating-popover {
  position: fixed;
  z-index: 100;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  -webkit-app-region: no-drag;
}
.floating-popover > * { min-height: 0; }
</style>
