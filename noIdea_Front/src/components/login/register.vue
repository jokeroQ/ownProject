//注册页面
<template>
  <div class="register-page app-auth-shell">
    <el-button
      class="auth-back app-icon-button"
      type="primary"
      :icon="Back"
      circle
      aria-label="返回登录"
      title="返回登录"
      @click="goBack"
    />
    <p class="app-auth-intro">让常用网址与灵感，各有其所</p>
    <section class="app-auth-card">
      <header class="app-auth-heading"><h1>创建你的收藏空间</h1></header>
      <el-form
        class="app-form"
        label-width="calc(var(--app-form-label-width) + var(--app-form-column-gap))"
        label-position="right"
        :model="formLabelAlign"
        @submit.prevent="onSubmit"
      >
        <el-form-item label="用户名">
          <el-input v-model="formLabelAlign.username" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="formLabelAlign.password" type="password" show-password />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="formLabelAlign.email" />
        </el-form-item>
        <div class="app-auth-actions">
          <el-button type="primary" native-type="submit">注册</el-button>
        </div>
      </el-form>
    </section>
  </div>
</template>

<script lang="ts" setup>
defineOptions({ name: 'RegisterPage' });
import { reactive } from 'vue';
import { Back } from '@element-plus/icons-vue';
import { useRouter } from 'vue-router';
import { postRequest } from '../../utils/httpService';
import { getErrorMessage } from '@/utils/errors';
const router = useRouter();
const formLabelAlign = reactive({
  username: '',
  password: '',
  email: '',
});
interface User {
  id: number;
  username: string;
  email: string;
}
//提交注册
const onSubmit = async () => {
  try {
    await postRequest<User>('/users/register', formLabelAlign);
    ElMessage({
      message: '注册成功',
      type: 'success',
    });
    router.push('/');
  } catch (error) {
    console.error('注册失败:', error);
    ElMessage({
      message: getErrorMessage(error, '注册失败'),
      type: 'error',
    });
  }
};
const goBack = () => {
  router.go(-1);
};
</script>
