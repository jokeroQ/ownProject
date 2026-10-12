//注册页面
<template>
  <div class="p-4 w-full h-full m-auto">
    <el-button type="primary" :icon="Back" circle @click="goBack" />
    <el-form
      label-width="auto"
      :model="formLabelAlign"
      style="max-width: 600px"
    >
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
import { reactive } from "vue";
import { Back } from "@element-plus/icons-vue";
import { useRouter } from "vue-router";
import { postRequest } from '../../utils/httpService';
const router = useRouter();
const formLabelAlign = reactive({
  username: "",
  password: "",
  email: "",
});
interface User {
  id: number;
  username: string;
  email: string;
}
//提交注册
const onSubmit = async() => {
  try {
    await postRequest<User>('/users/register', formLabelAlign);
    ElMessage({
      message: "注册成功",
      type: "success",
    });
    router.push("/");
  } catch (error: any) {
    console.error("注册失败:", error);
    ElMessage({
      message: error.response?.data?.message ?? '注册失败',
      type: "error",
    });
  }
};
const goBack = () => {
  router.go(-1);
};
</script>

<style scoped>
.p-4 {
  position: relative;
  width: 100%;
  height: auto;
  min-height: 100vh;
  box-sizing: border-box;
  display: grid;
  place-content: center;
  padding: 40px 20px;
  background: radial-gradient(ellipse at 20% 15%, var(--el-color-primary-light-9), transparent 52%), var(--theme-page);
}
.p-4 > .el-button { position: absolute; top: 28px; left: 28px; width: 40px; height: 40px; }
.el-form {
  box-sizing: border-box;
  width: min(420px, calc(100vw - 40px));
  max-width: 420px !important;
  padding: 32px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 24px;
  background: var(--el-bg-color);
  box-shadow: 0 24px 70px rgba(15, 23, 42, 0.08);
}
.el-form::before {
  content: "创建你的收藏空间";
  display: block;
  margin-bottom: 28px;
  color: var(--theme-text);
  font-size: 22px;
  font-weight: 650;
  letter-spacing: -0.5px;
}
:deep(.el-form-item) { flex-direction: column; align-items: stretch; margin-bottom: 20px; }
:deep(.el-form-item__label-wrap) { margin-left: 0 !important; }
:deep(.el-form-item__label) { width: auto !important; justify-content: flex-start; height: auto; margin-bottom: 8px; padding: 0; line-height: 20px; color: var(--theme-muted); font-size: 13px; }
:deep(.el-form-item__content) { margin-left: 0 !important; }
:deep(.el-input__wrapper) { height: 46px; padding: 0 14px; border-radius: 12px; }
.el-form-item:last-child { margin-bottom: 0; margin-top: 28px; }
.el-form-item:last-child .el-button { width: 100%; height: 44px; border-radius: 12px; }
</style>
