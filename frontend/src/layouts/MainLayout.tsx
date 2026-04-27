import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Sidebar from './Sidebar';
import Header from './Header';
import { useAppStore } from '../store';
import { useAuthStore } from '../store/auth';
import { clusterApi, namespaceApi } from '../api';
import { usePollingInterval } from '../utils/polling';
import { queryKeys } from '../api/queryKeys';
import { createVisibilityRefetchInterval, invalidateClusterScopedQueries } from '../api/queryPolicy';
import clsx from 'clsx';

export default function MainLayout() {
  const queryClient = useQueryClient();
  const {
    sidebarCollapsed,
    setNamespaces,
    currentCluster,
    setCurrentCluster,
    setClusters,
    clusterError,
    theme,
  } = useAppStore();
  const user = useAuthStore((state) => state.user);
  const pollingInterval = usePollingInterval('standard');
  const slowPollingInterval = usePollingInterval('slow');
  const standardRefetchInterval = createVisibilityRefetchInterval(pollingInterval);
  const slowRefetchInterval = createVisibilityRefetchInterval(slowPollingInterval);

  // 获取命名空间列表
  const { data: namespacesData } = useQuery({
    queryKey: queryKeys.namespaces,
    queryFn: () => namespaceApi.list(),
    refetchInterval: standardRefetchInterval,
  });

  const { data: clustersData } = useQuery({
    queryKey: queryKeys.clusters,
    queryFn: () => clusterApi.list(),
    refetchInterval: slowRefetchInterval,
  });

  // 更新 store 中的命名空间列表
  useEffect(() => {
    if (namespacesData?.items) {
      setNamespaces(namespacesData.items);
    }
  }, [namespacesData, setNamespaces]);

  useEffect(() => {
    if (!clustersData || clustersData.length === 0) {
      return;
    }

    setClusters(clustersData);

    const names = new Set(clustersData.map((c) => c.name));
    if (currentCluster && names.has(currentCluster)) {
      return;
    }

    const defaultCluster = clustersData.find((c) => c.isDefault)?.name || 'default';
    setCurrentCluster(defaultCluster);
    clusterApi.switch(defaultCluster).catch(() => {
      // 目标集群不可达时由全局拦截器处理错误提示
    });
    void invalidateClusterScopedQueries(queryClient);
  }, [clustersData, currentCluster, setClusters, setCurrentCluster, queryClient]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const switchToDefault = async () => {
    const target = clustersData?.find((c) => c.isDefault)?.name || 'default';
    try {
      await clusterApi.switch(target);
      setCurrentCluster(target);
      await invalidateClusterScopedQueries(queryClient);
    } catch {
      // 错误由全局拦截器处理
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* 侧边栏 */}
      <Sidebar />

      {/* 主内容区 */}
      <div
        className={clsx(
          'flex-1 min-w-0 flex flex-col min-h-screen transition-all duration-200',
          sidebarCollapsed ? 'ml-[72px]' : 'ml-[72px] md:ml-[256px]'
        )}
      >
        {/* 顶部导航 */}
        <Header />

        {clusterError && (
          <div
            className="mx-4 mt-4 flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 text-[var(--color-text-primary)] md:mx-6"
            style={{ background: 'var(--sys-error-soft-bg)', borderColor: 'var(--sys-error-soft-border)' }}
          >
            <span className="text-sm">
              当前集群 `{clusterError.cluster}` 不可达：{clusterError.error}
            </span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={switchToDefault}>
              切换到默认集群
            </button>
            {user?.role === 'admin' ? (
              <a href="/clusters" className="btn btn-secondary btn-sm">
                打开集群管理
              </a>
            ) : (
              <span className="text-xs text-[var(--color-text-muted)]">
                你也可以使用顶部集群选择器切换
              </span>
            )}
          </div>
        )}

        {/* 页面内容 */}
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
