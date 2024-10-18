<template>
  <div>
    <select name="pets" @change="changeTheme">
      <option value="default">默认色</option>
      <option value="black">黑色</option>
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
import { ref } from "vue";
import { useStore } from "vuex";
// import { computed } from 'vue';

const store = useStore();
const colorList = ref([
  "--font-primary",
  "--font-highlight",
  "--background-Header",
  "--background-aside",
  "--background-main",
]);

// 获取主题
// const currentTheme = computed(() => store.getters.currentTheme);

// 切换主题的方法
const changeTheme = (e: Event) => {
  const target = e.target as HTMLSelectElement;
  store.dispatch("setTheme", target.value);
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