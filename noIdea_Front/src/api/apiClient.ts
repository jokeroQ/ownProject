// src/api/apiClient.ts

import axios from 'axios';
import { configureAuth } from '@/utils/auth';

// 创建 Axios 实例
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
  timeout: 10000,  // 设置请求超时
  headers: {
    'Content-Type': 'application/json',
  },
});
configureAuth(apiClient);

export default apiClient;
