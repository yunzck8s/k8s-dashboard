import { QueryClient } from '@tanstack/react-query';
import type { QueryClient as QueryClientType } from '@tanstack/react-query';

const CLUSTER_SCOPED_ROOT_KEYS = [
  'overview',
  'alertSummary',
  'alerts',
  'events',
  'clusters',
  'namespaces',
  'pods',
  'pods-metrics',
  'deployments',
  'deployment',
  'deployment-pods',
  'deployment-yaml',
  'statefulsets',
  'statefulset',
  'statefulset-yaml',
  'statefulset-pods',
  'daemonsets',
  'daemonset',
  'daemonset-yaml',
  'daemonset-pods',
  'jobs',
  'job',
  'cronjobs',
  'replicasets',
  'nodes',
  'node',
  'services',
  'service',
  'service-yaml',
  'ingresses',
  'ingress',
  'ingress-yaml',
  'configmaps',
  'configmap',
  'configmap-yaml',
  'secrets',
  'secret',
  'secret-yaml',
  'persistentvolumes',
  'persistentvolumeclaims',
  'storageclasses',
  'roles',
  'clusterroles',
  'rolebindings',
  'clusterrolebindings',
  'serviceaccounts',
  'audit-logs',
  'audit-stats',
  'observation-summary',
  'observation-cpu-trend',
  'observation-memory-trend',
  'observation-restart-trend',
];

export function createQueryClient(): QueryClientType {
  return new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: 1,
        staleTime: 30_000,
        gcTime: 5 * 60_000,
      },
    },
  });
}

export function createVisibilityRefetchInterval(intervalMs: number): () => number | false {
  return () => {
    if (typeof document === 'undefined') {
      return intervalMs;
    }
    return document.visibilityState === 'visible' ? intervalMs : false;
  };
}

export async function invalidateClusterScopedQueries(queryClient: QueryClientType): Promise<void> {
  await Promise.all(
    CLUSTER_SCOPED_ROOT_KEYS.map((key) =>
      queryClient.invalidateQueries({
        queryKey: [key],
      })
    )
  );
}
