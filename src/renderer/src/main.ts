import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './apple-glass.css'
import './motion.css'

createApp(App).use(createPinia()).mount('#app')
