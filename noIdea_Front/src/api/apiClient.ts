// src/api/apiClient.ts

import axios from 'axios';

// 创建 Axios 实例
const apiClient = axios.create({
  baseURL: 'http://localhost:3000/api',  // 可以根据环境变量配置
  timeout: 10000,  // 设置请求超时
  headers: {
    'Content-Type': 'application/json',
  },
});

export default apiClient;
