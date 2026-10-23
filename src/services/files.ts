import { request } from '@umijs/max';

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  status: string;
}

export async function uploadFile(file: File): Promise<UploadedFile> {
  const form = new FormData();
  form.append('file', file);
  const res = await request('/api/v1/files', {
    method: 'POST',
    data: form,
    requestType: 'form',
  });
  return res.data;
}

/** 附件二次鉴权：生成短时效下载 URL */
export async function getFileDownloadUrl(fileId: string) {
  return request(`/api/v1/files/${fileId}/download-url`, { method: 'POST' });
}