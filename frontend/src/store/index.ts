import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Namespace, ClusterInfo } from '../types';

// 全局应用状态
interface AppState {
  // 当前选中的命名空间
  currentNamespace: string;
  setCurrentNamespace: (namespace: string) => void;

  // 命名空间列表
  namespaces: Namespace[];
  setNamespaces: (namespaces: Namespace[]) => void;

  // 当前集群
  currentCluster: string | null;
  setCurrentCluster: (cluster: string | null) => void;

  // 集群列表
  clusters: ClusterInfo[];
  setClusters: (clusters: ClusterInfo[]) => void;
  clusterError: { cluster: string; error: string } | null;
  setClusterError: (error: { cluster: string; error: string } | null) => void;
  clearClusterError: () => void;

  // 侧边栏状态
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // 主题
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  setTheme: (theme: 'dark' | 'light') => void;

  // 刷新间隔（秒）
  refreshInterval: number;
  setRefreshInterval: (interval: number) => void;

  // 全局加载状态
  globalLoading: boolean;
  setGlobalLoading: (loading: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // 命名空间
      currentNamespace: 'default',
      setCurrentNamespace: (namespace) => set({ currentNamespace: namespace }),
      namespaces: [],
      setNamespaces: (namespaces) => set({ namespaces }),

      // 集群
      currentCluster: null,
      setCurrentCluster: (cluster) => {
        if (cluster) {
          localStorage.setItem('currentCluster', cluster);
        } else {
          localStorage.removeItem('currentCluster');
        }
        set({ currentCluster: cluster });
      },
      clusters: [],
      setClusters: (clusters) => set({ clusters }),
      clusterError: null,
      setClusterError: (clusterError) => set({ clusterError }),
      clearClusterError: () => set({ clusterError: null }),

      // 侧边栏
      sidebarCollapsed: false,
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

      // 主题
      theme: 'dark',
      toggleTheme: () =>
        set((state) => ({
          theme: state.theme === 'dark' ? 'light' : 'dark',
        })),
      setTheme: (theme) => set({ theme }),

      // 刷新间隔
      refreshInterval: 30,
      setRefreshInterval: (interval) => set({ refreshInterval: interval }),

      // 全局加载
      globalLoading: false,
      setGlobalLoading: (loading) => set({ globalLoading: loading }),
    }),
    {
      name: 'k8s-dashboard-app',
      partialize: (state) => ({
        currentNamespace: state.currentNamespace,
        currentCluster: state.currentCluster,
        sidebarCollapsed: state.sidebarCollapsed,
        theme: state.theme,
        refreshInterval: state.refreshInterval,
      }),
    }
  )
);

// 通知状态
interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
}

interface NotificationState {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  addNotification: (notification) =>
    set((state) => ({
      notifications: [
        ...state.notifications,
        { ...notification, id: Date.now().toString() },
      ],
    })),
  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),
  clearNotifications: () => set({ notifications: [] }),
}));

// Modal 状态
interface ModalState {
  // 确认对话框
  confirmModal: {
    open: boolean;
    title: string;
    message: string;
    type: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
    onCancel: () => void;
  } | null;
  showConfirm: (options: {
    title: string;
    message: string;
    type?: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
    onCancel?: () => void;
  }) => void;
  hideConfirm: () => void;

  // YAML 编辑器
  yamlEditor: {
    open: boolean;
    title: string;
    yaml: string;
    readOnly: boolean;
    onSave?: (yaml: string) => Promise<void>;
  } | null;
  showYamlEditor: (options: {
    title: string;
    yaml: string;
    readOnly?: boolean;
    onSave?: (yaml: string) => Promise<void>;
  }) => void;
  hideYamlEditor: () => void;

  // 扩缩容
  scaleModal: {
    open: boolean;
    resourceType: string;
    resourceName: string;
    namespace: string;
    currentReplicas: number;
    onScale: (replicas: number) => Promise<void>;
  } | null;
  showScaleModal: (options: {
    resourceType: string;
    resourceName: string;
    namespace: string;
    currentReplicas: number;
    onScale: (replicas: number) => Promise<void>;
  }) => void;
  hideScaleModal: () => void;
}

export const useModalStore = create<ModalState>((set) => ({
  // 确认对话框
  confirmModal: null,
  showConfirm: (options) =>
    set({
      confirmModal: {
        open: true,
        title: options.title,
        message: options.message,
        type: options.type || 'info',
        onConfirm: options.onConfirm,
        onCancel: options.onCancel || (() => {}),
      },
    }),
  hideConfirm: () => set({ confirmModal: null }),

  // YAML 编辑器
  yamlEditor: null,
  showYamlEditor: (options) =>
    set({
      yamlEditor: {
        open: true,
        title: options.title,
        yaml: options.yaml,
        readOnly: options.readOnly ?? false,
        onSave: options.onSave,
      },
    }),
  hideYamlEditor: () => set({ yamlEditor: null }),

  // 扩缩容
  scaleModal: null,
  showScaleModal: (options) =>
    set({
      scaleModal: {
        open: true,
        ...options,
      },
    }),
  hideScaleModal: () => set({ scaleModal: null }),
}));
