<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import ThemeSettings from '@/components/theme/ThemeSettings.vue';
import { getToken } from '@/utils/auth';
import { loadTheme } from '@/utils/theme';
const loggedIn = ref(Boolean(getToken()));
const syncTheme = () => { loggedIn.value = Boolean(getToken()); void loadTheme(); };
const onStorage = (event: StorageEvent) => {
  if (event.key === 'token' || event.key === null) {
    syncTheme();
    // A different tab switched accounts: also discard the old account's page data.
    window.location.assign('/');
  }
};
onMounted(() => { window.addEventListener('auth-changed', syncTheme); window.addEventListener('storage', onStorage); syncTheme(); });
onUnmounted(() => { window.removeEventListener('auth-changed', syncTheme); window.removeEventListener('storage', onStorage); });
</script>

<template>
    <div class="theme-shell">
      <div class="theme-backdrop" aria-hidden="true"></div>
      <router-view></router-view>
      <ThemeSettings v-if="loggedIn" />
    </div>
</template>

<style scoped>

</style>
