import { request } from '@umijs/max';

export async function queryLedger(params: Record<string, any>) {
  return request('/api/v1/ledger/contracts', {
    method: 'GET',
    params,
  });
}

/** 发起导出（阶段 9 接入，当前返回任务 id） */
export async function exportLedger(params: Record<string, any>) {
  return request('/api/v1/exports/contracts', {
    method: 'POST',
    data: params,
  });
}