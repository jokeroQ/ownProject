//注册页面
<template>
  <div class="register-page">
    <el-button
      class="app-icon-button"
      type="primary"
      :icon="Back"
      circle
      aria-label="返回登录"
      title="返回登录"
      @click="goBack"
    />
    <el-form label-width="auto" :model="formLabelAlign" style="max-width: 600px">
      <el-form-item label="用户名">
        <el-input v-model="formLabelAlign.username" />
      </el-form-item>
      <el-form-item label="密码">
        <el-input v-model="formLabelAlign.password" />
      </el-form-item>
      <el-form-item label="邮箱">
        <el-input v-model="formLabelAlign.email" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="onSubmit">注册</el-button>
      </el-form-item>
    </el-form>
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

<style scoped>
.register-page {
  position: relative;
  width: 100%;
  height: auto;
  min-height: var(--app-height, 100dvh);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: max(84px, env(safe-area-inset-top)) max(20px, env(safe-area-inset-right))
    max(32px, env(safe-area-inset-bottom)) max(20px, env(safe-area-inset-left));
  background:
    radial-gradient(ellipse at 20% 15%, var(--el-color-primary-light-9), transparent 52%),
    var(--theme-page);
}
.register-page > .el-button {
  position: absolute;
  top: max(20px, env(safe-area-inset-top));
  left: max(20px, env(safe-area-inset-left));
  width: var(--app-button-height);
  height: var(--app-button-height);
}
.el-form {
  box-sizing: border-box;
  width: min(420px, 100%);
  min-width: 0;
  max-width: 420px !important;
  padding: 32px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 24px;
  background: var(--el-bg-color);
  box-shadow: 0 24px 70px rgba(15, 23, 42, 0.08);
}
.el-form::before {
  content: '创建你的收藏空间';
  display: block;
  margin-bottom: 28px;
  color: var(--theme-text);
  font-size: 22px;
  font-weight: 650;
  letter-spacing: -0.5px;
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
  width: auto !important;
  justify-content: flex-start;
  height: auto;
  margin-bottom: 8px;
  padding: 0;
  line-height: 20px;
  color: var(--theme-muted);
  font-size: 13px;
}
:deep(.el-form-item__content) {
  margin-left: 0 !important;
}
:deep(.el-input__wrapper) {
  height: 46px;
  padding: 0 14px;
  border-radius: 12px;
}
.el-form-item:last-child {
  margin-bottom: 0;
  margin-top: 28px;
}
.el-form-item:last-child .el-button {
  width: 100%;
  height: var(--app-button-height);
  border-radius: 8px;
}
@media (max-width: 480px), (max-height: 600px) {
  .el-form {
    padding: 24px;
  }
  .el-form::before {
    margin-bottom: 20px;
    font-size: 20px;
  }
  :deep(.el-form-item) {
    margin-bottom: 14px;
  }
  .el-form-item:last-child {
    margin-top: 20px;
  }
}
</style>
