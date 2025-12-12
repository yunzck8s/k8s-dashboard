import { get } from './client';

// 类型定义

// 异常状态汇总
export interface ObservationSummary {
  podAnomalyCount: number;
  nodeAnomalyCount: number;
  resourceExcessCount: number;
  activeAlertCount: number;
}

// Pod 异常
export interface PodAnomaly {
  name: string;
  namespace: string;
  reason: string;
  message: string;
  restartCount: number;
  duration: string;
  nodeName?: string;
}

// 节点异常
export interface NodeAnomaly {
  name: string;
  reason: string;
  message: string;
  duration: string;
  affectedPods: number;
}

// 资源超限
export interface ResourceExcess {
  type: 'cpu' | 'memory' | 'disk';
  resourceName: string;
  namespace?: string;
  usagePercent: number;
  threshold: number;
}

// 时序数据点
export interface TimeSeriesPoint {
  timestamp: number;
  value: number;
}

// 同比环比结果
export interface ComparisonResult {
  wow: number;    // 周环比
  mom: number;    // 月同比
  trend: 'up' | 'down' | 'stable';
  currentAvg: number;
}

// 资源趋势
export interface ResourceTrend {
  current: TimeSeriesPoint[];
  previous?: TimeSeriesPoint[];
  comparison: ComparisonResult;
}

// 告警趋势数据点
export interface AlertTrendPoint {
  date: string;
  count: number;
}

// 告警趋势
export interface AlertTrend {
  current: AlertTrendPoint[];
  previous?: AlertTrendPoint[];
  comparison: ComparisonResult;
}

// Pod 重启趋势数据点
export interface RestartTrendPoint {
  date: string;
  count: number;
  podName?: string;
}

// Pod 重启趋势
export interface RestartTrend {
  current: RestartTrendPoint[];
  previous?: RestartTrendPoint[];
  comparison: ComparisonResult;
}

// 列表响应
export interface ListResponse<T> {
  items: T[];
  total: number;
}

// 时间范围类型
export type TimeRange = 'realtime' | '1h' | '24h' | '7d' | '30d';

// 资源类型
export type ResourceType = 'cpu' | 'memory';

// API 模块
export const observationApi = {
  // 获取异常状态汇总
  getSummary: () =>
    get<ObservationSummary>('/observation/summary'),

  // 获取异常 Pod 列表
  getPodAnomalies: (params?: { namespace?: string }) =>
    get<ListResponse<PodAnomaly>>('/observation/pods/anomaly', params),

  // 获取异常节点列表
  getNodeAnomalies: () =>
    get<ListResponse<NodeAnomaly>>('/observation/nodes/anomaly'),

  // 获取资源超限列表
  getResourceExcess: (params?: { namespace?: string }) =>
    get<ListResponse<ResourceExcess>>('/observation/resources/excess', params),

  // 获取资源使用趋势
  getResourceTrend: (type: ResourceType, range: TimeRange) =>
    get<ResourceTrend>('/observation/trends/resource', { type, range }),

  // 获取告警趋势
  getAlertTrend: (range?: TimeRange) =>
    get<AlertTrend>('/observation/trends/alerts', range ? { range } : undefined),

  // 获取 Pod 重启趋势
  getRestartTrend: (range?: TimeRange) =>
    get<RestartTrend>('/observation/trends/restarts', range ? { range } : undefined),
};

export default observationApi;
