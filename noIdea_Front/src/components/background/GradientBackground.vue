<template>
  <div class="gradient-background" :style="{ background: backgroundStyle }">
    <slot></slot>
  </div>
</template>

<script lang="ts">
import { defineComponent, reactive, onMounted, onUnmounted } from "vue";
export default defineComponent({
  name: "GradientBackground",
  setup() {
    const state = reactive({
      color1: "",
      color2: "",
    });

    const updateGradient = () => {
      state.color1 = `#${Math.floor(Math.random() * 16777215).toString(16)}`;
      state.color2 = `#${Math.floor(Math.random() * 16777215).toString(16)}`;
    };

    const backgroundStyle = computed(() => {
      console.log(state.color1, state.color2);
      return `linear-gradient(135deg, ${state.color1}, ${state.color2})`;
    });

    let intervalId: number;

    onMounted(() => {
      console.log(111);
      updateGradient();
      intervalId = window.setInterval(updateGradient, 5000); //每五秒更新一次背景
    });

    onUnmounted(() => {
      clearInterval(intervalId);
    });

    return {
      backgroundStyle,
    };
  },
});
</script>

<style scoped>
.gradient-background {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;
  box-sizing: border-box;
  padding: 32px 20px;
  width: 100%;
  min-height: 100vh;
  height: auto;
  background: radial-gradient(ellipse at 18% 12%, var(--el-color-primary-light-9), transparent 50%), radial-gradient(ellipse at 82% 86%, var(--el-fill-color), transparent 50%), var(--theme-page) !important;
}
.gradient-background::before {
  content: "noIdea.";
  color: var(--el-color-primary);
  font-size: 42px;
  font-weight: 750;
  letter-spacing: -2px;
  line-height: 1;
}
@media (max-height: 600px) { .gradient-background { gap: 16px; padding: 24px 20px; } }
</style>
