import { request } from '@umijs/max';

export async function getAdminContracts() {
  return request('/api/v1/admin/contracts', { method: 'GET' });
}

export async function terminateContract(id: string, reason: string) {
  return request(`/api/v1/admin/contracts/${id}/terminate`, {
    method: 'POST',
    data: { reason },
  });
}