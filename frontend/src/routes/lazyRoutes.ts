import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

type RouteComponent = LazyExoticComponent<ComponentType<object>>;
type RouteImporter = () => Promise<{ default: ComponentType<object> }>;

function createLazyRoute(importer: RouteImporter): { Component: RouteComponent; preload: RouteImporter } {
  return {
    Component: lazy(importer),
    preload: importer,
  };
}

const loginRoute = createLazyRoute(() => import('../pages/auth/Login'));
const forbiddenRoute = createLazyRoute(() => import('../pages/Forbidden'));
const dashboardRoute = createLazyRoute(() => import('../pages/dashboard/Dashboard'));
const podsRoute = createLazyRoute(() => import('../pages/workloads/pods/Pods'));
const podDetailRoute = createLazyRoute(() => import('../pages/workloads/pods/PodDetail'));
const deploymentsRoute = createLazyRoute(() => import('../pages/workloads/deployments/Deployments'));
const deploymentDetailRoute = createLazyRoute(() => import('../pages/workloads/deployments/DeploymentDetail'));
const statefulSetsRoute = createLazyRoute(() => import('../pages/workloads/statefulsets/StatefulSets'));
const statefulSetDetailRoute = createLazyRoute(
  () => import('../pages/workloads/statefulsets/StatefulSetDetail')
);
const daemonSetsRoute = createLazyRoute(() => import('../pages/workloads/daemonsets/DaemonSets'));
const daemonSetDetailRoute = createLazyRoute(() => import('../pages/workloads/daemonsets/DaemonSetDetail'));
const jobsRoute = createLazyRoute(() => import('../pages/workloads/jobs/Jobs'));
const jobDetailRoute = createLazyRoute(() => import('../pages/workloads/jobs/JobDetail'));
const cronJobsRoute = createLazyRoute(() => import('../pages/workloads/jobs/CronJobs'));
const cronJobDetailRoute = createLazyRoute(() => import('../pages/workloads/jobs/CronJobDetail'));
const servicesRoute = createLazyRoute(() => import('../pages/network/services/Services'));
const serviceDetailRoute = createLazyRoute(() => import('../pages/network/services/ServiceDetail'));
const ingressesRoute = createLazyRoute(() => import('../pages/network/ingresses/Ingresses'));
const ingressDetailRoute = createLazyRoute(() => import('../pages/network/ingresses/IngressDetail'));
const configMapsRoute = createLazyRoute(() => import('../pages/config/configmaps/ConfigMaps'));
const configMapDetailRoute = createLazyRoute(() => import('../pages/config/configmaps/ConfigMapDetail'));
const secretsRoute = createLazyRoute(() => import('../pages/config/secrets/Secrets'));
const secretDetailRoute = createLazyRoute(() => import('../pages/config/secrets/SecretDetail'));
const persistentVolumesRoute = createLazyRoute(() => import('../pages/config/storage/PersistentVolumes'));
const persistentVolumeClaimsRoute = createLazyRoute(
  () => import('../pages/config/storage/PersistentVolumeClaims')
);
const storageClassesRoute = createLazyRoute(() => import('../pages/config/storage/StorageClasses'));
const nodesRoute = createLazyRoute(() => import('../pages/nodes/Nodes'));
const nodeDetailRoute = createLazyRoute(() => import('../pages/nodes/NodeDetail'));
const namespacesRoute = createLazyRoute(() => import('../pages/namespaces/Namespaces'));
const namespaceDetailRoute = createLazyRoute(() => import('../pages/namespaces/NamespaceDetail'));
const rolesRoute = createLazyRoute(() => import('../pages/rbac/Roles'));
const clusterRolesRoute = createLazyRoute(() => import('../pages/rbac/ClusterRoles'));
const roleBindingsRoute = createLazyRoute(() => import('../pages/rbac/RoleBindings'));
const clusterRoleBindingsRoute = createLazyRoute(() => import('../pages/rbac/ClusterRoleBindings'));
const serviceAccountsRoute = createLazyRoute(() => import('../pages/rbac/ServiceAccounts'));
const clustersRoute = createLazyRoute(() => import('../pages/clusters/Clusters'));
const settingsRoute = createLazyRoute(() => import('../pages/settings/Settings'));
const eventsRoute = createLazyRoute(() => import('../pages/events/Events'));
const auditLogsRoute = createLazyRoute(() => import('../pages/audit/AuditLogs'));
const alertsRoute = createLazyRoute(() => import('../pages/alerts/Alerts'));
const clusterObservationRoute = createLazyRoute(() => import('../pages/observation/ClusterObservation'));
const usersRoute = createLazyRoute(() => import('../pages/admin/Users'));
const approvalsRoute = createLazyRoute(() => import('../pages/admin/Approvals'));
const notFoundRoute = createLazyRoute(() => import('../pages/NotFound'));

export const lazyRoutes = {
  Login: loginRoute.Component,
  Forbidden: forbiddenRoute.Component,
  Dashboard: dashboardRoute.Component,
  Pods: podsRoute.Component,
  PodDetail: podDetailRoute.Component,
  Deployments: deploymentsRoute.Component,
  DeploymentDetail: deploymentDetailRoute.Component,
  StatefulSets: statefulSetsRoute.Component,
  StatefulSetDetail: statefulSetDetailRoute.Component,
  DaemonSets: daemonSetsRoute.Component,
  DaemonSetDetail: daemonSetDetailRoute.Component,
  Jobs: jobsRoute.Component,
  JobDetail: jobDetailRoute.Component,
  CronJobs: cronJobsRoute.Component,
  CronJobDetail: cronJobDetailRoute.Component,
  Services: servicesRoute.Component,
  ServiceDetail: serviceDetailRoute.Component,
  Ingresses: ingressesRoute.Component,
  IngressDetail: ingressDetailRoute.Component,
  ConfigMaps: configMapsRoute.Component,
  ConfigMapDetail: configMapDetailRoute.Component,
  Secrets: secretsRoute.Component,
  SecretDetail: secretDetailRoute.Component,
  PersistentVolumes: persistentVolumesRoute.Component,
  PersistentVolumeClaims: persistentVolumeClaimsRoute.Component,
  StorageClasses: storageClassesRoute.Component,
  Nodes: nodesRoute.Component,
  NodeDetail: nodeDetailRoute.Component,
  Namespaces: namespacesRoute.Component,
  NamespaceDetail: namespaceDetailRoute.Component,
  Roles: rolesRoute.Component,
  ClusterRoles: clusterRolesRoute.Component,
  RoleBindings: roleBindingsRoute.Component,
  ClusterRoleBindings: clusterRoleBindingsRoute.Component,
  ServiceAccounts: serviceAccountsRoute.Component,
  Clusters: clustersRoute.Component,
  Settings: settingsRoute.Component,
  Events: eventsRoute.Component,
  AuditLogs: auditLogsRoute.Component,
  Alerts: alertsRoute.Component,
  ClusterObservation: clusterObservationRoute.Component,
  Users: usersRoute.Component,
  Approvals: approvalsRoute.Component,
  NotFound: notFoundRoute.Component,
};

const routePreloaders: Record<string, RouteImporter[]> = {
  '/dashboard': [dashboardRoute.preload],
  '/nodes': [nodesRoute.preload, nodeDetailRoute.preload],
  '/workloads/pods': [podsRoute.preload, podDetailRoute.preload],
  '/workloads/deployments': [deploymentsRoute.preload, deploymentDetailRoute.preload],
  '/workloads/statefulsets': [statefulSetsRoute.preload, statefulSetDetailRoute.preload],
  '/workloads/daemonsets': [daemonSetsRoute.preload, daemonSetDetailRoute.preload],
  '/workloads/jobs': [jobsRoute.preload, jobDetailRoute.preload],
  '/workloads/cronjobs': [cronJobsRoute.preload, cronJobDetailRoute.preload],
  '/network/services': [servicesRoute.preload, serviceDetailRoute.preload],
  '/network/ingresses': [ingressesRoute.preload, ingressDetailRoute.preload],
  '/config/configmaps': [configMapsRoute.preload, configMapDetailRoute.preload],
  '/config/secrets': [secretsRoute.preload, secretDetailRoute.preload],
  '/config/persistentvolumes': [persistentVolumesRoute.preload],
  '/config/persistentvolumeclaims': [persistentVolumeClaimsRoute.preload],
  '/config/storageclasses': [storageClassesRoute.preload],
  '/namespaces': [namespacesRoute.preload, namespaceDetailRoute.preload],
  '/rbac/roles': [rolesRoute.preload],
  '/rbac/clusterroles': [clusterRolesRoute.preload],
  '/rbac/rolebindings': [roleBindingsRoute.preload],
  '/rbac/clusterrolebindings': [clusterRoleBindingsRoute.preload],
  '/rbac/serviceaccounts': [serviceAccountsRoute.preload],
  '/events': [eventsRoute.preload],
  '/observation': [clusterObservationRoute.preload],
  '/alerts': [alertsRoute.preload],
  '/clusters': [clustersRoute.preload],
  '/audit': [auditLogsRoute.preload],
  '/admin/users': [usersRoute.preload],
  '/admin/approvals': [approvalsRoute.preload],
  '/settings': [settingsRoute.preload],
};

const preloadedEntries = new Set<string>();

export function preloadRoute(path: string): void {
  Object.entries(routePreloaders).forEach(([routePath, preloaders]) => {
    if (path !== routePath && !path.startsWith(`${routePath}/`)) {
      return;
    }

    preloaders.forEach((preload, index) => {
      const cacheKey = `${routePath}:${index}`;
      if (preloadedEntries.has(cacheKey)) {
        return;
      }
      preloadedEntries.add(cacheKey);
      void preload().catch(() => {
        preloadedEntries.delete(cacheKey);
      });
    });
  });
}
