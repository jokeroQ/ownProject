//登录页面
<template>
  <GradientBackground v-loading="isLoading">
    <h1>欢迎来到我的世界</h1>
    <div class="block">
      <el-form
        :label-position="labelPosition"
        label-width="auto"
        :model="formLabelAlign"
        @submit.prevent="loginIn"
      >
        <el-form-item label="用户名:">
          <el-input v-model="formLabelAlign.username" />
        </el-form-item>
        <el-form-item label="密码:">
          <el-input
            v-model="formLabelAlign.password"
            type="password"
            show-password
            class="input-fixed-width"
          />
        </el-form-item>
        <div class="btnGroup">
          <el-button @click="goRegister">注册</el-button>
          <el-button type="primary" native-type="submit"
            >登录</el-button
          >
        </div>
      </el-form>
    </div>
  </GradientBackground>
</template>

<script lang="ts" setup>
import GradientBackground from "../../components/background/GradientBackground.vue";
import { reactive, ref } from "vue";
import type { FormProps } from "element-plus";
import { useRouter, useRoute } from "vue-router";
import { saveLogin, type LoginResponse } from '@/utils/auth';
import { postRequest } from '../../utils/httpService';

const labelPosition = ref<FormProps["labelPosition"]>("right");
const formLabelAlign = reactive({
  username: "cara",
  password: "",
});
const isLoading = ref(false);
const router = useRouter();
const route = useRoute();
const loginIn = async () => {
  if (isLoading.value) return;

  isLoading.value = true;

  try {
    const response = await postRequest<LoginResponse>("/users/login", formLabelAlign);
    saveLogin(response);

    ElMessage.success("登录成功");
    const target = typeof route.query.redirect === 'string' ? route.query.redirect : '/home';
    await router.replace(target.startsWith('/') && !target.startsWith('//') && target !== '/' ? target : '/home');
  } catch (error: any) {
    ElMessage.error(error.response?.data?.message ?? "登录失败");
  } finally {
    isLoading.value = false;
  }
};
const goRegister = () => {
  router.push("/register");
};
</script>

<style scoped lang="less">
.block {
  display: flex;
  justify-content: center;
  align-items: center;
  color: white;
  text-shadow: 0 0 5px rgba(0, 0, 0, 0.5);
  background-color: rgba(0, 0, 0, 0.1);
  width: 50%;
  margin: 0 auto;
  padding: 40px 0;
  border-radius: 20px;
  .btnGroup {
    text-align: right;
  }
}
.input-fixed-width {
  width: 300px; /* 设置固定宽度 */
}
</style>
