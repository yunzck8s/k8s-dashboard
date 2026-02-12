import { NavLink, useLocation } from 'react-router-dom';
import { useAppStore } from '../store';
import { useAuthStore } from '../store/auth';
import { preloadRoute } from '../routes/lazyRoutes';
import clsx from 'clsx';
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

interface NavItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: NavItem[];
  adminOnly?: boolean;
}

const navigation: NavItem[] = [
  { name: '仪表盘', path: '/dashboard', icon: HomeIcon },
  { name: '节点', path: '/nodes', icon: ServerIcon },
  {
    name: '工作负载',
    path: '/workloads',
    icon: CubeIcon,
    children: [
      { name: 'Pods', path: '/workloads/pods', icon: CubeIcon },
      { name: 'Deployments', path: '/workloads/deployments', icon: RectangleStackIcon },
      { name: 'StatefulSets', path: '/workloads/statefulsets', icon: CircleStackIcon },
      { name: 'DaemonSets', path: '/workloads/daemonsets', icon: ServerStackIcon },
      { name: 'Jobs', path: '/workloads/jobs', icon: ClockIcon },
      { name: 'CronJobs', path: '/workloads/cronjobs', icon: ArrowPathIcon },
    ],
  },
  {
    name: '网络',
    path: '/network',
    icon: GlobeAltIcon,
    children: [
      { name: 'Services', path: '/network/services', icon: GlobeAltIcon },
      { name: 'Ingresses', path: '/network/ingresses', icon: CloudIcon },
    ],
  },
  {
    name: '配置与存储',
    path: '/config',
    icon: Cog6ToothIcon,
    children: [
      { name: 'ConfigMaps', path: '/config/configmaps', icon: DocumentTextIcon },
      { name: 'Secrets', path: '/config/secrets', icon: ShieldCheckIcon },
      { name: 'PV', path: '/config/persistentvolumes', icon: ServerIcon },
      { name: 'PVC', path: '/config/persistentvolumeclaims', icon: FolderIcon },
      { name: 'StorageClasses', path: '/config/storageclasses', icon: CircleStackIcon },
    ],
  },
  { name: '命名空间', path: '/namespaces', icon: FolderIcon },
  {
    name: 'RBAC',
    path: '/rbac',
    icon: ShieldCheckIcon,
    children: [
      { name: 'Roles', path: '/rbac/roles', icon: ShieldCheckIcon },
      { name: 'ClusterRoles', path: '/rbac/clusterroles', icon: ShieldCheckIcon },
      { name: 'RoleBindings', path: '/rbac/rolebindings', icon: ShieldCheckIcon },
      { name: 'ClusterRoleBindings', path: '/rbac/clusterrolebindings', icon: ShieldCheckIcon },
      { name: 'ServiceAccounts', path: '/rbac/serviceaccounts', icon: ShieldCheckIcon },
    ],
  },
  { name: '事件', path: '/events', icon: ClipboardDocumentListIcon },
  { name: '状态观测', path: '/observation', icon: ChartBarSquareIcon },
  { name: '告警', path: '/alerts', icon: BellAlertIcon },
  { name: '集群', path: '/clusters', icon: Squares2X2Icon, adminOnly: true },
  { name: '审计日志', path: '/audit', icon: DocumentTextIcon },
  {
    name: '管理',
    path: '/admin',
    icon: UsersIcon,
    adminOnly: true,
    children: [
      { name: '用户管理', path: '/admin/users', icon: UsersIcon },
      { name: '审批管理', path: '/admin/approvals', icon: CheckBadgeIcon },
    ],
  },
  { name: '设置', path: '/settings', icon: Cog6ToothIcon },
];

export default function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useAppStore();
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  // 根据用户角色过滤导航项
  const filteredNavigation = navigation.filter((item) => {
    if (item.adminOnly && user?.role !== 'admin') {
      return false;
    }
    return true;
  });

  // 判断当前路径是否匹配
  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  // 判断父级菜单是否展开
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
        'fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-secondary)] transition-all duration-200',
        sidebarCollapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-center border-b border-[var(--color-border)] px-4">
        {sidebarCollapsed ? (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <span className="text-white font-bold">K</span>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <span className="text-white font-bold">K</span>
            </div>
            <span className="text-lg font-semibold text-[var(--color-text-primary)]">K8s Dashboard</span>
          </div>
        )}
      </div>

      {/* 导航菜单 */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <ul className="space-y-1 px-2">
          {filteredNavigation.map((item) => (
            <li key={item.path}>
              {item.children ? (
                // 有子菜单的项
                <div>
                  <NavLink
                    to={item.children[0].path}
                    className={clsx(
                      'sidebar-item',
                      isParentActive(item) && 'sidebar-item-active'
                    )}
                    onMouseEnter={() => handlePrefetch(item.children![0].path)}
                    onFocus={() => handlePrefetch(item.children![0].path)}
                    title={sidebarCollapsed ? item.name : undefined}
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                    {!sidebarCollapsed && <span>{item.name}</span>}
                  </NavLink>
                  {/* 子菜单 */}
                  {!sidebarCollapsed && isParentActive(item) && (
                    <ul className="mt-1 ml-4 space-y-1">
                      {item.children.map((child) => (
                        <li key={child.path}>
                          <NavLink
                            to={child.path}
                            className={({ isActive }) =>
                              clsx(
                                'sidebar-item text-sm',
                                isActive && 'sidebar-item-active'
                              )
                            }
                            onMouseEnter={() => handlePrefetch(child.path)}
                            onFocus={() => handlePrefetch(child.path)}
                          >
                            <child.icon className="w-4 h-4 flex-shrink-0" />
                            <span>{child.name}</span>
                          </NavLink>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                // 无子菜单的项
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    clsx('sidebar-item', isActive && 'sidebar-item-active')
                  }
                  onMouseEnter={() => handlePrefetch(item.path)}
                  onFocus={() => handlePrefetch(item.path)}
                  title={sidebarCollapsed ? item.name : undefined}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  {!sidebarCollapsed && <span>{item.name}</span>}
                </NavLink>
              )}
            </li>
          ))}
        </ul>
      </nav>

      {/* 折叠按钮 */}
      <button
        type="button"
        onClick={toggleSidebar}
        className="flex min-h-[48px] items-center justify-center border-t border-[var(--color-border)] transition-colors duration-150 hover:bg-primary-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-label={sidebarCollapsed ? '展开侧边栏' : '折叠侧边栏'}
      >
        {sidebarCollapsed ? (
          <ChevronRightIcon className="w-5 h-5 text-[var(--color-text-secondary)]" />
        ) : (
          <ChevronLeftIcon className="w-5 h-5 text-[var(--color-text-secondary)]" />
        )}
      </button>
    </aside>
  );
}
