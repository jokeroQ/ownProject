import { AxiosResponse } from 'axios';
import apiClient from '@/api/apiClient';

// 定义接口请求的通用响应类型
interface ApiResponse<T> {
  data: T;
  message?: string;
  status?: number;
}

// 创建一个 Axios 实例
// 封装 PUT 请求
export const putRequest = async <T>(url: string, data: any): Promise<ApiResponse<T>> => {
  try {
    const response: AxiosResponse<ApiResponse<T>> = await apiClient.put(url, data);
    return response.data;
  } catch (error) {
    // 处理错误
    console.error('PUT 请求失败: ', error);
    throw error;
  }
};
// 封装 POST 请求
export const postRequest = async <T = ApiResponse<unknown>>(url: string, data: any): Promise<T> => {
  try {
    const response: AxiosResponse<T> = await apiClient.post(url, data);
    return response.data;
  } catch (error) {
    // 处理错误
    console.error('POST 请求失败: ', error);
    throw error;
  }
};

// 封装 GET 请求
export const getRequest = async <T>(url: string, params: any = {}): Promise<ApiResponse<T>> => {
  try {
    const response: AxiosResponse<ApiResponse<T>> = await apiClient.get(url, { params });
    return response.data;
  } catch (error) {
    // 处理错误
    console.error('GET 请求失败: ', error);
    throw error;
  }
};
