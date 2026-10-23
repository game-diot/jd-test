import { request } from '@umijs/max';

export async function getPendingApprovals() {
  return request('/api/v1/approvals/pending', { method: 'GET' });
}

export async function getProcessedApprovals() {
  return request('/api/v1/approvals/processed', { method: 'GET' });
}

export async function getApprovalDetail(taskId: string) {
  return request(`/api/v1/approvals/${taskId}`, { method: 'GET' });
}

export async function approveTask(taskId: string) {
  return request(`/api/v1/approvals/${taskId}/approve`, { method: 'POST' });
}

export async function rejectTask(taskId: string, comment: string) {
  return request(`/api/v1/approvals/${taskId}/reject`, {
    method: 'POST',
    data: { comment },
  });
}

export async function transferTask(
  taskId: string,
  toUserId: string,
  comment: string,
) {
  return request(`/api/v1/approvals/${taskId}/transfer`, {
    method: 'POST',
    data: { toUserId, comment },
  });
}

export async function addSignTask(taskId: string, signerId: string) {
  return request(`/api/v1/approvals/${taskId}/add-sign`, {
    method: 'POST',
    data: { signerId },
  });
}

export async function withdrawContract(id: string) {
  return request(`/api/v1/contracts/${id}/withdraw`, { method: 'POST' });
}