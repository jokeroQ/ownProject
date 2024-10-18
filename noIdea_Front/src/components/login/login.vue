//登录页面
<template>
  <GradientBackground v-loading="isLoading">
    <h1>欢迎来到我的世界</h1>
    <div class="block">
      <el-form
        :label-position="labelPosition"
        label-width="auto"
        :model="formLabelAlign"
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
          <el-button type="primary" @click="loginIn" @keyup.enter="loginIn"
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
import { delay } from "@/utils/delay";
import { useRouter } from "vue-router";
import axios from "axios";

const labelPosition = ref<FormProps["labelPosition"]>("right");
const formLabelAlign = reactive({
  username: "admin",
  password: "",
});
const isLoading = ref(false);
const router = useRouter();
const loginIn = async () => {
  try {
    await axios.post("http://localhost:3000/api/users/login", formLabelAlign);
    ElMessage({
      message: "登录成功",
      type: "success",
    });
    router.push("/home");
  } catch (error: any) {
    if (error.response) {
      const { data } = error.response;
      ElMessage({
        message: data.message,
        type: "error",
      });
    }
  }
};
const goRegister = () => {
  router.push("./register");
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