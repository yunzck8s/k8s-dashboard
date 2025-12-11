// API 响应和请求类型

// 通用列表响应
export interface ListResponse<T> {
  items: T[];
  total: number;
  page?: number;
  pageSize?: number;
}

// 集群概览数据
export interface ClusterOverview {
  nodes: ResourceCount;
  pods: ResourceCount;
  deployments: ResourceCount;
  services: ResourceCount;
  namespaces: number;
  events: EventSummary;
  resources: ResourceUsage;
}

export interface ResourceCount {
  total: number;
  ready: number;
  notReady: number;
}

export interface EventSummary {
  total: number;
  warning: number;
  normal: number;
}

export interface ResourceUsage {
  cpu: UsageMetric;
  memory: UsageMetric;      // 容器内存（K8s 视角）
  nodeMemory: UsageMetric;  // 节点内存（OS 视角）
  pods: UsageMetric;
}

export interface UsageMetric {
  used: number;
  total: number;
  unit: string;
}

// 节点指标
export interface NodeMetrics {
  name: string;
  cpu: MetricValue;
  memory: MetricValue;
  pods: MetricValue;
  conditions: NodeConditionSummary;
}

export interface MetricValue {
  usage: number;
  capacity: number;
  percentage: number;
}

export interface NodeConditionSummary {
  ready: boolean;
  memoryPressure: boolean;
  diskPressure: boolean;
  pidPressure: boolean;
  networkUnavailable: boolean;
}

// Pod 指标
export interface PodMetrics {
  name: string;
  namespace: string;
  cpuUsage: number;    // CPU 使用量 (cores)
  memoryUsage: number; // 内存使用量 (bytes)
  containers?: ContainerMetrics[];
}

export interface ContainerMetrics {
  name: string;
  cpu: string;
  memory: string;
}

// 日志选项
export interface LogOptions {
  container?: string;
  follow?: boolean;
  previous?: boolean;
  sinceSeconds?: number;
  sinceTime?: string;
  timestamps?: boolean;
  tailLines?: number;
  limitBytes?: number;
}

// 执行命令选项
export interface ExecOptions {
  container?: string;
  command?: string[];
  stdin?: boolean;
  stdout?: boolean;
  stderr?: boolean;
  tty?: boolean;
}

// 扩缩容请求
export interface ScaleRequest {
  replicas: number;
}

// 回滚请求
export interface RollbackRequest {
  revision?: number;
}

// 重启请求
export interface RestartRequest {
  // 空对象，仅用于触发重启
}

// YAML 更新请求
export interface UpdateYamlRequest {
  yaml: string;
}

// 审计日志
export interface AuditLog {
  id: number;
  timestamp: string;
  user: string;
  action: string;       // GET, POST, PUT, DELETE
  resource: string;     // pods, deployments, nodes, etc.
  resourceName: string;
  namespace: string;
  cluster: string;
  statusCode: number;
  clientIP: string;
  userAgent: string;
  requestBody: string;
  duration: number;     // 毫秒
  message: string;
}

// 审计日志查询参数
export interface AuditLogParams {
  page?: number;
  pageSize?: number;
  startTime?: string;
  endTime?: string;
  user?: string;
  action?: string;
  resource?: string;
  namespace?: string;
  cluster?: string;
}

// 审计日志列表响应
export interface AuditLogListResponse {
  items: AuditLog[];
  total: number;
  page: number;
  pages: number;
}

// 审计统计
export interface AuditStats {
  total: number;
  byAction: Record<string, number>;
  byResource: Record<string, number>;
  byUser: Record<string, number>;
}

// 告警（来自 Alertmanager）
export interface Alert {
  labels: Record<string, string>;
  annotations: Record<string, string>;
  startsAt: string;
  endsAt: string;
  generatorURL: string;
  fingerprint: string;
  status: AlertStatus;
  receivers: AlertReceiver[];
  updatedAt: string;
}

export interface AlertStatus {
  state: 'active' | 'suppressed' | 'unprocessed';
  silencedBy: string[];
  inhibitedBy: string[];
  mutedBy: string[];
}

export interface AlertReceiver {
  name: string;
}

// 告警摘要
export interface AlertSummary {
  total: number;
  critical: number;
  warning: number;
  info: number;
}

// 集群信息
export interface ClusterInfo {
  name: string;
  endpoint: string;
  version: string;
  status: 'connected' | 'disconnected' | 'error';
  lastChecked: string;
  nodeCount: number;
  podCount: number;
}

// 错误响应
export interface ApiError {
  code: number;
  message: string;
  details?: string;
}

// WebSocket 消息类型
export interface WsMessage<T = unknown> {
  type: 'log' | 'event' | 'metrics' | 'error' | 'connected' | 'disconnected';
  data: T;
  timestamp: string;
}

export interface LogMessage {
  content: string;
  container?: string;
  timestamp?: string;
}

export interface WatchEvent<T> {
  type: 'ADDED' | 'MODIFIED' | 'DELETED' | 'ERROR';
  object: T;
}

// 搜索/过滤参数
export interface ListParams {
  namespace?: string;
  labelSelector?: string;
  fieldSelector?: string;
  limit?: number;
  continue?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
}

// 统计数据类型
export interface TimeSeriesData {
  timestamp: string;
  value: number;
}

export interface ResourceHistory {
  cpu: TimeSeriesData[];
  memory: TimeSeriesData[];
}
