import api, { post, get, del } from './client';
import type { User } from '../store/auth';

// 登录请求
interface LoginRequest {
  username: string;
  password: string;
}

// 登录响应
interface LoginResponse {
  token: string;
  user: User;
  namespaces: string[];
}

// 修改密码请求
interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
}

// 会话信息
export interface Session {
  id: string;
  userID: number;
  ip: string;
  userAgent: string;
  createdAt: string;
  expiresAt: string;
}

// 用户列表参数
interface ListUsersParams {
  page?: number;
  pageSize?: number;
  search?: string;
  role?: string;
}

// 用户列表响应
interface ListUsersResponse {
  items: User[];
  total: number;
  page: number;
  pageSize: number;
}

// 创建用户请求
export interface CreateUserRequest {
  username: string;
  password: string;
  displayName: string;
  email?: string;
  role: string;
  allNamespaces: boolean;
  namespaces: string[];
}

// 更新用户请求
export interface UpdateUserRequest {
  displayName?: string;
  email?: string;
  role?: string;
  enabled?: boolean;
  allNamespaces?: boolean;
  namespaces?: string[];
}

// 审批请求
export interface ApprovalRequest {
  id: number;
  userID: number;
  username: string;
  action: string;
  resource: string;
  resourceName: string;
  namespace: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewerID?: number;
  reviewerName?: string;
  reviewComment?: string;
  createdAt: string;
  reviewedAt?: string;
}

// 审批规则
export interface ApprovalRule {
  id: number;
  action: string;
  resource: string;
  minRole: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

// ========== 认证 API ==========

export const authApi = {
  // 登录
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>('/auth/login', data);
    return response.data;
  },

  // 登出
  logout: async (): Promise<void> => {
    await post('/auth/logout');
  },

  // 获取当前用户
  getCurrentUser: async (): Promise<{ user: User; namespaces: string[] }> => {
    return get('/auth/me');
  },

  // 修改密码
  changePassword: async (data: ChangePasswordRequest): Promise<void> => {
    await post('/auth/password', data);
  },

  // 获取用户会话
  getSessions: async (): Promise<{ items: Session[] }> => {
    return get('/auth/sessions');
  },

  // 撤销会话
  revokeSession: async (sessionId: string): Promise<void> => {
    await del(`/auth/sessions/${sessionId}`);
  },
};

// ========== 用户管理 API (管理员) ==========

export const userApi = {
  // 列表
  list: async (params?: ListUsersParams): Promise<ListUsersResponse> => {
    return get('/admin/users', params as Record<string, unknown>);
  },

  // 获取单个用户
  get: async (id: number): Promise<{ user: User; namespaces: string[] }> => {
    return get(`/admin/users/${id}`);
  },

  // 创建
  create: async (data: CreateUserRequest): Promise<User> => {
    return post('/admin/users', data);
  },

  // 更新
  update: async (id: number, data: UpdateUserRequest): Promise<User> => {
    const response = await api.put<User>(`/admin/users/${id}`, data);
    return response.data;
  },

  // 删除
  delete: async (id: number): Promise<void> => {
    await del(`/admin/users/${id}`);
  },

  // 重置密码
  resetPassword: async (id: number, newPassword: string): Promise<void> => {
    await post(`/admin/users/${id}/reset-password`, { newPassword });
  },
};

// ========== 审批 API ==========

export const approvalApi = {
  // 列表
  list: async (params?: {
    status?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ items: ApprovalRequest[]; total: number }> => {
    return get('/approvals', params as Record<string, unknown>);
  },

  // 获取单个
  get: async (id: number): Promise<ApprovalRequest> => {
    return get(`/approvals/${id}`);
  },

  // 待审批数量
  getPendingCount: async (): Promise<{ count: number }> => {
    return get('/approvals/pending/count');
  },

  // 批准
  approve: async (id: number, comment?: string): Promise<void> => {
    await post(`/approvals/${id}/approve`, { comment });
  },

  // 拒绝
  reject: async (id: number, comment?: string): Promise<void> => {
    await post(`/approvals/${id}/reject`, { comment });
  },

  // 获取规则列表
  getRules: async (): Promise<{ items: ApprovalRule[] }> => {
    return get('/admin/approval-rules');
  },

  // 更新规则
  updateRule: async (
    id: number,
    data: { minRole?: string; enabled?: boolean }
  ): Promise<void> => {
    await api.put(`/admin/approval-rules/${id}`, data);
  },
};
