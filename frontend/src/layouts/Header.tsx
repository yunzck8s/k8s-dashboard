import { Fragment, useMemo } from 'react';
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
  ClockIcon,
  MagnifyingGlassIcon,
  ChevronDownIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  SunIcon,
  MoonIcon,
  ServerIcon,
  UserIcon,
} from '@heroicons/react/24/outline';

function formatClusterStatus(status?: string) {
  if (status === 'connected') return '已连接';
  if (status === 'error') return '异常';
  return '未连接';
}

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

  const currentClusterStatus = useMemo(
    () => clusters.find((cluster) => cluster.name === currentCluster)?.status,
    [clusters, currentCluster]
  );
  const currentTimeLabel = useMemo(
    () =>
      new Date().toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    []
  );

  const selectTriggerClass =
    'flex min-h-[44px] items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-3 py-2 text-sm text-[var(--color-text-primary)] transition-colors duration-150 ease-out hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-elevated)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring';
  const menuPanelClass =
    'absolute right-0 z-50 mt-2 w-56 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-lg focus:outline-none';
  const menuItemClass =
    'flex w-full items-center gap-2 px-4 py-2 text-sm text-[var(--color-text-primary)] transition-colors duration-150 ease-out';
  const iconButtonClass =
    'relative flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-2 text-[var(--color-text-secondary)] transition-colors duration-150 ease-out hover:bg-primary-light hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring';
  const statusPillClass =
    'inline-flex items-center gap-1 rounded-md border border-divider-strong bg-surface-neutral px-2 py-1 text-[11px] text-[var(--color-text-secondary)]';

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
    <header className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
      <div className="flex h-10 items-center justify-between border-b border-divider-strong px-6">
        <div className="flex items-center gap-2 overflow-x-auto">
          <span className="inline-flex rounded-md bg-surface-emphasis px-2 py-1 text-[11px] font-semibold text-[var(--color-primary)]">
            状态中心
          </span>
          <span className={statusPillClass}>集群：{currentCluster || '未选择'}</span>
          <span className={statusPillClass}>命名空间：{currentNamespace}</span>
          <span
            className={clsx(
              statusPillClass,
              currentClusterStatus === 'connected'
                ? 'text-[var(--color-success)]'
                : currentClusterStatus === 'error'
                  ? 'text-[var(--color-error)]'
                  : 'text-[var(--color-warning)]'
            )}
          >
            连接：{formatClusterStatus(currentClusterStatus)}
          </span>
        </div>
        <div className="hidden items-center gap-2 text-xs text-[var(--color-text-muted)] md:flex">
          <ClockIcon className="h-3.5 w-3.5" />
          {currentTimeLabel}
        </div>
      </div>

      <div className="flex h-16 items-center justify-between px-6">
        {/* 左侧：搜索框 */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              type="text"
              placeholder="搜索资源..."
              className="h-11 w-72 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] py-2 pl-10 pr-12 text-sm text-[var(--color-text-primary)] transition-all duration-150 ease-out placeholder:text-[var(--color-text-muted)] focus-visible:border-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring lg:w-80"
              aria-label="搜索资源"
            />
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 rounded bg-[var(--color-bg-elevated)] px-2 py-0.5 text-xs text-[var(--color-text-muted)]">
              ⌘K
            </kbd>
          </div>
        </div>

        {/* 右侧：操作区 */}
        <div className="flex items-center gap-3">
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
                enter="transition ease-out duration-150"
                enterFrom="transform opacity-0 scale-95"
                enterTo="transform opacity-100 scale-100"
                leave="transition ease-in duration-100"
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
                              className={clsx(
                                'h-2 w-2 rounded-full',
                                cluster.status === 'connected'
                                  ? 'bg-[var(--color-success)]'
                                  : cluster.status === 'error'
                                    ? 'bg-[var(--color-error)]'
                                    : 'bg-[var(--color-warning)]'
                              )}
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
              enter="transition ease-out duration-150"
              enterFrom="transform opacity-0 scale-95"
              enterTo="transform opacity-100 scale-100"
              leave="transition ease-in duration-100"
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
                          currentNamespace === 'all'
                            ? 'text-[var(--color-primary)]'
                            : 'text-[var(--color-text-primary)]'
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

          {/* 通知 */}
          <button className={iconButtonClass} aria-label="通知">
            <BellIcon className="h-5 w-5" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[var(--color-error)]" />
          </button>

          {/* 主题切换 */}
          <button
            onClick={toggleTheme}
            className={iconButtonClass}
            aria-label={theme === 'dark' ? '切换到亮色主题' : '切换到暗色主题'}
            title={theme === 'dark' ? '切换到亮色主题' : '切换到暗色主题'}
          >
            {theme === 'dark' ? (
              <SunIcon className="h-5 w-5" />
            ) : (
              <MoonIcon className="h-5 w-5" />
            )}
          </button>

          {/* 用户菜单 */}
          <Menu as="div" className="relative">
            <Menu.Button
              className="flex min-h-[44px] items-center gap-2 rounded-lg p-2 text-[var(--color-text-secondary)] transition-colors duration-150 ease-out hover:bg-primary-light hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              aria-label="打开用户菜单"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
                <span className="text-sm font-medium text-white">
                  {user?.displayName?.[0] || user?.username?.[0]?.toUpperCase() || 'U'}
                </span>
              </div>
              <div className="hidden text-left sm:block">
                <div className="text-sm text-[var(--color-text-primary)]">
                  {user?.displayName || user?.username}
                </div>
                <div className="text-xs text-[var(--color-text-muted)]">{roleDisplay}</div>
              </div>
              <ChevronDownIcon className="h-4 w-4 text-[var(--color-text-muted)]" />
            </Menu.Button>
            <Transition
              as={Fragment}
              enter="transition ease-out duration-150"
              enterFrom="transform opacity-0 scale-95"
              enterTo="transform opacity-100 scale-100"
              leave="transition ease-in duration-100"
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
                        <Cog6ToothIcon className="h-4 w-4" />
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
                          <UserIcon className="h-4 w-4" />
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
                        <ArrowRightOnRectangleIcon className="h-4 w-4" />
                        退出登录
                      </button>
                    )}
                  </Menu.Item>
                </div>
              </Menu.Items>
            </Transition>
          </Menu>
        </div>
      </div>
    </header>
  );
}
