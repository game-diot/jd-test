import { request } from '@umijs/max';

export interface ContractItemForm {
  id: string;
  contractName: string;
  contractType: string;
  amount: string;
  counterparty: string;
  sealType: string;
  fileId?: string;
}

export interface CreateContractPayload {
  reason: string;
  urgency: 'NORMAL' | 'URGENT';
  items: ContractItemForm[];
}

export async function createContract(data: CreateContractPayload) {
  return request('/api/v1/contracts', { method: 'POST', data });
}

export async function updateContract(id: string, data: CreateContractPayload) {
  return request(`/api/v1/contracts/${id}`, { method: 'PATCH', data });
}

export async function getContract(id: string) {
  return request(`/api/v1/contracts/${id}`, { method: 'GET' });
}

export async function getMyContracts() {
  return request('/api/v1/contracts/mine', { method: 'GET' });
}