import { Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Transition } from '@headlessui/react';
import { useAppStore } from '../store';
import { useAuthStore, useRoleDisplay } from '../store/auth';
import { authApi } from '../api/auth';
import clsx from 'clsx';
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
  const {
    currentNamespace,
    setCurrentNamespace,
    namespaces,
    currentCluster,
    clusters,
    setCurrentCluster,
    theme,
    toggleTheme,
  } = useAppStore();

  const { user, clearAuth } = useAuthStore();
  const roleDisplay = useRoleDisplay();

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      // 忽略登出错误
    }
    clearAuth();
    navigate('/login');
  };

  return (
    <header
      className="h-16 flex items-center justify-between px-6"
      style={{
        background: 'var(--color-bg-secondary)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      {/* 左侧：搜索框 */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
          <input
            type="text"
            placeholder="搜索资源..."
            className="w-80 pl-10 pr-12 py-2 text-sm rounded-lg transition-all duration-150"
            style={{
              background: 'var(--color-bg-tertiary)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-primary)',
            }}
          />
          <kbd
            className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-0.5 text-xs rounded"
            style={{
              background: 'var(--color-bg-elevated)',
              color: 'var(--color-text-muted)',
            }}
          >
            ⌘K
          </kbd>
        </div>
      </div>

      {/* 右侧：操作区 */}
      <div className="flex items-center gap-4">
        {/* 集群选择器 */}
        {clusters.length > 0 && (
          <Menu as="div" className="relative">
            <Menu.Button
              className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors duration-150"
              style={{
                background: 'var(--color-bg-tertiary)',
                border: '1px solid var(--color-border)',
              }}
            >
              <ServerIcon className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
              <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                {currentCluster || '选择集群'}
              </span>
              <ChevronDownIcon className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
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
              <Menu.Items
                className="absolute right-0 mt-2 w-56 rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50"
                style={{ background: 'var(--color-bg-elevated)' }}
              >
                <div className="py-1">
                  {clusters.map((cluster) => (
                    <Menu.Item key={cluster.name}>
                      {({ active }) => (
                        <button
                          onClick={() => setCurrentCluster(cluster.name)}
                          className="w-full text-left px-4 py-2 text-sm flex items-center justify-between transition-colors duration-150"
                          style={{
                            background: active ? 'var(--color-primary-light)' : 'transparent',
                            color: 'var(--color-text-primary)',
                          }}
                        >
                          <span>{cluster.name}</span>
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{
                              background: cluster.status === 'connected' ? 'var(--color-success)' : 'var(--color-error)',
                            }}
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
          <Menu.Button
            className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors duration-150"
            style={{
              background: 'var(--color-bg-tertiary)',
              border: '1px solid var(--color-border)',
            }}
          >
            <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Namespace:</span>
            <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>{currentNamespace}</span>
            <ChevronDownIcon className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
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
            <Menu.Items
              className="absolute right-0 mt-2 w-56 max-h-80 overflow-y-auto rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50"
              style={{ background: 'var(--color-bg-elevated)' }}
            >
              <div className="py-1">
                <Menu.Item>
                  {({ active }) => (
                    <button
                      onClick={() => setCurrentNamespace('all')}
                      className="w-full text-left px-4 py-2 text-sm transition-colors duration-150"
                      style={{
                        background: active ? 'var(--color-primary-light)' : 'transparent',
                        color: currentNamespace === 'all' ? 'var(--color-primary)' : 'var(--color-text-primary)',
                      }}
                    >
                      所有命名空间
                    </button>
                  )}
                </Menu.Item>
                <div className="my-1" style={{ borderTop: '1px solid var(--color-border)' }} />
                {namespaces.map((ns) => (
                  <Menu.Item key={ns.metadata.name}>
                    {({ active }) => (
                      <button
                        onClick={() => setCurrentNamespace(ns.metadata.name)}
                        className="w-full text-left px-4 py-2 text-sm transition-colors duration-150"
                        style={{
                          background: active ? 'var(--color-primary-light)' : 'transparent',
                          color: currentNamespace === ns.metadata.name ? 'var(--color-primary)' : 'var(--color-text-primary)',
                        }}
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
          className="p-2 rounded-lg transition-colors duration-150"
          style={{ color: 'var(--color-text-secondary)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--color-primary-light)';
            e.currentTarget.style.color = 'var(--color-text-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--color-text-secondary)';
          }}
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
          className="relative p-2 rounded-lg transition-colors duration-150"
          style={{ color: 'var(--color-text-secondary)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--color-primary-light)';
            e.currentTarget.style.color = 'var(--color-text-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--color-text-secondary)';
          }}
        >
          <BellIcon className="w-5 h-5" />
          <span
            className="absolute top-1 right-1 w-2 h-2 rounded-full"
            style={{ background: 'var(--color-error)' }}
          />
        </button>

        {/* 用户菜单 */}
        <Menu as="div" className="relative">
          <Menu.Button
            className="flex items-center gap-2 p-2 rounded-lg transition-colors duration-150"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: 'var(--color-primary)' }}
            >
              <span className="text-white text-sm font-medium">
                {user?.displayName?.[0] || user?.username?.[0]?.toUpperCase() || 'U'}
              </span>
            </div>
            <div className="hidden sm:block text-left">
              <div className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                {user?.displayName || user?.username}
              </div>
              <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {roleDisplay}
              </div>
            </div>
            <ChevronDownIcon className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
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
            <Menu.Items
              className="absolute right-0 mt-2 w-56 rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50"
              style={{ background: 'var(--color-bg-elevated)' }}
            >
              <div className="p-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
                <div className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  {user?.displayName || user?.username}
                </div>
                <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  {user?.email || user?.username}
                </div>
                <div className="mt-1">
                  <span
                    className="px-2 py-0.5 rounded text-xs"
                    style={{
                      background: 'var(--color-primary-light)',
                      color: 'var(--color-primary)',
                    }}
                  >
                    {roleDisplay}
                  </span>
                </div>
              </div>
              <div className="py-1">
                <Menu.Item>
                  {({ active }) => (
                    <a
                      href="/settings"
                      className="flex items-center gap-2 px-4 py-2 text-sm transition-colors duration-150"
                      style={{
                        background: active ? 'var(--color-primary-light)' : 'transparent',
                        color: 'var(--color-text-primary)',
                      }}
                    >
                      <Cog6ToothIcon className="w-4 h-4" />
                      设置
                    </a>
                  )}
                </Menu.Item>
                {user?.role === 'admin' && (
                  <Menu.Item>
                    {({ active }) => (
                      <a
                        href="/admin/users"
                        className="flex items-center gap-2 px-4 py-2 text-sm transition-colors duration-150"
                        style={{
                          background: active ? 'var(--color-primary-light)' : 'transparent',
                          color: 'var(--color-text-primary)',
                        }}
                      >
                        <UserIcon className="w-4 h-4" />
                        用户管理
                      </a>
                    )}
                  </Menu.Item>
                )}
                <div className="my-1" style={{ borderTop: '1px solid var(--color-border)' }} />
                <Menu.Item>
                  {({ active }) => (
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm transition-colors duration-150"
                      style={{
                        background: active ? 'var(--color-primary-light)' : 'transparent',
                        color: 'var(--color-text-primary)',
                      }}
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
