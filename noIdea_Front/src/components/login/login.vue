//登录页面
<template>
  <GradientBackground v-loading="isLoading">
    <p class="app-auth-intro">欢迎来到我的世界</p>
    <section class="block app-auth-card">
      <header class="app-auth-heading"><h1>登录你的收藏空间</h1></header>
      <el-form
        class="app-form"
        label-position="right"
        label-width="calc(var(--app-form-label-width) + var(--app-form-column-gap))"
        :model="formLabelAlign"
        @submit.prevent="loginIn"
      >
        <el-form-item label="用户名">
          <el-input v-model="formLabelAlign.username" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input
            v-model="formLabelAlign.password"
            type="password"
            show-password
            class="input-fixed-width"
          />
        </el-form-item>
        <div class="btnGroup app-auth-actions">
          <el-button @click="goRegister">注册</el-button>
          <el-button type="primary" native-type="submit">登录</el-button>
        </div>
      </el-form>
    </section>
  </GradientBackground>
</template>

<script lang="ts" setup>
defineOptions({ name: 'LoginPage' });
import GradientBackground from '../../components/background/GradientBackground.vue';
import { reactive, ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { saveLogin, type LoginResponse } from '@/utils/auth';
import { postRequest } from '../../utils/httpService';
import { getErrorMessage } from '@/utils/errors';

const formLabelAlign = reactive({
  username: 'cara',
  password: '',
});
const isLoading = ref(false);
const router = useRouter();
const route = useRoute();
const loginIn = async () => {
  if (isLoading.value) return;

  isLoading.value = true;

  try {
    const response = await postRequest<LoginResponse>('/users/login', formLabelAlign);
    saveLogin(response);

    ElMessage.success('登录成功');
    const target = typeof route.query.redirect === 'string' ? route.query.redirect : '/home';
    await router.replace(
      target.startsWith('/') && !target.startsWith('//') && target !== '/' ? target : '/home',
    );
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '登录失败'));
  } finally {
    isLoading.value = false;
  }
};
const goRegister = () => {
  router.push('/register');
};
</script>
