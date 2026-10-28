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
          <el-button type="primary" native-type="submit">登录</el-button>
        </div>
      </el-form>
    </div>
  </GradientBackground>
</template>

<script lang="ts" setup>
defineOptions({ name: 'LoginPage' });
import GradientBackground from '../../components/background/GradientBackground.vue';
import { reactive, ref } from 'vue';
import type { FormProps } from 'element-plus';
import { useRouter, useRoute } from 'vue-router';
import { saveLogin, type LoginResponse } from '@/utils/auth';
import { postRequest } from '../../utils/httpService';
import { getErrorMessage } from '@/utils/errors';

const labelPosition = ref<FormProps['labelPosition']>('right');
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

<style scoped lang="less">
h1 {
  margin: 0;
  color: var(--theme-muted);
  font-size: 15px;
  font-weight: 450;
  letter-spacing: 1px;
}
.block {
  width: min(420px, 100%);
  min-width: 0;
  box-sizing: border-box;
  margin: 0;
  padding: 32px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 24px;
  color: var(--theme-text);
  background: var(--el-bg-color);
  box-shadow: 0 24px 70px rgba(15, 23, 42, 0.08);
  &::before {
    content: '登录你的收藏空间';
    display: block;
    margin-bottom: 28px;
    font-size: 22px;
    font-weight: 650;
    letter-spacing: -0.5px;
  }
  .el-form {
    width: 100%;
  }
  :deep(.el-form-item) {
    flex-direction: column;
    align-items: stretch;
    margin-bottom: 20px;
  }
  :deep(.el-form-item__label-wrap) {
    margin-left: 0 !important;
  }
  :deep(.el-form-item__label) {
    justify-content: flex-start;
    width: auto !important;
    height: auto;
    margin-bottom: 8px;
    padding: 0;
    line-height: 20px;
    font-size: 13px;
    font-weight: 550;
    color: var(--theme-muted);
  }
  :deep(.el-form-item__content) {
    margin-left: 0 !important;
  }
  :deep(.el-input__wrapper) {
    height: 46px;
    padding: 0 14px;
    border-radius: 12px;
  }
  .btnGroup {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-top: 28px;
    .el-button {
      width: 100%;
      margin: 0;
      height: var(--app-button-height);
      border-radius: 8px;
      font-weight: 550;
    }
  }
}
.input-fixed-width {
  width: 100%;
}
@media (max-width: 480px) {
  .block {
    padding: 26px;
  }
}
@media (max-height: 600px) {
  .block {
    padding: 22px;
    &::before {
      margin-bottom: 18px;
      font-size: 20px;
    }
    :deep(.el-form-item) {
      margin-bottom: 14px;
    }
    .btnGroup {
      margin-top: 18px;
    }
  }
}
</style>
