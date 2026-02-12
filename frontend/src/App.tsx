import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MainLayout from './layouts/MainLayout';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Login from './pages/auth/Login';
import Dashboard from './pages/dashboard/Dashboard';
import Pods from './pages/workloads/pods/Pods';
import PodDetail from './pages/workloads/pods/PodDetail';
import Deployments from './pages/workloads/deployments/Deployments';
import DeploymentDetail from './pages/workloads/deployments/DeploymentDetail';
import StatefulSets from './pages/workloads/statefulsets/StatefulSets';
import StatefulSetDetail from './pages/workloads/statefulsets/StatefulSetDetail';
import DaemonSets from './pages/workloads/daemonsets/DaemonSets';
import DaemonSetDetail from './pages/workloads/daemonsets/DaemonSetDetail';
import Jobs from './pages/workloads/jobs/Jobs';
import JobDetail from './pages/workloads/jobs/JobDetail';
import CronJobs from './pages/workloads/jobs/CronJobs';
import CronJobDetail from './pages/workloads/jobs/CronJobDetail';
import Services from './pages/network/services/Services';
import ServiceDetail from './pages/network/services/ServiceDetail';
import Ingresses from './pages/network/ingresses/Ingresses';
import IngressDetail from './pages/network/ingresses/IngressDetail';
import ConfigMaps from './pages/config/configmaps/ConfigMaps';
import ConfigMapDetail from './pages/config/configmaps/ConfigMapDetail';
import Secrets from './pages/config/secrets/Secrets';
import SecretDetail from './pages/config/secrets/SecretDetail';
import PersistentVolumes from './pages/config/storage/PersistentVolumes';
import PersistentVolumeClaims from './pages/config/storage/PersistentVolumeClaims';
import StorageClasses from './pages/config/storage/StorageClasses';
import Nodes from './pages/nodes/Nodes';
import NodeDetail from './pages/nodes/NodeDetail';
import Namespaces from './pages/namespaces/Namespaces';
import NamespaceDetail from './pages/namespaces/NamespaceDetail';
import Roles from './pages/rbac/Roles';
import ClusterRoles from './pages/rbac/ClusterRoles';
import RoleBindings from './pages/rbac/RoleBindings';
import ClusterRoleBindings from './pages/rbac/ClusterRoleBindings';
import ServiceAccounts from './pages/rbac/ServiceAccounts';
import Clusters from './pages/clusters/Clusters';
import Settings from './pages/settings/Settings';
import Events from './pages/events/Events';
import AuditLogs from './pages/audit/AuditLogs';
import Alerts from './pages/alerts/Alerts';
import ClusterObservation from './pages/observation/ClusterObservation';
import NotFound from './pages/NotFound';
import Users from './pages/admin/Users';
import Approvals from './pages/admin/Approvals';
import Forbidden from './pages/Forbidden';

// 创建 QueryClient
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30000,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* 登录页面 - 不需要认证 */}
          <Route path="/login" element={<Login />} />
          <Route path="/403" element={<Forbidden />} />

          {/* 需要认证的路由 */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            {/* 首页重定向到仪表盘 */}
            <Route index element={<Navigate to="/dashboard" replace />} />

            {/* 仪表盘 */}
            <Route path="dashboard" element={<Dashboard />} />

            {/* 工作负载 */}
            <Route path="workloads">
              <Route path="pods" element={<Pods />} />
              <Route path="pods/:namespace/:name" element={<PodDetail />} />
              <Route path="deployments" element={<Deployments />} />
              <Route path="deployments/:namespace/:name" element={<DeploymentDetail />} />
              <Route path="statefulsets" element={<StatefulSets />} />
              <Route path="statefulsets/:namespace/:name" element={<StatefulSetDetail />} />
              <Route path="daemonsets" element={<DaemonSets />} />
              <Route path="daemonsets/:namespace/:name" element={<DaemonSetDetail />} />
              <Route path="jobs" element={<Jobs />} />
              <Route path="jobs/:namespace/:name" element={<JobDetail />} />
              <Route path="cronjobs" element={<CronJobs />} />
              <Route path="cronjobs/:namespace/:name" element={<CronJobDetail />} />
            </Route>

            {/* 网络 */}
            <Route path="network">
              <Route path="services" element={<Services />} />
              <Route path="services/:namespace/:name" element={<ServiceDetail />} />
              <Route path="ingresses" element={<Ingresses />} />
              <Route path="ingresses/:namespace/:name" element={<IngressDetail />} />
            </Route>

            {/* 配置与存储 */}
            <Route path="config">
              <Route path="configmaps" element={<ConfigMaps />} />
              <Route path="configmaps/:namespace/:name" element={<ConfigMapDetail />} />
              <Route path="secrets" element={<Secrets />} />
              <Route path="secrets/:namespace/:name" element={<SecretDetail />} />
              <Route path="persistentvolumes" element={<PersistentVolumes />} />
              <Route path="persistentvolumeclaims" element={<PersistentVolumeClaims />} />
              <Route path="storageclasses" element={<StorageClasses />} />
            </Route>

            {/* 节点 */}
            <Route path="nodes" element={<Nodes />} />
            <Route path="nodes/:name" element={<NodeDetail />} />

            {/* 命名空间 */}
            <Route path="namespaces" element={<Namespaces />} />
            <Route path="namespaces/:name" element={<NamespaceDetail />} />

            {/* RBAC */}
            <Route path="rbac">
              <Route path="roles" element={<Roles />} />
              <Route path="clusterroles" element={<ClusterRoles />} />
              <Route path="rolebindings" element={<RoleBindings />} />
              <Route path="clusterrolebindings" element={<ClusterRoleBindings />} />
              <Route path="serviceaccounts" element={<ServiceAccounts />} />
            </Route>

            {/* 集群 */}
            <Route
              path="clusters"
              element={
                <ProtectedRoute requiredRole="admin">
                  <Clusters />
                </ProtectedRoute>
              }
            />

            {/* 事件 */}
            <Route path="events" element={<Events />} />

            {/* 状态观测 */}
            <Route path="observation" element={<ClusterObservation />} />

            {/* 审计日志 */}
            <Route path="audit" element={<AuditLogs />} />

            {/* 告警 */}
            <Route path="alerts" element={<Alerts />} />

            {/* 管理（需要 admin 角色） */}
            <Route path="admin">
              <Route
                path="users"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <Users />
                  </ProtectedRoute>
                }
              />
              <Route
                path="approvals"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <Approvals />
                  </ProtectedRoute>
                }
              />
            </Route>

            {/* 设置 */}
            <Route path="settings" element={<Settings />} />

            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
