import apiClient from './apiClient';
import type { ApiResponse } from '@/utils/types';
export type ReportType = 'daily' | 'weekly';
export type ReportExportFormat = 'xlsx' | 'docx' | 'csv';
export interface WorkReport {
  id: number;
  type: ReportType;
  startDate: string;
  endDate: string;
  accomplishments: string;
  plans: string;
  blockers: string;
  createdAt: string;
  updatedAt: string;
}
export interface ReportInput {
  type: ReportType;
  date: string;
  accomplishments: string;
  plans: string;
  blockers: string;
}
export interface ReportQuery {
  type: 'all' | ReportType;
  from: string;
  to: string;
  keyword: string;
  page: number;
}
export interface ReportPage {
  items: WorkReport[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
export const getReports = async (query: ReportQuery, signal: AbortSignal) =>
  (await apiClient.get<ApiResponse<ReportPage>>('/reports', { params: query, signal })).data.data;
export const createReport = async (input: ReportInput) =>
  (await apiClient.post<ApiResponse<WorkReport>>('/reports', input)).data.data;
export const updateReport = async (id: number, input: ReportInput) =>
  (await apiClient.put<ApiResponse<WorkReport>>(`/reports/${id}`, input)).data.data;
export const deleteReport = async (id: number) =>
  (await apiClient.delete<ApiResponse<{ id: number }>>(`/reports/${id}`)).data.data;
export async function exportReports(query: ReportQuery & { format: ReportExportFormat }) {
  try {
    return (
      await apiClient.get<Blob>('/reports/export', {
        params: query,
        responseType: 'blob',
        timeout: 30000,
      })
    ).data;
  } catch (error) {
    const response = (error as { response?: { data?: unknown } }).response;
    if (response?.data instanceof Blob) {
      let message = '';
      try {
        message = JSON.parse(await response.data.text()).message;
      } catch {
        /* Keep the original network error. */
      }
      if (message) throw new Error(message);
    }
    throw error;
  }
}
