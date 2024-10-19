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
import { reactive, ref } from "vue";
import { Back } from "@element-plus/icons-vue";
import axios from "axios";
import { useRouter } from "vue-router";
import { postRequest, getRequest } from '../../utils/httpService';
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
    const response = await postRequest<User>('/users/register', formLabelAlign);
    console.log("注册成功:", response.data);
  } catch (error) {
    console.error("注册失败:", error);
  }
};
const goBack = () => {
  router.go(-1);
};
</script>

<style scoped>
</style>