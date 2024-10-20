// src/main.ts
import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import store from './store';
import '@/assets/styles/index.css';
import './style.css';
import { setGlobalWatermark } from './utils/useSetwatermarker';
createApp(App)
  .use(router)
  .use(store)
  .mount('#app');

  setGlobalWatermark('cara');