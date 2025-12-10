import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Sidebar from './Sidebar';
import Header from './Header';
import { useAppStore } from '../store';
import { namespaceApi } from '../api';
import clsx from 'clsx';

export default function MainLayout() {
  const { sidebarCollapsed, setNamespaces } = useAppStore();

  // 获取命名空间列表
  const { data: namespacesData } = useQuery({
    queryKey: ['namespaces'],
    queryFn: () => namespaceApi.list(),
    refetchInterval: 60000, // 每分钟刷新一次
  });

  // 更新 store 中的命名空间列表
  useEffect(() => {
    if (namespacesData?.items) {
      setNamespaces(namespacesData.items);
    }
  }, [namespacesData, setNamespaces]);

  return (
    <div className="min-h-screen bg-slate-900 flex">
      {/* 侧边栏 */}
      <Sidebar />

      {/* 主内容区 */}
      <div
        className={clsx(
          'flex-1 flex flex-col min-h-screen transition-all duration-300',
          sidebarCollapsed ? 'ml-16' : 'ml-64'
        )}
      >
        {/* 顶部导航 */}
        <Header />

        {/* 页面内容 */}
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
