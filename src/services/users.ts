import { request } from '@umijs/max';

export interface ApproverOption {
  id: string;
  name: string;
  employee_no: string;
  department_id: string;
  job_level: number;
}

/** 转交对象：同部门 + 审批资格 */
export async function listApprovers() {
  return request('/api/v1/users/approvers', { method: 'GET' });
}

/** 加签对象：同级或上级 + 审批资格 */
export async function listSigners() {
  return request('/api/v1/users/signers', { method: 'GET' });
}