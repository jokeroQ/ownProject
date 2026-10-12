// src/utils/types.ts

export interface ApiResponse<T> {
  status: number;
  data: T;
  message?: string;
}
export type RecordId = number | string;

export interface Bookmark {
  id: number;
  menu_id: number;
  order: number;
  title: string;
  targetUrl: string;
  icon: string | null;
  type: string | null;
  desc: string | null;
}

export interface Menu {
  id: number;
  user_id: number;
  index: string;
  title: string;
  menuLists: Bookmark[];
}

export interface BookmarkInput {
  title: string;
  targetUrl: string;
  icon?: string;
  type?: string;
  desc?: string;
}
