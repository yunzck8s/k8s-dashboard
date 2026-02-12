import { useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { useAppStore } from '../store';
import { useAuthStore } from '../store/auth';
import { preloadRoute } from '../routes/lazyRoutes';
import {
  HomeIcon,
  CubeIcon,
  ServerStackIcon,
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
  RectangleStackIcon,
  CircleStackIcon,
  ClockIcon,
  ArrowPathIcon,
  CloudIcon,
  UsersIcon,
  CheckBadgeIcon,
  ChartBarSquareIcon,
} from '@heroicons/react/24/outline';

type NavSection = 'highFrequency' | 'workloads' | 'governance' | 'system';

interface NavItem {
  name: string;
  path: string;
  section: NavSection;
  icon: React.ComponentType<{ className?: string }>;
  children?: NavItem[];
  adminOnly?: boolean;
}

const sectionOrder: NavSection[] = ['highFrequency', 'workloads', 'governance', 'system'];

const sectionMeta: Record<NavSection, { label: string; highlight?: boolean }> = {
  highFrequency: { label: '高频视图', highlight: true },
  workloads: { label: '资源与网络' },
  governance: { label: '治理与审计' },
  system: { label: '系统管理' },
};

const navigation: NavItem[] = [
  { name: '仪表盘', path: '/dashboard', section: 'highFrequency', icon: HomeIcon },
  { name: '节点', path: '/nodes', section: 'highFrequency', icon: ServerIcon },
  {
    name: '工作负载',
    path: '/workloads',
    section: 'highFrequency',
    icon: CubeIcon,
    children: [
      { name: 'Pods', path: '/workloads/pods', section: 'highFrequency', icon: CubeIcon },
      { name: 'Deployments', path: '/workloads/deployments', section: 'highFrequency', icon: RectangleStackIcon },
      { name: 'StatefulSets', path: '/workloads/statefulsets', section: 'highFrequency', icon: CircleStackIcon },
      { name: 'DaemonSets', path: '/workloads/daemonsets', section: 'highFrequency', icon: ServerStackIcon },
      { name: 'Jobs', path: '/workloads/jobs', section: 'highFrequency', icon: ClockIcon },
      { name: 'CronJobs', path: '/workloads/cronjobs', section: 'highFrequency', icon: ArrowPathIcon },
    ],
  },
  {
    name: '网络',
    path: '/network',
    section: 'workloads',
    icon: GlobeAltIcon,
    children: [
      { name: 'Services', path: '/network/services', section: 'workloads', icon: GlobeAltIcon },
      { name: 'Ingresses', path: '/network/ingresses', section: 'workloads', icon: CloudIcon },
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
      { name: 'StorageClasses', path: '/config/storageclasses', section: 'workloads', icon: CircleStackIcon },
    ],
  },
  { name: '命名空间', path: '/namespaces', section: 'workloads', icon: FolderIcon },
  { name: '事件', path: '/events', section: 'highFrequency', icon: ClipboardDocumentListIcon },
  { name: '状态观测', path: '/observation', section: 'highFrequency', icon: ChartBarSquareIcon },
  { name: '告警', path: '/alerts', section: 'highFrequency', icon: BellAlertIcon },
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
  { name: '集群', path: '/clusters', section: 'system', icon: Squares2X2Icon, adminOnly: true },
  {
    name: '管理',
    path: '/admin',
    section: 'system',
    icon: UsersIcon,
    adminOnly: true,
    children: [
      { name: '用户管理', path: '/admin/users', section: 'system', icon: UsersIcon },
      { name: '审批管理', path: '/admin/approvals', section: 'system', icon: CheckBadgeIcon },
    ],
  },
  { name: '设置', path: '/settings', section: 'system', icon: Cog6ToothIcon },
];

export default function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useAppStore();
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

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

  return (
    <aside
      className={clsx(
        'fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-secondary)] transition-all duration-200 ease-out',
        sidebarCollapsed ? 'w-16' : 'w-64'
      )}
    >
      <div className="flex h-16 items-center justify-center border-b border-[var(--color-border)] px-4">
        {sidebarCollapsed ? (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <span className="font-bold text-white">K</span>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <span className="font-bold text-white">K</span>
            </div>
            <span className="text-lg font-semibold text-[var(--color-text-primary)]">K8s Dashboard</span>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        {groupedNavigation.map(({ section, items }) => (
          <section
            key={section}
            className={clsx(
              'mb-3 px-2',
              !sidebarCollapsed &&
                sectionMeta[section].highlight &&
                'mx-2 rounded-xl border border-divider-strong bg-surface-emphasis px-2 py-2'
            )}
          >
            {!sidebarCollapsed && (
              <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
                {sectionMeta[section].label}
              </p>
            )}
            <ul className="space-y-1">
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
                        <item.icon className="h-5 w-5 flex-shrink-0" />
                        {!sidebarCollapsed && <span>{item.name}</span>}
                      </NavLink>
                      {!sidebarCollapsed && isParentActive(item) && (
                        <ul className="ml-4 mt-1 space-y-1">
                          {item.children.map((child) => (
                            <li key={child.path}>
                              <NavLink
                                to={child.path}
                                className={({ isActive: active }) =>
                                  clsx('sidebar-item text-sm', active && 'sidebar-item-active')
                                }
                                onMouseEnter={() => handlePrefetch(child.path)}
                                onFocus={() => handlePrefetch(child.path)}
                              >
                                <child.icon className="h-4 w-4 flex-shrink-0" />
                                <span>{child.name}</span>
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
                      <item.icon className="h-5 w-5 flex-shrink-0" />
                      {!sidebarCollapsed && <span>{item.name}</span>}
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
        className="flex min-h-[48px] items-center justify-center border-t border-[var(--color-border)] transition-colors duration-150 ease-out hover:bg-primary-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
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
