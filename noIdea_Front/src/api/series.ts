import apiClient from './apiClient';
import type { ApiResponse } from '@/utils/types';
export type SeriesKind =
  | 'all'
  | 'tv'
  | 'short'
  | 'ai'
  | 'anime'
  | 'movie'
  | 'variety'
  | 'documentary';
export interface SeriesQuery {
  keyword: string;
  kind: SeriesKind;
  source: string;
  sort: 'hot' | 'latest' | 'rating';
  genre: string;
  region: string;
  year: string;
  minScore: string;
  page: number;
}
export interface SeriesItem {
  id: string;
  source: string;
  sourceLabel: string;
  sourceId: string;
  title: string;
  originalTitle: string;
  url: string;
  poster: string;
  score: number | null;
  ratingState: 'rated' | 'unrated' | 'unavailable';
  ratingCount: number | null;
  year: number | null;
  genres: string[];
  regions: string[];
  cast: string[];
  summary: string;
  episodes: string;
  date: string;
  heat: number | null;
  heatLabel: string;
  catalogFetchedAt?: string;
}
export interface SeriesSource {
  source: string;
  label: string;
  state: 'ok' | 'unavailable' | 'stale' | 'unsupported';
  message: string;
  updatedAt: string | null;
  count: number;
}
export interface SeriesResult {
  items: SeriesItem[];
  sources: SeriesSource[];
  page: number;
  hasMore: boolean;
  unavailable: boolean;
  fetchedAt: string;
  notice: string;
}
export interface SeriesDetail {
  title: string;
  score: number | null;
  year: number | null;
  genres: string[];
  regions: string[];
  cast: string[];
  directors: string[];
  episodes: string;
  duration: string;
  updatedAt: string;
  stale: boolean;
}
export const searchSeries = async (query: SeriesQuery, signal: AbortSignal) =>
  (
    await apiClient.get<ApiResponse<SeriesResult>>('/series', {
      params: query,
      signal,
      timeout: 20000,
    })
  ).data.data;
export const fetchSeriesDetail = async (id: string, signal: AbortSignal) =>
  (await apiClient.get<ApiResponse<SeriesDetail>>(`/series/douban/${id}`, { signal })).data.data;

export type WatchStatus = 'none' | 'want' | 'watching';
export type SeriesList = 'all' | 'favorite' | 'want' | 'watching';
export interface SeriesLibraryState {
  id: string;
  favorite: boolean;
  watchStatus: WatchStatus;
}
export interface SeriesLibraryItem extends SeriesItem, SeriesLibraryState {
  savedAt: string;
  updatedAt: string;
}
export interface SeriesLibraryResult {
  items: SeriesLibraryItem[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
export const fetchSeriesLibraryStatus = async (signal: AbortSignal) =>
  (
    await apiClient.get<ApiResponse<{ entries: SeriesLibraryState[] }>>('/series/library/status', {
      signal,
    })
  ).data.data;
export const fetchSeriesLibrary = async (
  query: { list: SeriesList; keyword: string; page: number; region?: string },
  signal: AbortSignal,
) =>
  (
    await apiClient.get<ApiResponse<SeriesLibraryResult>>('/series/library', {
      params: query,
      signal,
    })
  ).data.data;
export const updateSeriesLibrary = async (
  item: SeriesItem,
  patch: Partial<Pick<SeriesLibraryState, 'favorite' | 'watchStatus'>>,
) =>
  (
    await apiClient.patch<ApiResponse<SeriesLibraryState>>(
      `/series/library/${encodeURIComponent(item.id)}`,
      { item, ...patch },
    )
  ).data.data;
export const removeSeriesLibrary = async (id: string) =>
  (
    await apiClient.delete<ApiResponse<SeriesLibraryState>>(
      `/series/library/${encodeURIComponent(id)}`,
    )
  ).data.data;

export interface SeriesCatalogStatus {
  total: number;
  sources: {
    source: string;
    label: string;
    count: number;
    lastFetchedAt: string | null;
    live: boolean;
  }[];
}
export const fetchSeriesCatalogStatus = async (signal: AbortSignal) =>
  (await apiClient.get<ApiResponse<SeriesCatalogStatus>>('/series/catalog/status', { signal })).data
    .data;
