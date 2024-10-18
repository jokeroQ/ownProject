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
  align-items: stretch;
  justify-content: stretch;
  width: 100vw;
  height: 100vh;
  transition: background 1s ease;
}
</style>