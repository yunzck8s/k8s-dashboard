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
    <div className="min-h-screen flex relative">
      {/* 角落装饰元素 - 更微妙 */}
      <div className="fixed top-0 left-0 w-24 h-24 pointer-events-none z-50 opacity-40">
        <svg width="96" height="96" viewBox="0 0 96 96">
          <path
            d="M 0 0 L 24 0 M 0 0 L 0 24"
            stroke="var(--color-accent-primary)"
            strokeWidth="1"
            fill="none"
          />
          <circle cx="24" cy="24" r="1.5" fill="var(--color-accent-primary)" />
        </svg>
      </div>
      <div className="fixed top-0 right-0 w-24 h-24 pointer-events-none z-50 opacity-40">
        <svg width="96" height="96" viewBox="0 0 96 96">
          <path
            d="M 96 0 L 72 0 M 96 0 L 96 24"
            stroke="var(--color-accent-primary)"
            strokeWidth="1"
            fill="none"
          />
          <circle cx="72" cy="24" r="1.5" fill="var(--color-accent-primary)" />
        </svg>
      </div>
      <div className="fixed bottom-0 left-0 w-24 h-24 pointer-events-none z-50 opacity-40">
        <svg width="96" height="96" viewBox="0 0 96 96">
          <path
            d="M 0 96 L 24 96 M 0 96 L 0 72"
            stroke="var(--color-accent-primary)"
            strokeWidth="1"
            fill="none"
          />
          <circle cx="24" cy="72" r="1.5" fill="var(--color-accent-primary)" />
        </svg>
      </div>
      <div className="fixed bottom-0 right-0 w-24 h-24 pointer-events-none z-50 opacity-40">
        <svg width="96" height="96" viewBox="0 0 96 96">
          <path
            d="M 96 96 L 72 96 M 96 96 L 96 72"
            stroke="var(--color-accent-primary)"
            strokeWidth="1"
            fill="none"
          />
          <circle cx="72" cy="72" r="1.5" fill="var(--color-accent-primary)" />
        </svg>
      </div>

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
        <main className="flex-1 p-6 overflow-auto relative">
          {/* 内容区域边框装饰 */}
          <div
            className="absolute top-0 left-0 right-0 h-[1px] opacity-30"
            style={{
              background: 'linear-gradient(90deg, transparent, var(--color-accent-primary), transparent)',
            }}
          />
          <Outlet />
        </main>
      </div>
    </div>
  );
}
