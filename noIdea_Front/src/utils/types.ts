// src/utils/types.ts

export interface ApiResponse<T> {
    success: boolean;
    data: T;
    message?: string;
  }
  