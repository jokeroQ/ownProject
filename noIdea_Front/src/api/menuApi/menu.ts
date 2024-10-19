// src/services/menuService.ts

import { getRequest, postRequest, putRequest, deleteRequest } from '../../api';
import { ApiResponse } from '../utils/types';

// 示例：获取菜单列表
export const fetchMenuList = async (): Promise<ApiResponse<any>> => {
  return await getRequest('/menu/getMenus');
};

// 示例：添加菜单项
export const addMenuItem = async (data: any): Promise<ApiResponse<any>> => {
  return await postRequest('/menu/addMenus', data);
};

//删除菜单项
export const deleteMenuItem=async (data: any): Promise<ApiResponse<any>> => {
    return await deleteRequest(`/menu/deletMenu/${data.id}`, data);
  };

// 更新菜单项
export const updateMenuItem=async (data: any): Promise<ApiResponse<any>> => {
    return await putRequest(`/menu/updateMenu/${data.id}`, data);
  };