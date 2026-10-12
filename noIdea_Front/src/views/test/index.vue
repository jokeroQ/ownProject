<template>
  <div>
    <select
      name="theme"
      :value="themeState.settings.mode"
      :disabled="themeState.loading"
      @change="changeTheme"
    >
      <option value="light">浅色</option>
      <option value="dark">深色</option>
    </select>
    <h2>对应色卡匹配</h2>
    <div class="main">
      <div v-for="i in colorList" :key="i" class="box">
        <span :style="{ backgroundColor: `var(${i})` }"></span>
        <div>{{ i }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'ThemePreviewPage' });
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import { themeState, saveTheme } from '@/utils/theme';
// import { computed } from 'vue';

const colorList = ref([
  '--font-primary',
  '--font-highlight',
  '--background-header',
  '--background-aside',
  '--background-main',
]);

// 获取主题
// const currentTheme = computed(() => store.getters.currentTheme);

// 切换主题的方法
const changeTheme = async (e: Event) => {
  const target = e.target as HTMLSelectElement;
  try {
    await saveTheme({ ...themeState.settings, mode: target.value as 'light' | 'dark' });
  } catch {
    target.value = themeState.settings.mode;
    ElMessage.error('主题保存失败');
  }
};
// const handleChange = (e: Event) => {
//   window.document.documentElement.setAttribute(
//     "data-theme",
//     (e.target as HTMLSelectElement).value
//   );
// };
</script>
<!-- <style lang="less">
body {
  color: var(--font-primary);
  background-color: var(--background-main);
}
</style> -->
<style lang="less" scoped>
.main {
  display: flex;
  justify-content: flex-start;
  gap: 10px;
  flex-wrap: wrap;
  span {
    width: 50px;
    height: 50px;
    display: inline-block;
    border: 2px solid #d0cdcd;
  }
  .box {
    text-align: center;
  }
}
</style>
