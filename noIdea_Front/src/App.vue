<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { loadTheme } from '@/utils/theme';
import { getCurrentUser } from '@/utils/auth';
import { setGlobalWatermark, removeGlobalWatermark } from '@/utils/useSetwatermarker';
const syncWatermark = () => {
  const user = getCurrentUser();
  if (user) setGlobalWatermark(user.username);
  else removeGlobalWatermark();
};
const syncTheme = () => {
  syncWatermark();
  void loadTheme();
};
const onStorage = (event: StorageEvent) => {
  if (event.key === 'user') syncWatermark();
  if (event.key === 'token' || event.key === null) {
    syncTheme();
    // A different tab switched accounts: also discard the old account's page data.
    window.location.assign('/');
  }
};
onMounted(() => {
  window.addEventListener('auth-changed', syncTheme);
  window.addEventListener('user-changed', syncWatermark);
  window.addEventListener('storage', onStorage);
  syncTheme();
});
onUnmounted(() => {
  window.removeEventListener('auth-changed', syncTheme);
  window.removeEventListener('user-changed', syncWatermark);
  window.removeEventListener('storage', onStorage);
  removeGlobalWatermark();
});
</script>

<template>
  <div class="theme-shell">
    <div class="theme-backdrop" aria-hidden="true"></div>
    <router-view></router-view>
  </div>
</template>

<style scoped></style>
