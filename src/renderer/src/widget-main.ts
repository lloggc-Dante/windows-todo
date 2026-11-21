import { createApp } from 'vue'
import { createPinia } from 'pinia'
import WidgetApp from './WidgetApp.vue'
import './widget.css'

createApp(WidgetApp).use(createPinia()).mount('#app')
