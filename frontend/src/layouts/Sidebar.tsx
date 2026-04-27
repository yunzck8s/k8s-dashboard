import { useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { useAppStore } from '../store';
import { useAuthStore } from '../store/auth';
import { preloadRoute } from '../routes/lazyRoutes';
import { alertApi, overviewApi } from '../api';
import { queryKeys } from '../api/queryKeys';
import { usePollingInterval } from '../utils/polling';
import { createVisibilityRefetchInterval } from '../api/queryPolicy';
import {
  CubeIcon,
  GlobeAltIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
  ShieldCheckIcon,
  ServerIcon,
  FolderIcon,
  BellAlertIcon,
  ClipboardDocumentListIcon,
  Squares2X2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  UsersIcon,
  ChartBarSquareIcon,
  BriefcaseIcon,
} from '@heroicons/react/24/outline';
import type { AlertSummary } from '../types/api';

type NavSection = 'highFrequency' | 'workloads' | 'governance' | 'system';

interface NavItem {
  name: string;
  path: string;
  section: NavSection;
  icon: React.ComponentType<{ className?: string }>;
  children?: NavItem[];
  adminOnly?: boolean;
  badge?: 'events' | 'alerts';
}

const sectionOrder: NavSection[] = ['highFrequency', 'workloads', 'governance', 'system'];

const sectionMeta: Record<NavSection, { label: string; highlight?: boolean }> = {
  highFrequency: { label: '高频视图', highlight: true },
  workloads: { label: '资源与网络' },
  governance: { label: '治理与审计' },
  system: { label: '系统管理' },
};

const navigation: NavItem[] = [
  { name: '仪表盘', path: '/dashboard', section: 'highFrequency', icon: Squares2X2Icon },
  { name: '节点', path: '/nodes', section: 'highFrequency', icon: BriefcaseIcon },
  {
    name: '工作负载',
    path: '/workloads',
    section: 'highFrequency',
    icon: CubeIcon,
    children: [
      { name: 'Pods', path: '/workloads/pods', section: 'highFrequency', icon: CubeIcon },
      { name: 'Deployments', path: '/workloads/deployments', section: 'highFrequency', icon: Squares2X2Icon },
      { name: 'StatefulSets', path: '/workloads/statefulsets', section: 'highFrequency', icon: ServerIcon },
      { name: 'DaemonSets', path: '/workloads/daemonsets', section: 'highFrequency', icon: ServerIcon },
      { name: 'ReplicaSets', path: '/workloads/replicasets', section: 'highFrequency', icon: Squares2X2Icon },
      { name: 'Jobs', path: '/workloads/jobs', section: 'highFrequency', icon: ClipboardDocumentListIcon },
      { name: 'CronJobs', path: '/workloads/cronjobs', section: 'highFrequency', icon: ClipboardDocumentListIcon },
    ],
  },
  {
    name: '网络',
    path: '/network',
    section: 'workloads',
    icon: GlobeAltIcon,
    children: [
      { name: 'Services', path: '/network/services', section: 'workloads', icon: GlobeAltIcon },
      { name: 'Ingresses', path: '/network/ingresses', section: 'workloads', icon: GlobeAltIcon },
    ],
  },
  {
    name: '配置与存储',
    path: '/config',
    section: 'workloads',
    icon: Cog6ToothIcon,
    children: [
      { name: 'ConfigMaps', path: '/config/configmaps', section: 'workloads', icon: DocumentTextIcon },
      { name: 'Secrets', path: '/config/secrets', section: 'workloads', icon: ShieldCheckIcon },
      { name: 'PV', path: '/config/persistentvolumes', section: 'workloads', icon: ServerIcon },
      { name: 'PVC', path: '/config/persistentvolumeclaims', section: 'workloads', icon: FolderIcon },
      { name: 'StorageClasses', path: '/config/storageclasses', section: 'workloads', icon: ServerIcon },
    ],
  },
  { name: '命名空间', path: '/namespaces', section: 'workloads', icon: Squares2X2Icon },
  { name: '事件', path: '/events', section: 'highFrequency', icon: ClipboardDocumentListIcon, badge: 'events' },
  { name: '状态观测', path: '/observation', section: 'highFrequency', icon: ChartBarSquareIcon },
  { name: '告警', path: '/alerts', section: 'highFrequency', icon: BellAlertIcon, badge: 'alerts' },
  {
    name: 'RBAC',
    path: '/rbac',
    section: 'governance',
    icon: ShieldCheckIcon,
    children: [
      { name: 'Roles', path: '/rbac/roles', section: 'governance', icon: ShieldCheckIcon },
      { name: 'ClusterRoles', path: '/rbac/clusterroles', section: 'governance', icon: ShieldCheckIcon },
      { name: 'RoleBindings', path: '/rbac/rolebindings', section: 'governance', icon: ShieldCheckIcon },
      { name: 'ClusterRoleBindings', path: '/rbac/clusterrolebindings', section: 'governance', icon: ShieldCheckIcon },
      { name: 'ServiceAccounts', path: '/rbac/serviceaccounts', section: 'governance', icon: ShieldCheckIcon },
    ],
  },
  { name: '审计日志', path: '/audit', section: 'governance', icon: DocumentTextIcon },
  { name: '用户管理', path: '/admin/users', section: 'system', icon: UsersIcon, adminOnly: true },
  { name: '系统设置', path: '/settings', section: 'system', icon: Cog6ToothIcon },
];

function formatBadge(value?: number): string | null {
  if (!value || value <= 0) return null;
  return value > 99 ? '99+' : String(value);
}

export default function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useAppStore();
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  const pollingInterval = usePollingInterval('standard');
  const standardRefetchInterval = createVisibilityRefetchInterval(pollingInterval);

  const { data: overview } = useQuery({
    queryKey: queryKeys.overview,
    queryFn: overviewApi.getOverview,
    refetchInterval: standardRefetchInterval,
  });

  const { data: alertSummary } = useQuery({
    queryKey: queryKeys.alertSummary,
    queryFn: alertApi.getSummary,
    refetchInterval: (query) => {
      const data = query.state.data as AlertSummary | undefined;
      if (data?.enabled === false) return false;
      return standardRefetchInterval();
    },
    retry: false,
  });

  const filteredNavigation = useMemo(
    () =>
      navigation.filter((item) => {
        if (item.adminOnly && user?.role !== 'admin') {
          return false;
        }
        return true;
      }),
    [user?.role]
  );

  const groupedNavigation = useMemo(
    () =>
      sectionOrder
        .map((section) => ({
          section,
          items: filteredNavigation.filter((item) => item.section === section),
        }))
        .filter((group) => group.items.length > 0),
    [filteredNavigation]
  );

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const isParentActive = (item: NavItem) => {
    if (item.children) {
      return item.children.some((child) => isActive(child.path));
    }
    return isActive(item.path);
  };

  const handlePrefetch = (path: string) => {
    preloadRoute(path);
  };

  const getBadge = (item: NavItem) => {
    if (item.badge === 'events') return formatBadge(overview?.events.warning);
    if (item.badge === 'alerts' && alertSummary?.enabled !== false) return formatBadge(alertSummary?.critical);
    return null;
  };

  const renderItemContent = (item: NavItem, compact = false) => {
    const badge = getBadge(item);
    return (
      <>
        <item.icon className={clsx('flex-shrink-0', compact ? 'h-4 w-4' : 'h-5 w-5')} />
        {!sidebarCollapsed && (
          <>
            <span className="hidden min-w-0 flex-1 truncate md:inline">{item.name}</span>
            {badge ? (
              <span
                className={clsx(
                  'hidden min-w-7 rounded-full px-2 py-0.5 text-center font-mono text-xs font-semibold md:inline-flex md:justify-center',
                  item.badge === 'alerts' ? 'bg-rose-500/25 text-rose-200' : 'bg-amber-400/20 text-amber-200'
                )}
              >
                {badge}
              </span>
            ) : null}
          </>
        )}
      </>
    );
  };

  return (
    <aside
      className={clsx(
        'fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-slate-800/90 bg-[#0b1017] text-slate-400 shadow-[16px_0_60px_rgba(0,0,0,.32)] transition-all duration-200 ease-out',
        sidebarCollapsed ? 'w-[72px]' : 'w-[72px] md:w-[256px]'
      )}
    >
      <div className={clsx('flex h-[72px] items-center border-b border-slate-800 px-4', sidebarCollapsed ? 'justify-center' : 'justify-between md:px-6')}>
        {sidebarCollapsed ? (
          <BrandMark />
        ) : (
          <div className="flex items-center gap-4">
            <BrandMark />
            <span className="hidden text-xl font-semibold tracking-tight text-slate-100 md:inline">K8s Dashboard</span>
          </div>
        )}
        {!sidebarCollapsed && (
          <button
            type="button"
            onClick={toggleSidebar}
            className="hidden h-12 w-12 items-center justify-center rounded-xl bg-slate-800/60 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 md:flex"
            aria-label="折叠侧边栏"
          >
            <ChevronLeftIcon className="h-6 w-6" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-5 md:px-5">
        {groupedNavigation.map(({ section, items }, index) => (
          <section
            key={section}
            className={clsx(
              'px-0',
              !sidebarCollapsed && index > 0 && 'md:mt-7 md:border-t md:border-slate-800 md:pt-7',
              sidebarCollapsed && index > 0 && 'mt-4 border-t border-slate-800 pt-4'
            )}
          >
            {!sidebarCollapsed && (
              <p className="hidden px-4 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 md:block">
                {sectionMeta[section].label}
              </p>
            )}
            <ul className="space-y-2">
              {items.map((item) => (
                <li key={item.path}>
                  {item.children ? (
                    <div>
                      <NavLink
                        to={item.children[0].path}
                        className={clsx('sidebar-item', isParentActive(item) && 'sidebar-item-active')}
                        onMouseEnter={() => handlePrefetch(item.children![0].path)}
                        onFocus={() => handlePrefetch(item.children![0].path)}
                        title={sidebarCollapsed ? item.name : undefined}
                      >
                        {renderItemContent(item)}
                      </NavLink>
                      {!sidebarCollapsed && isParentActive(item) && (
                        <ul className="ml-4 mt-2 hidden space-y-1 border-l border-slate-800 pl-3 md:block">
                          {item.children.map((child) => (
                            <li key={child.path}>
                              <NavLink
                                to={child.path}
                                className={({ isActive: active }) =>
                                  clsx('sidebar-item sidebar-subitem text-sm', active && 'sidebar-item-active')
                                }
                                onMouseEnter={() => handlePrefetch(child.path)}
                                onFocus={() => handlePrefetch(child.path)}
                              >
                                {renderItemContent(child, true)}
                              </NavLink>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : (
                    <NavLink
                      to={item.path}
                      className={({ isActive: active }) => clsx('sidebar-item', active && 'sidebar-item-active')}
                      onMouseEnter={() => handlePrefetch(item.path)}
                      onFocus={() => handlePrefetch(item.path)}
                      title={sidebarCollapsed ? item.name : undefined}
                    >
                      {renderItemContent(item)}
                    </NavLink>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </nav>

      <button
        type="button"
        onClick={toggleSidebar}
        className={clsx(
          'flex min-h-[56px] items-center justify-center border-t border-slate-800 text-slate-500 transition-colors duration-150 ease-out hover:bg-slate-800/70 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60',
          !sidebarCollapsed && 'md:hidden'
        )}
        aria-label={sidebarCollapsed ? '展开侧边栏' : '折叠侧边栏'}
      >
        {sidebarCollapsed ? (
          <ChevronRightIcon className="h-5 w-5 text-[var(--color-text-secondary)]" />
        ) : (
          <ChevronLeftIcon className="h-5 w-5 text-[var(--color-text-secondary)]" />
        )}
      </button>
    </aside>
  );
}

function BrandMark() {
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-400 to-indigo-600 shadow-[0_10px_30px_rgba(59,130,246,.25)]">
      <span className="font-mono text-xl font-bold text-white">K8</span>
    </div>
  );
}
