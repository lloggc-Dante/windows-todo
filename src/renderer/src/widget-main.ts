import { createApp, h } from 'vue'

createApp({
  render: () => h('main', { 'data-testid': 'desktop-widget' }, '桌面贴片'),
}).mount('#app')
