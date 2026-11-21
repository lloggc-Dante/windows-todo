<script setup lang="ts">
function minimize(): void { void window.appApi.minimizeWindow() }
function toggleMaximize(): void { void window.appApi.toggleMaximizeWindow() }
function closeWindow(): void { void window.appApi.closeWindow() }
</script>

<template>
  <header class="window-titlebar" data-testid="window-titlebar">
    <div class="window-titlebar-drag" data-testid="window-titlebar-drag" @dblclick="toggleMaximize">
      <span class="window-brand-dot"></span>
      <span>轻待办</span>
    </div>
    <div class="window-controls">
      <button type="button" aria-label="最小化" @click="minimize">−</button>
      <button type="button" aria-label="最大化或还原" @click="toggleMaximize">□</button>
      <button class="window-close" type="button" aria-label="关闭窗口" @click="closeWindow">×</button>
    </div>
  </header>
</template>

<style scoped>
.window-titlebar {
  position: absolute;
  z-index: 25;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  height: 40px;
  color: #334155;
  background: linear-gradient(180deg, rgb(255 255 255 / 78%), rgb(245 248 252 / 62%));
  border-bottom: 1px solid rgb(203 213 225 / 55%);
  backdrop-filter: blur(20px) saturate(150%);
  user-select: none;
}
.window-titlebar-drag {
  display: flex;
  align-items: center;
  flex: 1;
  gap: 9px;
  padding-left: 16px;
  font-size: 12px;
  font-weight: 600;
  -webkit-app-region: drag;
}
.window-brand-dot { width: 9px; height: 9px; border-radius: 50%; background: linear-gradient(135deg,#8ab6ff,#8b7de8); box-shadow: 0 0 10px #8ab6ff88; }
.window-controls { display: flex; -webkit-app-region: no-drag; }
.window-controls button { width: 46px; border: 0; color: #526277; background: transparent; font-size: 15px; cursor: pointer; }
.window-controls button:hover { background: rgb(226 232 240 / 70%); }
.window-controls .window-close:hover { color: white; background: #e81123; }
</style>
