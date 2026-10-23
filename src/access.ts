import type { UserProfile } from '@/services/auth';

/**
 * 基于后端 profile.roles 判断权限（不再用旧生成接口的 access 字段）。
 * @see https://umijs.org/docs/max/access#access
 */
export default function access(
  initialState: { currentUser?: UserProfile } | undefined,
) {
  const { currentUser } = initialState ?? {};
  const roles = currentUser?.roles ?? [];
  return {
    canAdmin: roles.includes('admin'),
    isApprover: roles.includes('approver'),
    isAuditor: roles.includes('auditor'),
  };
}
