import { createApp } from 'vue'
import { createPinia } from 'pinia'
import WidgetApp from './WidgetApp.vue'
import './apple-glass.css'
import './widget.css'

createApp(WidgetApp).use(createPinia()).mount('#app')
