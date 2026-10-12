import { getRequest, postRequest, putRequest, deleteRequest } from '@/api';
import type { ApiResponse, Bookmark, BookmarkInput, Menu, RecordId } from '@/utils/types';

export const fetchMenuList = (): Promise<ApiResponse<Menu[]>> => getRequest('/menu/getMenus');
export const addMenuItem = (data: { title: string }): Promise<ApiResponse<Menu>> =>
  postRequest('/menu/addMenus', data);
export const deleteMenuItem = (data: { id: RecordId }): Promise<ApiResponse<void>> =>
  deleteRequest(`/menu/deletMenu/${data.id}`, data);
export const updateMenuItem = (data: {
  id: RecordId;
  title: string;
  index?: string;
}): Promise<ApiResponse<Menu>> => putRequest(`/menu/updateMenu/${data.id}`, data);
export const fetchsubMenuList = (data: { menuId: RecordId }): Promise<ApiResponse<Bookmark[]>> =>
  getRequest(`/menu/getSubmenus/${data.menuId}`);
export const addsubMenuItem = (
  data: BookmarkInput & { menuId: RecordId },
): Promise<ApiResponse<Bookmark>> => postRequest(`/menu/addSubmenus/${data.menuId}`, data);
export const deletesubMenuItem = (data: { subMenuId: RecordId }): Promise<ApiResponse<void>> =>
  deleteRequest(`/menu/deleteSubmenus/${data.subMenuId}`, data);
export const updatesubMenuItem = (
  data: BookmarkInput & { subMenuId: RecordId },
): Promise<ApiResponse<Bookmark>> => putRequest(`/menu/updateSubmenus/${data.subMenuId}`, data);
export const swapSubItem = (data: {
  firstId: RecordId;
  secondId: RecordId;
}): Promise<ApiResponse<void>> => postRequest('/menu/subMenus/swap', data);
