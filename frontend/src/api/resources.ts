import { get, post, put, del, putYaml } from './client';
import type {
  Pod,
  Deployment,
  StatefulSet,
  DaemonSet,
  Job,
  CronJob,
  ReplicaSet,
  Service,
  ServiceInput,
  Ingress,
  IngressInput,
  ConfigMap,
  ConfigMapInput,
  Secret,
  SecretInput,
  PersistentVolume,
  PersistentVolumeClaim,
  StorageClass,
  Node,
  Namespace,
  ResourceQuota,
  LimitRange,
  Event,
  Role,
  ClusterRole,
  RoleBinding,
  ClusterRoleBinding,
  ServiceAccount,
} from '../types/kubernetes';
import type {
  ListResponse,
  ClusterOverview,
  NodeMetrics,
  PodMetrics,
  ListParams,
  ScaleRequest,
  RollbackRequest,
  AuditLog,
  Alert,
  AlertSummary,
  AlertAcknowledgement,
  Silence,
  ClusterInfo,
} from '../types/api';

// 构建查询参数
function buildParams(params?: ListParams): Record<string, unknown> {
  if (!params) return {};
  const result: Record<string, unknown> = {};
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      result[key] = value;
    }
  });
  return result;
}

// ============ 集群概览 ============
export const overviewApi = {
  getOverview: () => get<ClusterOverview>('/overview'),
};

// ============ Namespace ============
export const namespaceApi = {
  list: (params?: ListParams) =>
    get<ListResponse<Namespace>>('/namespaces', buildParams(params)),
  get: (name: string) => get<Namespace>(`/namespaces/${name}`),
  create: (data: Namespace) => post<Namespace>('/namespaces', data),
  update: (name: string, data: Namespace) => put<Namespace>(`/namespaces/${name}`, data),
  delete: (name: string) => del<void>(`/namespaces/${name}`),
};

// ============ Pod ============
export const podApi = {
  list: (namespace: string, params?: ListParams) =>
    get<ListResponse<Pod>>(`/namespaces/${namespace}/pods`, buildParams(params)),
  listAll: (params?: ListParams) =>
    get<ListResponse<Pod>>('/pods', buildParams(params)),
  get: (namespace: string, name: string) =>
    get<Pod>(`/namespaces/${namespace}/pods/${name}`),
  delete: (namespace: string, name: string) =>
    del<void>(`/namespaces/${namespace}/pods/${name}`),
  getYaml: (namespace: string, name: string) =>
    get<string>(`/namespaces/${namespace}/pods/${name}/yaml`),
  getMetrics: (namespace: string, name: string) =>
    get<PodMetrics>(`/namespaces/${namespace}/pods/${name}/metrics`),
  getEvents: (namespace: string, name: string) =>
    get<ListResponse<Event>>(`/namespaces/${namespace}/pods/${name}/events`),
  getLogs: (namespace: string, name: string, container: string, tailLines: number = 500) =>
    get<string>(`/namespaces/${namespace}/pods/${name}/logs`, { container, tailLines }),
  listAllMetrics: () =>
    get<ListResponse<PodMetrics>>('/metrics/pods'),
};

// ============ Deployment ============
export const deploymentApi = {
  list: (namespace: string, params?: ListParams) =>
    get<ListResponse<Deployment>>(`/namespaces/${namespace}/deployments`, buildParams(params)),
  listAll: (params?: ListParams) =>
    get<ListResponse<Deployment>>('/deployments', buildParams(params)),
  get: (namespace: string, name: string) =>
    get<Deployment>(`/namespaces/${namespace}/deployments/${name}`),
  create: (namespace: string, data: Deployment) =>
    post<Deployment>(`/namespaces/${namespace}/deployments`, data),
  update: (namespace: string, name: string, data: Deployment) =>
    put<Deployment>(`/namespaces/${namespace}/deployments/${name}`, data),
  delete: (namespace: string, name: string) =>
    del<void>(`/namespaces/${namespace}/deployments/${name}`),
  scale: (namespace: string, name: string, data: ScaleRequest) =>
    post<void>(`/namespaces/${namespace}/deployments/${name}/scale`, data),
  restart: (namespace: string, name: string) =>
    post<void>(`/namespaces/${namespace}/deployments/${name}/restart`),
  rollback: (namespace: string, name: string, data: RollbackRequest) =>
    post<void>(`/namespaces/${namespace}/deployments/${name}/rollback`, data),
  getYaml: (namespace: string, name: string) =>
    get<string>(`/namespaces/${namespace}/deployments/${name}/yaml`),
  updateYaml: (namespace: string, name: string, yaml: string) =>
    putYaml<Deployment>(`/namespaces/${namespace}/deployments/${name}/yaml`, yaml),
  getRevisions: (namespace: string, name: string) =>
    get<{ items: Array<{ name: string; revision: string; replicas: number; ready: number; created: string; image: string }> }>(`/namespaces/${namespace}/deployments/${name}/revisions`),
  getPods: (namespace: string, name: string) =>
    get<ListResponse<Pod>>(`/namespaces/${namespace}/deployments/${name}/pods`),
  getEvents: (namespace: string, name: string) =>
    get<ListResponse<Event>>(`/namespaces/${namespace}/deployments/${name}/events`),
  updateStrategy: (namespace: string, name: string, strategy: { type: string; maxUnavailable?: string; maxSurge?: string }) =>
    put<void>(`/namespaces/${namespace}/deployments/${name}/strategy`, strategy),
  pause: (namespace: string, name: string) =>
    post<void>(`/namespaces/${namespace}/deployments/${name}/pause`),
  resume: (namespace: string, name: string) =>
    post<void>(`/namespaces/${namespace}/deployments/${name}/resume`),
  updateImage: (namespace: string, name: string, containers: Array<{ name: string; image: string }>) =>
    put<void>(`/namespaces/${namespace}/deployments/${name}/image`, { containers }),
  updateScheduling: (namespace: string, name: string, data: { nodeSelector?: Record<string, string>; tolerations?: Array<{ key?: string; operator?: string; value?: string; effect?: string }> }) =>
    put<void>(`/namespaces/${namespace}/deployments/${name}/scheduling`, data),
};

// ============ StatefulSet ============
export const statefulSetApi = {
  list: (namespace: string, params?: ListParams) =>
    get<ListResponse<StatefulSet>>(`/namespaces/${namespace}/statefulsets`, buildParams(params)),
  listAll: (params?: ListParams) =>
    get<ListResponse<StatefulSet>>('/statefulsets', buildParams(params)),
  get: (namespace: string, name: string) =>
    get<StatefulSet>(`/namespaces/${namespace}/statefulsets/${name}`),
  create: (namespace: string, data: StatefulSet) =>
    post<StatefulSet>(`/namespaces/${namespace}/statefulsets`, data),
  update: (namespace: string, name: string, data: StatefulSet) =>
    put<StatefulSet>(`/namespaces/${namespace}/statefulsets/${name}`, data),
  delete: (namespace: string, name: string) =>
    del<void>(`/namespaces/${namespace}/statefulsets/${name}`),
  scale: (namespace: string, name: string, data: ScaleRequest) =>
    post<void>(`/namespaces/${namespace}/statefulsets/${name}/scale`, data),
  restart: (namespace: string, name: string) =>
    post<void>(`/namespaces/${namespace}/statefulsets/${name}/restart`),
  getYaml: (namespace: string, name: string) =>
    get<string>(`/namespaces/${namespace}/statefulsets/${name}/yaml`),
  updateYaml: (namespace: string, name: string, yaml: string) =>
    putYaml<StatefulSet>(`/namespaces/${namespace}/statefulsets/${name}/yaml`, yaml),
  getPods: (namespace: string, name: string) =>
    get<ListResponse<Pod>>(`/namespaces/${namespace}/statefulsets/${name}/pods`),
  getEvents: (namespace: string, name: string) =>
    get<ListResponse<Event>>(`/namespaces/${namespace}/statefulsets/${name}/events`),
  updateStrategy: (namespace: string, name: string, strategy: { type: string; partition?: number }) =>
    put<void>(`/namespaces/${namespace}/statefulsets/${name}/strategy`, strategy),
  getRevisions: (namespace: string, name: string) =>
    get<{ items: Array<{ revision: number; name: string; createdAt: string; current: boolean }> }>(`/namespaces/${namespace}/statefulsets/${name}/revisions`),
  rollback: (namespace: string, name: string, revision: number) =>
    post<void>(`/namespaces/${namespace}/statefulsets/${name}/rollback`, { revision }),
};

// ============ DaemonSet ============
export const daemonSetApi = {
  list: (namespace: string, params?: ListParams) =>
    get<ListResponse<DaemonSet>>(`/namespaces/${namespace}/daemonsets`, buildParams(params)),
  listAll: (params?: ListParams) =>
    get<ListResponse<DaemonSet>>('/daemonsets', buildParams(params)),
  get: (namespace: string, name: string) =>
    get<DaemonSet>(`/namespaces/${namespace}/daemonsets/${name}`),
  create: (namespace: string, data: DaemonSet) =>
    post<DaemonSet>(`/namespaces/${namespace}/daemonsets`, data),
  update: (namespace: string, name: string, data: DaemonSet) =>
    put<DaemonSet>(`/namespaces/${namespace}/daemonsets/${name}`, data),
  delete: (namespace: string, name: string) =>
    del<void>(`/namespaces/${namespace}/daemonsets/${name}`),
  restart: (namespace: string, name: string) =>
    post<void>(`/namespaces/${namespace}/daemonsets/${name}/restart`),
  getYaml: (namespace: string, name: string) =>
    get<string>(`/namespaces/${namespace}/daemonsets/${name}/yaml`),
  updateYaml: (namespace: string, name: string, yaml: string) =>
    putYaml<DaemonSet>(`/namespaces/${namespace}/daemonsets/${name}/yaml`, yaml),
  getPods: (namespace: string, name: string) =>
    get<ListResponse<Pod>>(`/namespaces/${namespace}/daemonsets/${name}/pods`),
  getEvents: (namespace: string, name: string) =>
    get<ListResponse<Event>>(`/namespaces/${namespace}/daemonsets/${name}/events`),
  updateStrategy: (namespace: string, name: string, strategy: { type: string; maxUnavailable?: string; maxSurge?: string }) =>
    put<void>(`/namespaces/${namespace}/daemonsets/${name}/strategy`, strategy),
};

// ============ Job ============
export const jobApi = {
  list: (namespace: string, params?: ListParams) =>
    get<ListResponse<Job>>(`/namespaces/${namespace}/jobs`, buildParams(params)),
  listAll: (params?: ListParams) =>
    get<ListResponse<Job>>('/jobs', buildParams(params)),
  get: (namespace: string, name: string) =>
    get<Job>(`/namespaces/${namespace}/jobs/${name}`),
  create: (namespace: string, data: Job) =>
    post<Job>(`/namespaces/${namespace}/jobs`, data),
  delete: (namespace: string, name: string) =>
    del<void>(`/namespaces/${namespace}/jobs/${name}`),
  getYaml: (namespace: string, name: string) =>
    get<string>(`/namespaces/${namespace}/jobs/${name}/yaml`),
  getPods: (namespace: string, name: string) =>
    get<ListResponse<Pod>>(`/namespaces/${namespace}/jobs/${name}/pods`),
};

// ============ CronJob ============
export const cronJobApi = {
  list: (namespace: string, params?: ListParams) =>
    get<ListResponse<CronJob>>(`/namespaces/${namespace}/cronjobs`, buildParams(params)),
  listAll: (params?: ListParams) =>
    get<ListResponse<CronJob>>('/cronjobs', buildParams(params)),
  get: (namespace: string, name: string) =>
    get<CronJob>(`/namespaces/${namespace}/cronjobs/${name}`),
  create: (namespace: string, data: CronJob) =>
    post<CronJob>(`/namespaces/${namespace}/cronjobs`, data),
  update: (namespace: string, name: string, data: CronJob) =>
    put<CronJob>(`/namespaces/${namespace}/cronjobs/${name}`, data),
  delete: (namespace: string, name: string) =>
    del<void>(`/namespaces/${namespace}/cronjobs/${name}`),
  trigger: (namespace: string, name: string) =>
    post<Job>(`/namespaces/${namespace}/cronjobs/${name}/trigger`),
  suspend: (namespace: string, name: string, suspend: boolean) =>
    post<void>(`/namespaces/${namespace}/cronjobs/${name}/suspend`, { suspend }),
  getYaml: (namespace: string, name: string) =>
    get<string>(`/namespaces/${namespace}/cronjobs/${name}/yaml`),
};

// ============ ReplicaSet ============
export const replicaSetApi = {
  list: (namespace: string, params?: ListParams) =>
    get<ListResponse<ReplicaSet>>(`/namespaces/${namespace}/replicasets`, buildParams(params)),
  listAll: (params?: ListParams) =>
    get<ListResponse<ReplicaSet>>('/replicasets', buildParams(params)),
  get: (namespace: string, name: string) =>
    get<ReplicaSet>(`/namespaces/${namespace}/replicasets/${name}`),
  delete: (namespace: string, name: string) =>
    del<void>(`/namespaces/${namespace}/replicasets/${name}`),
  getYaml: (namespace: string, name: string) =>
    get<string>(`/namespaces/${namespace}/replicasets/${name}/yaml`),
};

// ============ Service ============
export const serviceApi = {
  list: (namespace: string, params?: ListParams) =>
    get<ListResponse<Service>>(`/namespaces/${namespace}/services`, buildParams(params)),
  listAll: (params?: ListParams) =>
    get<ListResponse<Service>>('/services', buildParams(params)),
  get: (namespace: string, name: string) =>
    get<Service>(`/namespaces/${namespace}/services/${name}`),
  create: (namespace: string, data: ServiceInput) =>
    post<Service>(`/namespaces/${namespace}/services`, data),
  update: (namespace: string, name: string, data: Service) =>
    put<Service>(`/namespaces/${namespace}/services/${name}`, data),
  delete: (namespace: string, name: string) =>
    del<void>(`/namespaces/${namespace}/services/${name}`),
  getYaml: (namespace: string, name: string) =>
    get<string>(`/namespaces/${namespace}/services/${name}/yaml`),
  updateYaml: (namespace: string, name: string, yaml: string) =>
    putYaml<Service>(`/namespaces/${namespace}/services/${name}/yaml`, yaml),
  getEndpoints: (namespace: string, name: string) =>
    get<Pod[]>(`/namespaces/${namespace}/services/${name}/endpoints`),
};

// ============ Ingress ============
export const ingressApi = {
  list: (namespace: string, params?: ListParams) =>
    get<ListResponse<Ingress>>(`/namespaces/${namespace}/ingresses`, buildParams(params)),
  listAll: (params?: ListParams) =>
    get<ListResponse<Ingress>>('/ingresses', buildParams(params)),
  get: (namespace: string, name: string) =>
    get<Ingress>(`/namespaces/${namespace}/ingresses/${name}`),
  create: (namespace: string, data: IngressInput) =>
    post<Ingress>(`/namespaces/${namespace}/ingresses`, data),
  update: (namespace: string, name: string, data: Ingress) =>
    put<Ingress>(`/namespaces/${namespace}/ingresses/${name}`, data),
  delete: (namespace: string, name: string) =>
    del<void>(`/namespaces/${namespace}/ingresses/${name}`),
  getYaml: (namespace: string, name: string) =>
    get<string>(`/namespaces/${namespace}/ingresses/${name}/yaml`),
  updateYaml: (namespace: string, name: string, yaml: string) =>
    putYaml<Ingress>(`/namespaces/${namespace}/ingresses/${name}/yaml`, yaml),
};

// ============ ConfigMap ============
export const configMapApi = {
  list: (namespace: string, params?: ListParams) =>
    get<ListResponse<ConfigMap>>(`/namespaces/${namespace}/configmaps`, buildParams(params)),
  listAll: (params?: ListParams) =>
    get<ListResponse<ConfigMap>>('/configmaps', buildParams(params)),
  get: (namespace: string, name: string) =>
    get<ConfigMap>(`/namespaces/${namespace}/configmaps/${name}`),
  create: (namespace: string, data: ConfigMapInput) =>
    post<ConfigMap>(`/namespaces/${namespace}/configmaps`, data),
  update: (namespace: string, name: string, data: ConfigMap) =>
    put<ConfigMap>(`/namespaces/${namespace}/configmaps/${name}`, data),
  delete: (namespace: string, name: string) =>
    del<void>(`/namespaces/${namespace}/configmaps/${name}`),
  getYaml: (namespace: string, name: string) =>
    get<string>(`/namespaces/${namespace}/configmaps/${name}/yaml`),
  updateYaml: (namespace: string, name: string, yaml: string) =>
    putYaml<ConfigMap>(`/namespaces/${namespace}/configmaps/${name}/yaml`, yaml),
};

// ============ Secret ============
export const secretApi = {
  list: (namespace: string, params?: ListParams) =>
    get<ListResponse<Secret>>(`/namespaces/${namespace}/secrets`, buildParams(params)),
  listAll: (params?: ListParams) =>
    get<ListResponse<Secret>>('/secrets', buildParams(params)),
  get: (namespace: string, name: string) =>
    get<Secret>(`/namespaces/${namespace}/secrets/${name}`),
  create: (namespace: string, data: SecretInput) =>
    post<Secret>(`/namespaces/${namespace}/secrets`, data),
  update: (namespace: string, name: string, data: Secret) =>
    put<Secret>(`/namespaces/${namespace}/secrets/${name}`, data),
  delete: (namespace: string, name: string) =>
    del<void>(`/namespaces/${namespace}/secrets/${name}`),
  getYaml: (namespace: string, name: string) =>
    get<string>(`/namespaces/${namespace}/secrets/${name}/yaml`),
  updateYaml: (namespace: string, name: string, yaml: string) =>
    putYaml<Secret>(`/namespaces/${namespace}/secrets/${name}/yaml`, yaml),
};

// ============ PersistentVolume ============
export const pvApi = {
  list: (params?: ListParams) =>
    get<ListResponse<PersistentVolume>>('/persistentvolumes', buildParams(params)),
  get: (name: string) =>
    get<PersistentVolume>(`/persistentvolumes/${name}`),
  create: (data: PersistentVolume) =>
    post<PersistentVolume>('/persistentvolumes', data),
  update: (name: string, data: PersistentVolume) =>
    put<PersistentVolume>(`/persistentvolumes/${name}`, data),
  delete: (name: string) =>
    del<void>(`/persistentvolumes/${name}`),
  getYaml: (name: string) =>
    get<string>(`/persistentvolumes/${name}/yaml`),
};

// ============ PersistentVolumeClaim ============
export const pvcApi = {
  list: (namespace: string, params?: ListParams) =>
    get<ListResponse<PersistentVolumeClaim>>(`/namespaces/${namespace}/persistentvolumeclaims`, buildParams(params)),
  listAll: (params?: ListParams) =>
    get<ListResponse<PersistentVolumeClaim>>('/persistentvolumeclaims', buildParams(params)),
  get: (namespace: string, name: string) =>
    get<PersistentVolumeClaim>(`/namespaces/${namespace}/persistentvolumeclaims/${name}`),
  create: (namespace: string, data: PersistentVolumeClaim) =>
    post<PersistentVolumeClaim>(`/namespaces/${namespace}/persistentvolumeclaims`, data),
  update: (namespace: string, name: string, data: PersistentVolumeClaim) =>
    put<PersistentVolumeClaim>(`/namespaces/${namespace}/persistentvolumeclaims/${name}`, data),
  delete: (namespace: string, name: string) =>
    del<void>(`/namespaces/${namespace}/persistentvolumeclaims/${name}`),
  getYaml: (namespace: string, name: string) =>
    get<string>(`/namespaces/${namespace}/persistentvolumeclaims/${name}/yaml`),
};

// ============ StorageClass ============
export const storageClassApi = {
  list: (params?: ListParams) =>
    get<ListResponse<StorageClass>>('/storageclasses', buildParams(params)),
  get: (name: string) =>
    get<StorageClass>(`/storageclasses/${name}`),
  create: (data: StorageClass) =>
    post<StorageClass>('/storageclasses', data),
  delete: (name: string) =>
    del<void>(`/storageclasses/${name}`),
  getYaml: (name: string) =>
    get<string>(`/storageclasses/${name}/yaml`),
};

// ============ Node ============
export const nodeApi = {
  list: (params?: ListParams) =>
    get<ListResponse<Node>>('/nodes', buildParams(params)),
  get: (name: string) =>
    get<Node>(`/nodes/${name}`),
  getMetrics: (name: string) =>
    get<NodeMetrics>(`/nodes/${name}/metrics`),
  getYaml: (name: string) =>
    get<string>(`/nodes/${name}/yaml`),
  cordon: (name: string) =>
    post<void>(`/nodes/${name}/cordon`),
  uncordon: (name: string) =>
    post<void>(`/nodes/${name}/uncordon`),
  drain: (name: string, options?: { force?: boolean; gracePeriod?: number }) =>
    post<void>(`/nodes/${name}/drain`, options),
  updateLabels: (name: string, labels: Record<string, string>) =>
    put<void>(`/nodes/${name}/labels`, { labels }),
  updateTaints: (name: string, taints: Array<{ key: string; value?: string; effect: string }>) =>
    put<void>(`/nodes/${name}/taints`, { taints }),
  getPods: (name: string) =>
    get<ListResponse<Pod>>(`/nodes/${name}/pods`),
  getEvents: (name: string) =>
    get<ListResponse<Event>>(`/nodes/${name}/events`),
};

// ============ ResourceQuota ============
export const resourceQuotaApi = {
  list: (namespace: string, params?: ListParams) =>
    get<ListResponse<ResourceQuota>>(`/namespaces/${namespace}/resourcequotas`, buildParams(params)),
  get: (namespace: string, name: string) =>
    get<ResourceQuota>(`/namespaces/${namespace}/resourcequotas/${name}`),
  create: (namespace: string, data: ResourceQuota) =>
    post<ResourceQuota>(`/namespaces/${namespace}/resourcequotas`, data),
  update: (namespace: string, name: string, data: ResourceQuota) =>
    put<ResourceQuota>(`/namespaces/${namespace}/resourcequotas/${name}`, data),
  delete: (namespace: string, name: string) =>
    del<void>(`/namespaces/${namespace}/resourcequotas/${name}`),
};

// ============ LimitRange ============
export const limitRangeApi = {
  list: (namespace: string, params?: ListParams) =>
    get<ListResponse<LimitRange>>(`/namespaces/${namespace}/limitranges`, buildParams(params)),
  get: (namespace: string, name: string) =>
    get<LimitRange>(`/namespaces/${namespace}/limitranges/${name}`),
  create: (namespace: string, data: LimitRange) =>
    post<LimitRange>(`/namespaces/${namespace}/limitranges`, data),
  update: (namespace: string, name: string, data: LimitRange) =>
    put<LimitRange>(`/namespaces/${namespace}/limitranges/${name}`, data),
  delete: (namespace: string, name: string) =>
    del<void>(`/namespaces/${namespace}/limitranges/${name}`),
};

// ============ Event ============
export const eventApi = {
  list: (namespace: string, params?: ListParams) =>
    get<ListResponse<Event>>(`/namespaces/${namespace}/events`, buildParams(params)),
  listAll: (params?: ListParams) =>
    get<ListResponse<Event>>('/events', buildParams(params)),
};

// ============ RBAC ============
export const roleApi = {
  list: (namespace: string, params?: ListParams) =>
    get<ListResponse<Role>>(`/namespaces/${namespace}/roles`, buildParams(params)),
  get: (namespace: string, name: string) =>
    get<Role>(`/namespaces/${namespace}/roles/${name}`),
  create: (namespace: string, data: Role) =>
    post<Role>(`/namespaces/${namespace}/roles`, data),
  update: (namespace: string, name: string, data: Role) =>
    put<Role>(`/namespaces/${namespace}/roles/${name}`, data),
  delete: (namespace: string, name: string) =>
    del<void>(`/namespaces/${namespace}/roles/${name}`),
};

export const clusterRoleApi = {
  list: (params?: ListParams) =>
    get<ListResponse<ClusterRole>>('/clusterroles', buildParams(params)),
  get: (name: string) =>
    get<ClusterRole>(`/clusterroles/${name}`),
  create: (data: ClusterRole) =>
    post<ClusterRole>('/clusterroles', data),
  update: (name: string, data: ClusterRole) =>
    put<ClusterRole>(`/clusterroles/${name}`, data),
  delete: (name: string) =>
    del<void>(`/clusterroles/${name}`),
};

export const roleBindingApi = {
  list: (namespace: string, params?: ListParams) =>
    get<ListResponse<RoleBinding>>(`/namespaces/${namespace}/rolebindings`, buildParams(params)),
  get: (namespace: string, name: string) =>
    get<RoleBinding>(`/namespaces/${namespace}/rolebindings/${name}`),
  create: (namespace: string, data: RoleBinding) =>
    post<RoleBinding>(`/namespaces/${namespace}/rolebindings`, data),
  update: (namespace: string, name: string, data: RoleBinding) =>
    put<RoleBinding>(`/namespaces/${namespace}/rolebindings/${name}`, data),
  delete: (namespace: string, name: string) =>
    del<void>(`/namespaces/${namespace}/rolebindings/${name}`),
};

export const clusterRoleBindingApi = {
  list: (params?: ListParams) =>
    get<ListResponse<ClusterRoleBinding>>('/clusterrolebindings', buildParams(params)),
  get: (name: string) =>
    get<ClusterRoleBinding>(`/clusterrolebindings/${name}`),
  create: (data: ClusterRoleBinding) =>
    post<ClusterRoleBinding>('/clusterrolebindings', data),
  update: (name: string, data: ClusterRoleBinding) =>
    put<ClusterRoleBinding>(`/clusterrolebindings/${name}`, data),
  delete: (name: string) =>
    del<void>(`/clusterrolebindings/${name}`),
};

export const serviceAccountApi = {
  list: (namespace: string, params?: ListParams) =>
    get<ListResponse<ServiceAccount>>(`/namespaces/${namespace}/serviceaccounts`, buildParams(params)),
  listAll: (params?: ListParams) =>
    get<ListResponse<ServiceAccount>>('/serviceaccounts', buildParams(params)),
  get: (namespace: string, name: string) =>
    get<ServiceAccount>(`/namespaces/${namespace}/serviceaccounts/${name}`),
  create: (namespace: string, data: ServiceAccount) =>
    post<ServiceAccount>(`/namespaces/${namespace}/serviceaccounts`, data),
  delete: (namespace: string, name: string) =>
    del<void>(`/namespaces/${namespace}/serviceaccounts/${name}`),
};

// ============ 审计日志 ============
export const auditApi = {
  list: (params?: {
    page?: number;
    pageSize?: number;
    startTime?: string;
    endTime?: string;
    user?: string;
    action?: string;
    resource?: string;
    namespace?: string;
    cluster?: string;
  }) =>
    get<{ items: AuditLog[]; total: number; page: number; pages: number }>('/audit', params as Record<string, unknown>),
  getStats: (duration?: string) =>
    get<{ total: number; byAction: Record<string, number>; byResource: Record<string, number>; byUser: Record<string, number> }>('/audit/stats', duration ? { duration } : {}),
};

// ============ 告警 ============
export const alertApi = {
  list: (params?: { severity?: string; namespace?: string; alertname?: string; state?: string }) =>
    get<ListResponse<Alert>>('/alerts', params as Record<string, unknown>),
  get: (fingerprint: string) =>
    get<Alert>(`/alerts/${fingerprint}`),
  getSummary: () =>
    get<AlertSummary>('/alerts/summary'),
  getNames: () =>
    get<{ items: string[] }>('/alerts/names'),
  acknowledge: (fingerprint: string, data: { comment: string; expiresAt?: string }) =>
    post<void>(`/alerts/${fingerprint}/acknowledge`, data),
  unacknowledge: (fingerprint: string) =>
    del<void>(`/alerts/${fingerprint}/acknowledge`),
  getAcknowledgement: (fingerprint: string) =>
    get<AlertAcknowledgement>(`/alerts/${fingerprint}/acknowledgement`),
};

// ============ 静默规则 ============
export const silenceApi = {
  list: (params?: { state?: string }) =>
    get<ListResponse<Silence>>('/silences', params as Record<string, unknown>),
  get: (id: number) =>
    get<Silence>(`/silences/${id}`),
  create: (data: {
    matchers: Array<{ name: string; value: string; isRegex: boolean; isEqual: boolean }>;
    startsAt: string;
    endsAt: string;
    comment: string;
  }) =>
    post<Silence>('/silences', data),
  delete: (id: number) =>
    del<void>(`/silences/${id}`),
};

// ============ 多集群 ============
export const clusterApi = {
  list: () => get<ClusterInfo[]>('/clusters'),
  get: (name: string) => get<ClusterInfo>(`/clusters/${name}`),
  add: (data: { name: string; kubeconfig: string }) =>
    post<ClusterInfo>('/clusters', data),
  delete: (name: string) =>
    del<void>(`/clusters/${name}`),
  switch: (name: string) =>
    post<void>(`/clusters/${name}/switch`),
  test: (kubeconfig: string) =>
    post<{ success: boolean; message: string }>('/clusters/test', { kubeconfig }),
};
