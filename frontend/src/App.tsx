import { Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import MainLayout from './layouts/MainLayout';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { createQueryClient } from './api/queryPolicy';
import { lazyRoutes } from './routes/lazyRoutes';

const queryClient = createQueryClient();

function RouteFallback() {
  return (
    <div className="flex items-center justify-center h-[40vh]">
      <div className="flex items-center gap-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        <div
          className="animate-spin rounded-full h-5 w-5 border-b-2"
          style={{ borderColor: 'var(--color-primary)' }}
        />
        <span>页面加载中...</span>
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/login" element={<lazyRoutes.Login />} />
            <Route path="/403" element={<lazyRoutes.Forbidden />} />

            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <MainLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />

              <Route path="dashboard" element={<lazyRoutes.Dashboard />} />

              <Route path="workloads">
                <Route path="pods" element={<lazyRoutes.Pods />} />
                <Route path="pods/:namespace/:name" element={<lazyRoutes.PodDetail />} />
                <Route path="deployments" element={<lazyRoutes.Deployments />} />
                <Route
                  path="deployments/:namespace/:name"
                  element={<lazyRoutes.DeploymentDetail />}
                />
                <Route path="statefulsets" element={<lazyRoutes.StatefulSets />} />
                <Route
                  path="statefulsets/:namespace/:name"
                  element={<lazyRoutes.StatefulSetDetail />}
                />
                <Route path="daemonsets" element={<lazyRoutes.DaemonSets />} />
                <Route
                  path="daemonsets/:namespace/:name"
                  element={<lazyRoutes.DaemonSetDetail />}
                />
                <Route path="jobs" element={<lazyRoutes.Jobs />} />
                <Route path="jobs/:namespace/:name" element={<lazyRoutes.JobDetail />} />
                <Route path="cronjobs" element={<lazyRoutes.CronJobs />} />
                <Route path="cronjobs/:namespace/:name" element={<lazyRoutes.CronJobDetail />} />
              </Route>

              <Route path="network">
                <Route path="services" element={<lazyRoutes.Services />} />
                <Route path="services/:namespace/:name" element={<lazyRoutes.ServiceDetail />} />
                <Route path="ingresses" element={<lazyRoutes.Ingresses />} />
                <Route path="ingresses/:namespace/:name" element={<lazyRoutes.IngressDetail />} />
              </Route>

              <Route path="config">
                <Route path="configmaps" element={<lazyRoutes.ConfigMaps />} />
                <Route
                  path="configmaps/:namespace/:name"
                  element={<lazyRoutes.ConfigMapDetail />}
                />
                <Route path="secrets" element={<lazyRoutes.Secrets />} />
                <Route path="secrets/:namespace/:name" element={<lazyRoutes.SecretDetail />} />
                <Route path="persistentvolumes" element={<lazyRoutes.PersistentVolumes />} />
                <Route
                  path="persistentvolumeclaims"
                  element={<lazyRoutes.PersistentVolumeClaims />}
                />
                <Route path="storageclasses" element={<lazyRoutes.StorageClasses />} />
              </Route>

              <Route path="nodes" element={<lazyRoutes.Nodes />} />
              <Route path="nodes/:name" element={<lazyRoutes.NodeDetail />} />

              <Route path="namespaces" element={<lazyRoutes.Namespaces />} />
              <Route path="namespaces/:name" element={<lazyRoutes.NamespaceDetail />} />

              <Route path="rbac">
                <Route path="roles" element={<lazyRoutes.Roles />} />
                <Route path="clusterroles" element={<lazyRoutes.ClusterRoles />} />
                <Route path="rolebindings" element={<lazyRoutes.RoleBindings />} />
                <Route
                  path="clusterrolebindings"
                  element={<lazyRoutes.ClusterRoleBindings />}
                />
                <Route path="serviceaccounts" element={<lazyRoutes.ServiceAccounts />} />
              </Route>

              <Route
                path="clusters"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <lazyRoutes.Clusters />
                  </ProtectedRoute>
                }
              />

              <Route path="events" element={<lazyRoutes.Events />} />
              <Route path="observation" element={<lazyRoutes.ClusterObservation />} />
              <Route path="audit" element={<lazyRoutes.AuditLogs />} />
              <Route path="alerts" element={<lazyRoutes.Alerts />} />

              <Route path="admin">
                <Route
                  path="users"
                  element={
                    <ProtectedRoute requiredRole="admin">
                      <lazyRoutes.Users />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="approvals"
                  element={
                    <ProtectedRoute requiredRole="admin">
                      <lazyRoutes.Approvals />
                    </ProtectedRoute>
                  }
                />
              </Route>

              <Route path="settings" element={<lazyRoutes.Settings />} />
              <Route path="*" element={<lazyRoutes.NotFound />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
