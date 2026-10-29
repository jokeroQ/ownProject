// src/main.ts
import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import store from './store';
import '@/assets/styles/index.css';
import './style.css';
import 'element-plus/es/components/message/style/css';
import 'element-plus/es/components/message-box/style/css';
import '@/assets/styles/global-theme.css';
import '@/assets/styles/overlays.css';
import '@/assets/styles/app-ui.css';
createApp(App).use(router).use(store).mount('#app');
