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
    <header className="h-16 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-6">
      {/* 左侧：搜索框 */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <MagnifyingGlassIcon className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="搜索资源..."
            className="w-80 bg-slate-700 border border-slate-600 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-0.5 text-xs text-slate-400 bg-slate-600 rounded">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* 右侧：操作区 */}
      <div className="flex items-center gap-4">
        {/* 集群选择器 */}
        {clusters.length > 0 && (
          <Menu as="div" className="relative">
            <Menu.Button className="flex items-center gap-2 px-3 py-2 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors">
              <ServerIcon className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-200">
                {currentCluster || '选择集群'}
              </span>
              <ChevronDownIcon className="w-4 h-4 text-slate-400" />
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
              <Menu.Items className="absolute right-0 mt-2 w-56 bg-slate-700 rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
                <div className="py-1">
                  {clusters.map((cluster) => (
                    <Menu.Item key={cluster.name}>
                      {({ active }) => (
                        <button
                          onClick={() => setCurrentCluster(cluster.name)}
                          className={clsx(
                            'w-full text-left px-4 py-2 text-sm flex items-center justify-between',
                            active ? 'bg-slate-600 text-white' : 'text-slate-300'
                          )}
                        >
                          <span>{cluster.name}</span>
                          <span
                            className={clsx(
                              'w-2 h-2 rounded-full',
                              cluster.status === 'connected'
                                ? 'bg-green-500'
                                : 'bg-red-500'
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
          <Menu.Button className="flex items-center gap-2 px-3 py-2 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors">
            <span className="text-sm text-slate-400">Namespace:</span>
            <span className="text-sm text-slate-200">{currentNamespace}</span>
            <ChevronDownIcon className="w-4 h-4 text-slate-400" />
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
            <Menu.Items className="absolute right-0 mt-2 w-56 max-h-80 overflow-y-auto bg-slate-700 rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
              <div className="py-1">
                <Menu.Item>
                  {({ active }) => (
                    <button
                      onClick={() => setCurrentNamespace('all')}
                      className={clsx(
                        'w-full text-left px-4 py-2 text-sm',
                        active ? 'bg-slate-600 text-white' : 'text-slate-300',
                        currentNamespace === 'all' && 'text-blue-400'
                      )}
                    >
                      所有命名空间
                    </button>
                  )}
                </Menu.Item>
                <div className="border-t border-slate-600 my-1" />
                {namespaces.map((ns) => (
                  <Menu.Item key={ns.metadata.name}>
                    {({ active }) => (
                      <button
                        onClick={() => setCurrentNamespace(ns.metadata.name)}
                        className={clsx(
                          'w-full text-left px-4 py-2 text-sm',
                          active ? 'bg-slate-600 text-white' : 'text-slate-300',
                          currentNamespace === ns.metadata.name && 'text-blue-400'
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
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          title={theme === 'dark' ? '切换到亮色主题' : '切换到暗色主题'}
        >
          {theme === 'dark' ? (
            <SunIcon className="w-5 h-5" />
          ) : (
            <MoonIcon className="w-5 h-5" />
          )}
        </button>

        {/* 通知 */}
        <button className="relative p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">
          <BellIcon className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        {/* 用户菜单 */}
        <Menu as="div" className="relative">
          <Menu.Button className="flex items-center gap-2 p-2 hover:bg-slate-700 rounded-lg transition-colors">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-medium">
                {user?.displayName?.[0] || user?.username?.[0]?.toUpperCase() || 'U'}
              </span>
            </div>
            <div className="hidden sm:block text-left">
              <div className="text-sm text-white">{user?.displayName || user?.username}</div>
              <div className="text-xs text-slate-400">{roleDisplay}</div>
            </div>
            <ChevronDownIcon className="w-4 h-4 text-slate-400" />
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
            <Menu.Items className="absolute right-0 mt-2 w-56 bg-slate-700 rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
              <div className="p-3 border-b border-slate-600">
                <div className="text-white font-medium">{user?.displayName || user?.username}</div>
                <div className="text-slate-400 text-sm">{user?.email || user?.username}</div>
                <div className="mt-1">
                  <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs">
                    {roleDisplay}
                  </span>
                </div>
              </div>
              <div className="py-1">
                <Menu.Item>
                  {({ active }) => (
                    <a
                      href="/settings"
                      className={clsx(
                        'flex items-center gap-2 px-4 py-2 text-sm',
                        active ? 'bg-slate-600 text-white' : 'text-slate-300'
                      )}
                    >
                      <Cog6ToothIcon className="w-4 h-4" />
                      设置
                    </a>
                  )}
                </Menu.Item>
                {user?.role === 'admin' && (
                  <>
                    <Menu.Item>
                      {({ active }) => (
                        <a
                          href="/admin/users"
                          className={clsx(
                            'flex items-center gap-2 px-4 py-2 text-sm',
                            active ? 'bg-slate-600 text-white' : 'text-slate-300'
                          )}
                        >
                          <UserIcon className="w-4 h-4" />
                          用户管理
                        </a>
                      )}
                    </Menu.Item>
                  </>
                )}
                <div className="border-t border-slate-600 my-1" />
                <Menu.Item>
                  {({ active }) => (
                    <button
                      onClick={handleLogout}
                      className={clsx(
                        'w-full flex items-center gap-2 px-4 py-2 text-sm',
                        active ? 'bg-slate-600 text-white' : 'text-slate-300'
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
