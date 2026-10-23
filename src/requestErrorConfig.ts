import type { RequestOptions } from '@@/plugin-request/request';
import type { RequestConfig } from '@umijs/max';
import { message } from 'antd';
import { clearToken, getToken } from '@/services/auth';

// 后端约定响应格式：{ code, message, data }（code === 'OK' 为成功）
interface BizResponse {
  code: string;
  message: string;
  data?: unknown;
}

/**
 * @name 错误处理
 * pro 自带的错误处理， 可以在这里做自己的改动
 * @doc https://umijs.org/docs/max/request#配置
 */
export const errorConfig: RequestConfig = {
  // 错误处理： umi@3 的错误处理方案。
  errorConfig: {
    // 错误抛出
    errorThrower: (res) => {
      const { code, message: msg } = res as unknown as BizResponse;
      if (code && code !== 'OK') {
        const error: Error & { info?: BizResponse } = new Error(
          msg || '业务错误',
        );
        error.name = 'BizError';
        error.info = { code, message: msg };
        throw error;
      }
    },
    // 错误接收及处理
    errorHandler: (error: unknown, opts: unknown) => {
      const skip = (opts as { skipErrorHandler?: boolean } | undefined)
        ?.skipErrorHandler;
      if (skip) throw error;

      const e = error as {
        name?: string;
        info?: BizResponse;
        response?: { status: number; data?: BizResponse };
      };

      if (e.name === 'BizError') {
        message.error(e.info?.message || '请求失败');
        return;
      }
      if (e.response) {
        const status = e.response.status;
        if (status === 401) {
          clearToken();
          const { pathname, search, hash } = window.location;
          if (pathname !== '/user/login') {
            window.location.href = `/user/login?redirect=${encodeURIComponent(
              pathname + search + hash,
            )}`;
          }
          return;
        }
        message.error(e.response.data?.message || `请求失败（${status}）`);
        return;
      }
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        message.error('网络不可用，请检查连接');
        return;
      }
      message.error('请求失败，请重试');
    },
  },

  // 请求拦截器
  requestInterceptors: [
    (config: RequestOptions) => {
      const token = getToken();
      if (token) {
        config.headers = {
          ...config.headers,
          Authorization: `Bearer ${token}`,
        };
      }
      return config;
    },
  ],

  // 响应拦截器
  responseInterceptors: [],
};
