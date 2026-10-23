import { describe, expect, it } from 'vitest';
import type { UserProfile } from '@/services/auth';
import access from './access';

const profile = (roles: string[]): UserProfile => ({
  id: '1',
  employeeNo: 'E1001',
  name: '测试用户',
  email: 'test@corp.com',
  departmentId: null,
  departmentName: null,
  jobLevel: 1,
  status: 'ACTIVE',
  roles,
});

describe('access', () => {
  it('admin 角色 → canAdmin true', () => {
    expect(access({ currentUser: profile(['admin']) }).canAdmin).toBe(true);
  });

  it('普通员工 → canAdmin false，isApprover false', () => {
    const r = access({ currentUser: profile(['employee']) });
    expect(r.canAdmin).toBe(false);
    expect(r.isApprover).toBe(false);
  });

  it('审批人 → isApprover true', () => {
    expect(
      access({ currentUser: profile(['employee', 'approver']) }).isApprover,
    ).toBe(true);
  });

  it('currentUser 缺失 → 权限全 false', () => {
    expect(access({ currentUser: undefined }).canAdmin).toBe(false);
    expect(access(undefined).canAdmin).toBe(false);
  });
});
