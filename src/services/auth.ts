import { request } from '@umijs/max';

const TOKEN_KEY = 'contract_seal_token';

export interface UserProfile {
  id: string;
  employeeNo: string;
  name: string;
  email: string;
  departmentId: string | null;
  departmentName: string | null;
  jobLevel: number;
  status: string;
  roles: string[];
  avatar?: string;
}

export interface LoginParams {
  account: string;
  password: string;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export async function login(params: LoginParams) {
  const res = await request<{
    code: string;
    message: string;
    data: { token: string; profile: UserProfile };
  }>('/api/v1/auth/login', {
    method: 'POST',
    data: params,
  });
  if (res.data?.token) {
    setToken(res.data.token);
  }
  return res.data;
}

export async function currentUser(skipErrorHandler?: boolean) {
  return request<{ code: string; message: string; data: UserProfile }>(
    '/api/v1/auth/me',
    {
      method: 'GET',
      ...(skipErrorHandler ? { skipErrorHandler: true } : {}),
    },
  );
}

export async function logout() {
  try {
    await request('/api/v1/auth/logout', { method: 'POST' });
  } catch {
    // 忽略登出接口错误，本地 token 仍需清理
  }
  clearToken();
}