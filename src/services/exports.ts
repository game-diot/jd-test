import { request } from '@umijs/max';

export async function listExports() {
  return request('/api/v1/exports', { method: 'GET' });
}

export async function getExportDownloadUrl(id: string) {
  return request(`/api/v1/exports/${id}/download-url`, { method: 'GET' });
}