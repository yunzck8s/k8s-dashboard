// Kubernetes 资源基础类型

// 通用元数据
export interface ObjectMeta {
  name: string;
  namespace?: string;
  uid: string;
  resourceVersion: string;
  creationTimestamp: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  ownerReferences?: OwnerReference[];
}

export interface OwnerReference {
  apiVersion: string;
  kind: string;
  name: string;
  uid: string;
  controller?: boolean;
}

// Pod 相关类型
export interface Pod {
  metadata: ObjectMeta;
  spec: PodSpec;
  status: PodStatus;
}

export interface PodSpec {
  containers: Container[];
  initContainers?: Container[];
  nodeName?: string;
  serviceAccountName?: string;
  restartPolicy?: string;
  volumes?: Volume[];
  nodeSelector?: Record<string, string>;
  tolerations?: Toleration[];
}

export interface Toleration {
  key?: string;
  operator?: string;
  value?: string;
  effect?: string;
  tolerationSeconds?: number;
}

export interface Container {
  name: string;
  image: string;
  ports?: ContainerPort[];
  env?: EnvVar[];
  resources?: ResourceRequirements;
  volumeMounts?: VolumeMount[];
  command?: string[];
  args?: string[];
  imagePullPolicy?: string;
}

export interface ContainerPort {
  name?: string;
  containerPort: number;
  protocol?: string;
}

export interface EnvVar {
  name: string;
  value?: string;
  valueFrom?: EnvVarSource;
}

export interface EnvVarSource {
  configMapKeyRef?: ConfigMapKeySelector;
  secretKeyRef?: SecretKeySelector;
  fieldRef?: ObjectFieldSelector;
}

export interface ConfigMapKeySelector {
  name: string;
  key: string;
}

export interface SecretKeySelector {
  name: string;
  key: string;
}

export interface ObjectFieldSelector {
  fieldPath: string;
}

export interface ResourceRequirements {
  limits?: Record<string, string>;
  requests?: Record<string, string>;
}

export interface VolumeMount {
  name: string;
  mountPath: string;
  readOnly?: boolean;
  subPath?: string;
}

export interface Volume {
  name: string;
  configMap?: ConfigMapVolumeSource;
  secret?: SecretVolumeSource;
  persistentVolumeClaim?: PersistentVolumeClaimVolumeSource;
  emptyDir?: EmptyDirVolumeSource;
  hostPath?: HostPathVolumeSource;
}

export interface ConfigMapVolumeSource {
  name: string;
  items?: KeyToPath[];
}

export interface SecretVolumeSource {
  secretName: string;
  items?: KeyToPath[];
}

export interface KeyToPath {
  key: string;
  path: string;
}

export interface PersistentVolumeClaimVolumeSource {
  claimName: string;
}

export interface EmptyDirVolumeSource {
  medium?: string;
  sizeLimit?: string;
}

export interface HostPathVolumeSource {
  path: string;
  type?: string;
}

export interface PodStatus {
  phase: PodPhase;
  conditions?: PodCondition[];
  hostIP?: string;
  podIP?: string;
  startTime?: string;
  containerStatuses?: ContainerStatus[];
  initContainerStatuses?: ContainerStatus[];
  qosClass?: string;
}

export type PodPhase = 'Pending' | 'Running' | 'Succeeded' | 'Failed' | 'Unknown';

export interface PodCondition {
  type: string;
  status: string;
  lastTransitionTime?: string;
  reason?: string;
  message?: string;
}

export interface ContainerStatus {
  name: string;
  ready: boolean;
  restartCount: number;
  state: ContainerState;
  lastState?: ContainerState;
  image: string;
  imageID: string;
  containerID?: string;
}

export interface ContainerState {
  waiting?: ContainerStateWaiting;
  running?: ContainerStateRunning;
  terminated?: ContainerStateTerminated;
}

export interface ContainerStateWaiting {
  reason?: string;
  message?: string;
}

export interface ContainerStateRunning {
  startedAt?: string;
}

export interface ContainerStateTerminated {
  exitCode: number;
  signal?: number;
  reason?: string;
  message?: string;
  startedAt?: string;
  finishedAt?: string;
}

// Deployment 相关类型
export interface Deployment {
  metadata: ObjectMeta;
  spec: DeploymentSpec;
  status: DeploymentStatus;
}

export interface DeploymentSpec {
  replicas: number;
  selector: LabelSelector;
  template: PodTemplateSpec;
  strategy?: DeploymentStrategy;
  minReadySeconds?: number;
  revisionHistoryLimit?: number;
  paused?: boolean;
}

export interface LabelSelector {
  matchLabels?: Record<string, string>;
  matchExpressions?: LabelSelectorRequirement[];
}

export interface LabelSelectorRequirement {
  key: string;
  operator: string;
  values?: string[];
}

export interface PodTemplateSpec {
  metadata?: ObjectMeta;
  spec: PodSpec;
}

export interface DeploymentStrategy {
  type: 'RollingUpdate' | 'Recreate';
  rollingUpdate?: RollingUpdateDeployment;
}

export interface RollingUpdateDeployment {
  maxUnavailable?: string | number;
  maxSurge?: string | number;
}

export interface DeploymentStatus {
  observedGeneration?: number;
  replicas: number;
  updatedReplicas?: number;
  readyReplicas?: number;
  availableReplicas?: number;
  unavailableReplicas?: number;
  conditions?: DeploymentCondition[];
}

export interface DeploymentCondition {
  type: string;
  status: string;
  lastUpdateTime?: string;
  lastTransitionTime?: string;
  reason?: string;
  message?: string;
}

// StatefulSet 相关类型
export interface StatefulSet {
  metadata: ObjectMeta;
  spec: StatefulSetSpec;
  status: StatefulSetStatus;
}

export interface StatefulSetSpec {
  replicas: number;
  selector: LabelSelector;
  template: PodTemplateSpec;
  serviceName: string;
  podManagementPolicy?: string;
  updateStrategy?: StatefulSetUpdateStrategy;
  volumeClaimTemplates?: PersistentVolumeClaim[];
}

export interface StatefulSetUpdateStrategy {
  type: 'RollingUpdate' | 'OnDelete';
  rollingUpdate?: RollingUpdateStatefulSetStrategy;
}

export interface RollingUpdateStatefulSetStrategy {
  partition?: number;
}

export interface StatefulSetStatus {
  observedGeneration?: number;
  replicas: number;
  readyReplicas?: number;
  currentReplicas?: number;
  updatedReplicas?: number;
  availableReplicas?: number;
  currentRevision?: string;
  updateRevision?: string;
  conditions?: StatefulSetCondition[];
}

export interface StatefulSetCondition {
  type: string;
  status: string;
  lastTransitionTime?: string;
  reason?: string;
  message?: string;
}

// DaemonSet 相关类型
export interface DaemonSet {
  metadata: ObjectMeta;
  spec: DaemonSetSpec;
  status: DaemonSetStatus;
}

export interface DaemonSetSpec {
  selector: LabelSelector;
  template: PodTemplateSpec;
  updateStrategy?: DaemonSetUpdateStrategy;
  minReadySeconds?: number;
}

export interface DaemonSetUpdateStrategy {
  type: 'RollingUpdate' | 'OnDelete';
  rollingUpdate?: RollingUpdateDaemonSet;
}

export interface RollingUpdateDaemonSet {
  maxUnavailable?: string | number;
  maxSurge?: string | number;
}

export interface DaemonSetStatus {
  currentNumberScheduled: number;
  numberMisscheduled: number;
  desiredNumberScheduled: number;
  numberReady: number;
  observedGeneration?: number;
  updatedNumberScheduled?: number;
  numberAvailable?: number;
  numberUnavailable?: number;
  conditions?: DaemonSetCondition[];
}

export interface DaemonSetCondition {
  type: string;
  status: string;
  lastTransitionTime?: string;
  reason?: string;
  message?: string;
}

// Job 相关类型
export interface Job {
  metadata: ObjectMeta;
  spec: JobSpec;
  status: JobStatus;
}

export interface JobSpec {
  parallelism?: number;
  completions?: number;
  backoffLimit?: number;
  activeDeadlineSeconds?: number;
  ttlSecondsAfterFinished?: number;
  template: PodTemplateSpec;
}

export interface JobStatus {
  conditions?: JobCondition[];
  startTime?: string;
  completionTime?: string;
  active?: number;
  succeeded?: number;
  failed?: number;
}

export interface JobCondition {
  type: string;
  status: string;
  lastProbeTime?: string;
  lastTransitionTime?: string;
  reason?: string;
  message?: string;
}

// CronJob 相关类型
export interface CronJob {
  metadata: ObjectMeta;
  spec: CronJobSpec;
  status: CronJobStatus;
}

export interface CronJobSpec {
  schedule: string;
  timeZone?: string;
  startingDeadlineSeconds?: number;
  concurrencyPolicy?: string;
  suspend?: boolean;
  jobTemplate: JobTemplateSpec;
  successfulJobsHistoryLimit?: number;
  failedJobsHistoryLimit?: number;
}

export interface JobTemplateSpec {
  metadata?: ObjectMeta;
  spec: JobSpec;
}

export interface CronJobStatus {
  active?: ObjectReference[];
  lastScheduleTime?: string;
  lastSuccessfulTime?: string;
}

export interface ObjectReference {
  kind?: string;
  namespace?: string;
  name?: string;
  uid?: string;
  apiVersion?: string;
  resourceVersion?: string;
}

// ReplicaSet 相关类型
export interface ReplicaSet {
  metadata: ObjectMeta;
  spec: ReplicaSetSpec;
  status: ReplicaSetStatus;
}

export interface ReplicaSetSpec {
  replicas: number;
  selector: LabelSelector;
  template: PodTemplateSpec;
  minReadySeconds?: number;
}

export interface ReplicaSetStatus {
  replicas: number;
  fullyLabeledReplicas?: number;
  readyReplicas?: number;
  availableReplicas?: number;
  observedGeneration?: number;
}

// Service 相关类型
export interface Service {
  metadata: ObjectMeta;
  spec: ServiceSpec;
  status?: ServiceStatus;
}

export interface ServiceSpec {
  type?: ServiceType;
  selector?: Record<string, string>;
  ports?: ServicePort[];
  clusterIP?: string;
  externalIPs?: string[];
  loadBalancerIP?: string;
  externalTrafficPolicy?: string;
  sessionAffinity?: string;
}

export type ServiceType = 'ClusterIP' | 'NodePort' | 'LoadBalancer' | 'ExternalName';

export interface ServicePort {
  name?: string;
  protocol?: string;
  port: number;
  targetPort?: number | string;
  nodePort?: number;
}

export interface ServiceStatus {
  loadBalancer?: LoadBalancerStatus;
}

export interface LoadBalancerStatus {
  ingress?: LoadBalancerIngress[];
}

export interface LoadBalancerIngress {
  ip?: string;
  hostname?: string;
}

// Ingress 相关类型
export interface Ingress {
  metadata: ObjectMeta;
  spec: IngressSpec;
  status?: IngressStatus;
}

export interface IngressSpec {
  ingressClassName?: string;
  defaultBackend?: IngressBackend;
  tls?: IngressTLS[];
  rules?: IngressRule[];
}

export interface IngressBackend {
  service?: IngressServiceBackend;
  resource?: TypedLocalObjectReference;
}

export interface IngressServiceBackend {
  name: string;
  port: ServiceBackendPort;
}

export interface ServiceBackendPort {
  name?: string;
  number?: number;
}

export interface TypedLocalObjectReference {
  apiGroup?: string;
  kind: string;
  name: string;
}

export interface IngressTLS {
  hosts?: string[];
  secretName?: string;
}

export interface IngressRule {
  host?: string;
  http?: HTTPIngressRuleValue;
}

export interface HTTPIngressRuleValue {
  paths: HTTPIngressPath[];
}

export interface HTTPIngressPath {
  path?: string;
  pathType: string;
  backend: IngressBackend;
}

export interface IngressStatus {
  loadBalancer?: LoadBalancerStatus;
}

// ConfigMap 相关类型
export interface ConfigMap {
  apiVersion?: string;
  kind?: string;
  metadata: ObjectMeta;
  data?: Record<string, string>;
  binaryData?: Record<string, string>;
  immutable?: boolean;
}

// Secret 相关类型
export interface Secret {
  apiVersion?: string;
  kind?: string;
  metadata: ObjectMeta;
  type?: string;
  data?: Record<string, string>;
  stringData?: Record<string, string>;
  immutable?: boolean;
}

// PersistentVolume 相关类型
export interface PersistentVolume {
  metadata: ObjectMeta;
  spec: PersistentVolumeSpec;
  status?: PersistentVolumeStatus;
}

export interface PersistentVolumeSpec {
  capacity?: Record<string, string>;
  accessModes?: string[];
  persistentVolumeReclaimPolicy?: string;
  storageClassName?: string;
  volumeMode?: string;
  claimRef?: ObjectReference;
  hostPath?: HostPathVolumeSource;
  nfs?: NFSVolumeSource;
  csi?: CSIPersistentVolumeSource;
}

export interface NFSVolumeSource {
  server: string;
  path: string;
  readOnly?: boolean;
}

export interface CSIPersistentVolumeSource {
  driver: string;
  volumeHandle: string;
  readOnly?: boolean;
  fsType?: string;
  volumeAttributes?: Record<string, string>;
}

export interface PersistentVolumeStatus {
  phase?: string;
  message?: string;
  reason?: string;
}

// PersistentVolumeClaim 相关类型
export interface PersistentVolumeClaim {
  metadata: ObjectMeta;
  spec: PersistentVolumeClaimSpec;
  status?: PersistentVolumeClaimStatus;
}

export interface PersistentVolumeClaimSpec {
  accessModes?: string[];
  resources?: ResourceRequirements;
  storageClassName?: string;
  volumeMode?: string;
  volumeName?: string;
  selector?: LabelSelector;
}

export interface PersistentVolumeClaimStatus {
  phase?: string;
  accessModes?: string[];
  capacity?: Record<string, string>;
}

// StorageClass 相关类型
export interface StorageClass {
  metadata: ObjectMeta;
  provisioner: string;
  parameters?: Record<string, string>;
  reclaimPolicy?: string;
  volumeBindingMode?: string;
  allowVolumeExpansion?: boolean;
}

// Node 相关类型
export interface Node {
  metadata: ObjectMeta;
  spec: NodeSpec;
  status: NodeStatus;
}

export interface NodeSpec {
  podCIDR?: string;
  podCIDRs?: string[];
  providerID?: string;
  unschedulable?: boolean;
  taints?: Taint[];
}

export interface Taint {
  key: string;
  value?: string;
  effect: TaintEffect;
  timeAdded?: string;
}

export type TaintEffect = 'NoSchedule' | 'PreferNoSchedule' | 'NoExecute';

export interface NodeStatus {
  capacity?: Record<string, string>;
  allocatable?: Record<string, string>;
  conditions?: NodeCondition[];
  addresses?: NodeAddress[];
  nodeInfo?: NodeSystemInfo;
  images?: ContainerImage[];
}

export interface NodeCondition {
  type: string;
  status: string;
  lastHeartbeatTime?: string;
  lastTransitionTime?: string;
  reason?: string;
  message?: string;
}

export interface NodeAddress {
  type: string;
  address: string;
}

export interface NodeSystemInfo {
  machineID: string;
  systemUUID: string;
  bootID: string;
  kernelVersion: string;
  osImage: string;
  containerRuntimeVersion: string;
  kubeletVersion: string;
  kubeProxyVersion: string;
  operatingSystem: string;
  architecture: string;
}

export interface ContainerImage {
  names?: string[];
  sizeBytes?: number;
}

// Namespace 相关类型
export interface Namespace {
  metadata: ObjectMeta;
  spec?: NamespaceSpec;
  status?: NamespaceStatus;
}

export interface NamespaceSpec {
  finalizers?: string[];
}

export interface NamespaceStatus {
  phase?: string;
  conditions?: NamespaceCondition[];
}

export interface NamespaceCondition {
  type: string;
  status: string;
  lastTransitionTime?: string;
  reason?: string;
  message?: string;
}

// ResourceQuota 相关类型
export interface ResourceQuota {
  metadata: ObjectMeta;
  spec?: ResourceQuotaSpec;
  status?: ResourceQuotaStatus;
}

export interface ResourceQuotaSpec {
  hard?: Record<string, string>;
  scopes?: string[];
  scopeSelector?: ScopeSelector;
}

export interface ScopeSelector {
  matchExpressions?: ScopedResourceSelectorRequirement[];
}

export interface ScopedResourceSelectorRequirement {
  scopeName: string;
  operator: string;
  values?: string[];
}

export interface ResourceQuotaStatus {
  hard?: Record<string, string>;
  used?: Record<string, string>;
}

// LimitRange 相关类型
export interface LimitRange {
  metadata: ObjectMeta;
  spec?: LimitRangeSpec;
}

export interface LimitRangeSpec {
  limits?: LimitRangeItem[];
}

export interface LimitRangeItem {
  type: string;
  max?: Record<string, string>;
  min?: Record<string, string>;
  default?: Record<string, string>;
  defaultRequest?: Record<string, string>;
  maxLimitRequestRatio?: Record<string, string>;
}

// Event 相关类型
export interface Event {
  metadata: ObjectMeta;
  involvedObject: ObjectReference;
  reason?: string;
  message?: string;
  source?: EventSource;
  firstTimestamp?: string;
  lastTimestamp?: string;
  count?: number;
  type?: string;
  eventTime?: string;
  action?: string;
  reportingComponent?: string;
  reportingInstance?: string;
}

export interface EventSource {
  component?: string;
  host?: string;
}

// RBAC 相关类型
export interface Role {
  metadata: ObjectMeta;
  rules?: PolicyRule[];
}

export interface ClusterRole {
  metadata: ObjectMeta;
  rules?: PolicyRule[];
  aggregationRule?: AggregationRule;
}

export interface PolicyRule {
  verbs: string[];
  apiGroups?: string[];
  resources?: string[];
  resourceNames?: string[];
  nonResourceURLs?: string[];
}

export interface AggregationRule {
  clusterRoleSelectors?: LabelSelector[];
}

export interface RoleBinding {
  metadata: ObjectMeta;
  subjects?: Subject[];
  roleRef: RoleRef;
}

export interface ClusterRoleBinding {
  metadata: ObjectMeta;
  subjects?: Subject[];
  roleRef: RoleRef;
}

export interface Subject {
  kind: string;
  apiGroup?: string;
  name: string;
  namespace?: string;
}

export interface RoleRef {
  apiGroup: string;
  kind: string;
  name: string;
}

export interface ServiceAccount {
  metadata: ObjectMeta;
  secrets?: ObjectReference[];
  imagePullSecrets?: LocalObjectReference[];
  automountServiceAccountToken?: boolean;
}

export interface LocalObjectReference {
  name: string;
}
