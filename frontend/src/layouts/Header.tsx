import { Fragment } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Menu, Transition } from '@headlessui/react';
import clsx from 'clsx';
import { useAppStore } from '../store';
import { useAuthStore, useRoleDisplay } from '../store/auth';
import { authApi } from '../api/auth';
import { clusterApi } from '../api';
import { invalidateClusterScopedQueries } from '../api/queryPolicy';
import {
  BellIcon,
  MagnifyingGlassIcon,
  ChevronDownIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  SunIcon,
  MoonIcon,
  ServerIcon,
  UserIcon,
} from '@heroicons/react/24/outline';

export default function Header() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    currentNamespace,
    setCurrentNamespace,
    namespaces,
    currentCluster,
    clusters,
    setCurrentCluster,
    clearClusterError,
    theme,
    toggleTheme,
  } = useAppStore();

  const { user, clearAuth } = useAuthStore();
  const roleDisplay = useRoleDisplay();
  const selectTriggerClass =
    'flex min-h-[44px] items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-3 py-2 text-sm text-[var(--color-text-primary)] transition-colors duration-150 hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-elevated)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';
  const menuPanelClass =
    'absolute right-0 z-50 mt-2 w-56 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-lg focus:outline-none';
  const menuItemClass =
    'flex w-full items-center gap-2 px-4 py-2 text-sm text-[var(--color-text-primary)] transition-colors duration-150';

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      // 忽略登出错误
    }
    clearAuth();
    navigate('/login');
  };

  const handleSwitchCluster = async (name: string) => {
    if (name === currentCluster) {
      return;
    }

    try {
      await clusterApi.switch(name);
      setCurrentCluster(name);
      clearClusterError();
      await invalidateClusterScopedQueries(queryClient);
    } catch {
      // 错误由全局拦截器处理
    }
  };

  return (
    <header className="flex h-16 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-6">
      {/* 左侧：搜索框 */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            type="text"
            placeholder="搜索资源..."
            className="h-10 w-72 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] py-2 pl-10 pr-12 text-sm text-[var(--color-text-primary)] transition-all duration-150 placeholder:text-[var(--color-text-muted)] focus-visible:border-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 lg:w-80"
            aria-label="搜索资源"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 rounded bg-[var(--color-bg-elevated)] px-2 py-0.5 text-xs text-[var(--color-text-muted)]">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* 右侧：操作区 */}
      <div className="flex items-center gap-4">
        {/* 集群选择器 */}
        {clusters.length > 0 && (
          <Menu as="div" className="relative">
            <Menu.Button className={selectTriggerClass} aria-label="选择集群">
              <ServerIcon className="h-4 w-4 text-[var(--color-text-muted)]" />
              <span className="text-sm text-[var(--color-text-primary)]">
                {currentCluster || '选择集群'}
              </span>
              <ChevronDownIcon className="h-4 w-4 text-[var(--color-text-muted)]" />
            </Menu.Button>
            <Transition
              as={Fragment}
              enter="transition ease-out duration-100"
              enterFrom="transform opacity-0 scale-95"
              enterTo="transform opacity-100 scale-100"
              leave="transition ease-in duration-75"
              leaveFrom="transform opacity-100 scale-100"
              leaveTo="transform opacity-0 scale-95"
            >
              <Menu.Items className={menuPanelClass}>
                <div className="py-1">
                  {clusters.map((cluster) => (
                    <Menu.Item key={cluster.name}>
                      {({ active }) => (
                        <button
                          onClick={() => {
                            void handleSwitchCluster(cluster.name);
                          }}
                          className={clsx(
                            menuItemClass,
                            'justify-between',
                            active
                              ? 'bg-primary-light text-[var(--color-text-primary)]'
                              : 'text-[var(--color-text-secondary)]'
                          )}
                        >
                          <span>{cluster.name}</span>
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ background: cluster.status === 'connected' ? 'var(--color-success)' : 'var(--color-error)' }}
                          />
                        </button>
                      )}
                    </Menu.Item>
                  ))}
                </div>
              </Menu.Items>
            </Transition>
          </Menu>
        )}

        {/* 命名空间选择器 */}
        <Menu as="div" className="relative">
          <Menu.Button className={selectTriggerClass} aria-label="选择命名空间">
            <span className="text-sm text-[var(--color-text-muted)]">Namespace:</span>
            <span className="text-sm text-[var(--color-text-primary)]">{currentNamespace}</span>
            <ChevronDownIcon className="h-4 w-4 text-[var(--color-text-muted)]" />
          </Menu.Button>
          <Transition
            as={Fragment}
            enter="transition ease-out duration-100"
            enterFrom="transform opacity-0 scale-95"
            enterTo="transform opacity-100 scale-100"
            leave="transition ease-in duration-75"
            leaveFrom="transform opacity-100 scale-100"
            leaveTo="transform opacity-0 scale-95"
          >
            <Menu.Items className={clsx(menuPanelClass, 'max-h-80 overflow-y-auto')}>
              <div className="py-1">
                <Menu.Item>
                  {({ active }) => (
                    <button
                      onClick={() => setCurrentNamespace('all')}
                      className={clsx(
                        menuItemClass,
                        active && 'bg-primary-light',
                        currentNamespace === 'all' ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-primary)]'
                      )}
                    >
                      所有命名空间
                    </button>
                  )}
                </Menu.Item>
                <div className="my-1 border-t border-[var(--color-border)]" />
                {namespaces.map((ns) => (
                  <Menu.Item key={ns.metadata.name}>
                    {({ active }) => (
                      <button
                        onClick={() => setCurrentNamespace(ns.metadata.name)}
                        className={clsx(
                          menuItemClass,
                          active && 'bg-primary-light',
                          currentNamespace === ns.metadata.name
                            ? 'text-[var(--color-primary)]'
                            : 'text-[var(--color-text-primary)]'
                        )}
                      >
                        {ns.metadata.name}
                      </button>
                    )}
                  </Menu.Item>
                ))}
              </div>
            </Menu.Items>
          </Transition>
        </Menu>

        {/* 主题切换 */}
        <button
          onClick={toggleTheme}
          className="min-h-[44px] min-w-[44px] rounded-lg p-2 text-[var(--color-text-secondary)] transition-colors duration-150 hover:bg-primary-light hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label={theme === 'dark' ? '切换到亮色主题' : '切换到暗色主题'}
          title={theme === 'dark' ? '切换到亮色主题' : '切换到暗色主题'}
        >
          {theme === 'dark' ? (
            <SunIcon className="w-5 h-5" />
          ) : (
            <MoonIcon className="w-5 h-5" />
          )}
        </button>

        {/* 通知 */}
        <button
          className="relative min-h-[44px] min-w-[44px] rounded-lg p-2 text-[var(--color-text-secondary)] transition-colors duration-150 hover:bg-primary-light hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="通知"
        >
          <BellIcon className="w-5 h-5" />
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[var(--color-error)]" />
        </button>

        {/* 用户菜单 */}
        <Menu as="div" className="relative">
          <Menu.Button
            className="flex min-h-[44px] items-center gap-2 rounded-lg p-2 text-[var(--color-text-secondary)] transition-colors duration-150 hover:bg-primary-light hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="打开用户菜单"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
              <span className="text-white text-sm font-medium">
                {user?.displayName?.[0] || user?.username?.[0]?.toUpperCase() || 'U'}
              </span>
            </div>
            <div className="hidden sm:block text-left">
              <div className="text-sm text-[var(--color-text-primary)]">
                {user?.displayName || user?.username}
              </div>
              <div className="text-xs text-[var(--color-text-muted)]">
                {roleDisplay}
              </div>
            </div>
            <ChevronDownIcon className="h-4 w-4 text-[var(--color-text-muted)]" />
          </Menu.Button>
          <Transition
            as={Fragment}
            enter="transition ease-out duration-100"
            enterFrom="transform opacity-0 scale-95"
            enterTo="transform opacity-100 scale-100"
            leave="transition ease-in duration-75"
            leaveFrom="transform opacity-100 scale-100"
            leaveTo="transform opacity-0 scale-95"
          >
            <Menu.Items className={menuPanelClass}>
              <div className="border-b border-[var(--color-border)] p-3">
                <div className="font-medium text-[var(--color-text-primary)]">
                  {user?.displayName || user?.username}
                </div>
                <div className="text-sm text-[var(--color-text-muted)]">
                  {user?.email || user?.username}
                </div>
                <div className="mt-1">
                  <span className="rounded bg-primary-light px-2 py-0.5 text-xs text-[var(--color-primary)]">
                    {roleDisplay}
                  </span>
                </div>
              </div>
              <div className="py-1">
                <Menu.Item>
                  {({ active }) => (
                    <Link
                      to="/settings"
                      className={clsx(
                        menuItemClass,
                        active
                          ? 'bg-primary-light text-[var(--color-text-primary)]'
                          : 'text-[var(--color-text-secondary)]'
                      )}
                    >
                      <Cog6ToothIcon className="w-4 h-4" />
                      设置
                    </Link>
                  )}
                </Menu.Item>
                {user?.role === 'admin' && (
                  <Menu.Item>
                    {({ active }) => (
                    <Link
                      to="/admin/users"
                      className={clsx(
                        menuItemClass,
                        active
                          ? 'bg-primary-light text-[var(--color-text-primary)]'
                          : 'text-[var(--color-text-secondary)]'
                      )}
                    >
                      <UserIcon className="w-4 h-4" />
                      用户管理
                      </Link>
                    )}
                  </Menu.Item>
                )}
                <div className="my-1 border-t border-[var(--color-border)]" />
                <Menu.Item>
                  {({ active }) => (
                    <button
                      onClick={handleLogout}
                      className={clsx(
                        menuItemClass,
                        active
                          ? 'bg-primary-light text-[var(--color-text-primary)]'
                          : 'text-[var(--color-text-secondary)]'
                      )}
                    >
                      <ArrowRightOnRectangleIcon className="w-4 h-4" />
                      退出登录
                    </button>
                  )}
                </Menu.Item>
              </div>
            </Menu.Items>
          </Transition>
        </Menu>
      </div>
    </header>
  );
}
