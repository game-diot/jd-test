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
  return request('/api/v1/files', {
    method: 'POST',
    data: form,
    requestType: 'form',
  });
}