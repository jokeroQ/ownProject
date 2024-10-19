// src/api/requests.ts

import { AxiosResponse, Method } from 'axios';
import apiClient from './apiClient';
import { ApiResponse } from '../utils/types';

// 封装通用请求函数
export const apiRequest = async <T>(
  method: Method,
  url: string,
  data: any = {},
  params: any = {}
): Promise<ApiResponse<T>> => {
  try {
    const response: AxiosResponse<ApiResponse<T>> = await apiClient({
      method,
      url,
      data,
      params,
    });
    return response.data;
  } catch (error) {
    console.error(`${method.toUpperCase()} 请求失败: `, error);
    throw error;
  }
};

// 封装具体请求函数

export const putRequest = async <T>(url: string, data: any): Promise<ApiResponse<T>> => {
  return apiRequest<T>('put', url, data);
};

export const postRequest = async <T>(url: string, data: any): Promise<ApiResponse<T>> => {
  return apiRequest<T>('post', url, data);
};

export const getRequest = async <T>(url: string, params: any = {}): Promise<ApiResponse<T>> => {
  return apiRequest<T>('get', url, {}, params);
};

export const deleteRequest = async <T>(url: string, params: any = {}): Promise<ApiResponse<T>> => {
  return apiRequest<T>('delete', url, {}, params);
};
