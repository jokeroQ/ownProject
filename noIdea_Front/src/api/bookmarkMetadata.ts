import apiClient from './apiClient';

export interface WebsiteMetadata {
  title: string;
  icon: string;
  url: string;
}

export async function fetchWebsiteMetadata(url: string, signal: AbortSignal) {
  const response = await apiClient.post<{ data: WebsiteMetadata }>(
    '/menu/metadata',
    { url },
    { signal },
  );
  return response.data.data;
}
