import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// 用户类型
export interface User {
  id: number;
  username: string;
  displayName: string;
  email: string;
  role: 'admin' | 'operator' | 'viewer';
  allNamespaces: boolean;
  enabled: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

// 认证状态
interface AuthState {
  // 用户信息
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;

  // 用户可访问的命名空间
  allowedNamespaces: string[];

  // 操作
  setAuth: (user: User, token: string, namespaces?: string[]) => void;
  clearAuth: () => void;
  updateUser: (user: Partial<User>) => void;
  setAllowedNamespaces: (namespaces: string[]) => void;

  // 权限检查
  hasRole: (role: string) => boolean;
  canAccessNamespace: (namespace: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      allowedNamespaces: [],

      setAuth: (user, token, namespaces = []) => {
        // 同时保存到 localStorage（供 API client 使用）
        localStorage.setItem('token', token);
        set({
          user,
          token,
          isAuthenticated: true,
          allowedNamespaces: namespaces,
        });
      },

      clearAuth: () => {
        localStorage.removeItem('token');
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          allowedNamespaces: [],
        });
      },

      updateUser: (userData) => {
        const currentUser = get().user;
        if (currentUser) {
          set({ user: { ...currentUser, ...userData } });
        }
      },

      setAllowedNamespaces: (namespaces) => {
        set({ allowedNamespaces: namespaces });
      },

      hasRole: (role) => {
        const user = get().user;
        if (!user) return false;

        // admin 拥有所有权限
        if (user.role === 'admin') return true;

        // 角色层级: admin > operator > viewer
        const roleHierarchy: Record<string, number> = {
          admin: 3,
          operator: 2,
          viewer: 1,
        };

        return roleHierarchy[user.role] >= roleHierarchy[role];
      },

      canAccessNamespace: (namespace) => {
        const { user, allowedNamespaces } = get();
        if (!user) return false;

        // admin 或 allNamespaces 用户可以访问所有
        if (user.role === 'admin' || user.allNamespaces) return true;

        // 检查是否在允许列表中
        return allowedNamespaces.includes(namespace);
      },
    }),
    {
      name: 'k8s-dashboard-auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
        allowedNamespaces: state.allowedNamespaces,
      }),
    }
  )
);

// 辅助 hook: 获取当前用户角色显示名
export function useRoleDisplay() {
  const user = useAuthStore((state) => state.user);

  const roleNames: Record<string, string> = {
    admin: '管理员',
    operator: '操作员',
    viewer: '只读用户',
  };

  return user ? roleNames[user.role] || user.role : '';
}
