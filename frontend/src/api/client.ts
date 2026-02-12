import axios, { type AxiosInstance, type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { ApiError } from '../types';
import { useAppStore } from '../store';

// 创建 axios 实例
const api: AxiosInstance = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // 从 localStorage 获取 token
    const token = localStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // 获取当前选中的集群
    const cluster = localStorage.getItem('currentCluster');
    if (cluster && config.headers) {
      config.headers['X-Cluster'] = cluster;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    if (!response.config.url?.startsWith('/clusters')) {
      useAppStore.getState().clearClusterError();
    }
    return response;
  },
  (error: AxiosError<ApiError>) => {
    if (error.response) {
      const { status, data } = error.response;
      const clusterError = data as unknown as {
        code?: string;
        cluster?: string;
        error?: string;
      };

      if (status === 503 && clusterError?.code === 'CLUSTER_UNAVAILABLE') {
        useAppStore.getState().setClusterError({
          cluster: clusterError.cluster || localStorage.getItem('currentCluster') || 'default',
          error: clusterError.error || '当前集群不可达',
        });
      }

      switch (status) {
        case 401:
          // 未授权，跳转登录
          localStorage.removeItem('token');
          window.location.href = '/login';
          break;
        case 403:
          // 权限不足
          console.error('Permission denied:', data?.message);
          break;
        case 404:
          // 资源不存在
          console.error('Resource not found:', data?.message);
          break;
        case 500:
          // 服务器错误
          console.error('Server error:', data?.message);
          break;
        default:
          console.error('API error:', data?.message);
      }
    } else if (error.request) {
      console.error('Network error:', error.message);
    }

    return Promise.reject(error);
  }
);

export default api;

// 通用请求方法
export async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const response = await api.get<T>(url, { params });
  return response.data;
}

export async function post<T>(url: string, data?: unknown): Promise<T> {
  const response = await api.post<T>(url, data);
  return response.data;
}

export async function put<T>(url: string, data?: unknown): Promise<T> {
  const response = await api.put<T>(url, data);
  return response.data;
}

export async function patch<T>(url: string, data?: unknown): Promise<T> {
  const response = await api.patch<T>(url, data);
  return response.data;
}

export async function del<T>(url: string): Promise<T> {
  const response = await api.delete<T>(url);
  return response.data;
}

// 发送 YAML 内容（Content-Type: text/yaml）
export async function putYaml<T>(url: string, yamlContent: string): Promise<T> {
  const response = await api.put<T>(url, yamlContent, {
    headers: {
      'Content-Type': 'text/yaml',
    },
  });
  return response.data;
}

// WebSocket 连接
export function createWebSocket(
  path: string,
  params?: Record<string, string | undefined>
): WebSocket {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  const cluster = localStorage.getItem('currentCluster');

  let url = `${protocol}//${host}${path}`;
  const searchParams = new URLSearchParams();
  if (cluster) searchParams.set('cluster', cluster);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value) {
        searchParams.set(key, value);
      }
    });
  }
  if (searchParams.toString()) {
    // 如果 path 已包含查询参数，使用 & 连接；否则使用 ?
    const separator = path.includes('?') ? '&' : '?';
    url += `${separator}${searchParams.toString()}`;
  }

  return new WebSocket(url);
}
