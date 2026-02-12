import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { auditApi } from '../../api';
import { usePollingInterval } from '../../utils/polling';
import { format, formatDistanceToNow, subDays, subHours } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import clsx from 'clsx';
import {
  FunnelIcon,
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  UserIcon,
  DocumentTextIcon,
  ServerIcon,
  EyeIcon,
  PlusCircleIcon,
  PencilSquareIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';

// 操作类型映射
const actionLabels: Record<string, string> = {
  GET: '查看',
  POST: '创建',
  PUT: '更新',
  PATCH: '修改',
  DELETE: '删除',
};

// 操作类型颜色
const actionColors: Record<string, string> = {
  GET: 'badge-info',
  POST: 'badge-success',
  PUT: 'badge-warning',
  PATCH: 'badge-warning',
  DELETE: 'badge-error',
};

// 资源类型映射
const resourceLabels: Record<string, string> = {
  pods: 'Pods',
  deployments: 'Deployments',
  statefulsets: 'StatefulSets',
  daemonsets: 'DaemonSets',
  services: 'Services',
  configmaps: 'ConfigMaps',
  secrets: 'Secrets',
  nodes: 'Nodes',
  namespaces: 'Namespaces',
  ingresses: 'Ingresses',
  jobs: 'Jobs',
  cronjobs: 'CronJobs',
  persistentvolumeclaims: 'PVC',
  persistentvolumes: 'PV',
};

// 时间范围选项
const timeRanges = [
  { label: '最近1小时', value: '1h' },
  { label: '最近24小时', value: '24h' },
  { label: '最近7天', value: '7d' },
  { label: '最近30天', value: '30d' },
  { label: '全部', value: 'all' },
];

export default function AuditLogs() {
  const pollingInterval = usePollingInterval('standard');
  const slowPollingInterval = usePollingInterval('slow');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [timeRange, setTimeRange] = useState('24h');
  const [actionFilter, setActionFilter] = useState('');
  const [resourceFilter, setResourceFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  // 计算时间范围
  const getTimeRange = () => {
    const now = new Date();
    switch (timeRange) {
      case '1h':
        return { startTime: subHours(now, 1).toISOString() };
      case '24h':
        return { startTime: subHours(now, 24).toISOString() };
      case '7d':
        return { startTime: subDays(now, 7).toISOString() };
      case '30d':
        return { startTime: subDays(now, 30).toISOString() };
      default:
        return {};
    }
  };

  // 获取审计日志列表
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['audit-logs', page, pageSize, timeRange, actionFilter, resourceFilter],
    queryFn: () =>
      auditApi.list({
        page,
        pageSize,
        ...getTimeRange(),
        ...(actionFilter && { action: actionFilter }),
        ...(resourceFilter && { resource: resourceFilter }),
      }),
    refetchInterval: pollingInterval,
  });

  // 获取统计数据
  const { data: stats } = useQuery({
    queryKey: ['audit-stats', timeRange],
    queryFn: () => auditApi.getStats(timeRange === 'all' ? '720h' : timeRange),
    refetchInterval: slowPollingInterval,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-6 text-center">
        <p className="text-red-400">加载失败：{(error as Error).message}</p>
        <button onClick={() => refetch()} className="btn btn-primary mt-4">
          重试
        </button>
      </div>
    );
  }

  const logs = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.pages ?? 1;

  // 格式化时间
  const formatTime = (timestamp: string) => {
    return format(new Date(timestamp), 'yyyy-MM-dd HH:mm:ss', { locale: zhCN });
  };

  // 格式化相对时间
  const formatRelativeTime = (timestamp: string) => {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true, locale: zhCN });
  };

  // 获取状态码颜色
  const getStatusColor = (code: number) => {
    if (code >= 200 && code < 300) return 'text-green-400';
    if (code >= 400 && code < 500) return 'text-yellow-400';
    if (code >= 500) return 'text-red-400';
    return 'text-slate-400';
  };

  // 获取状态图标
  const getStatusIcon = (code: number) => {
    if (code >= 200 && code < 300) {
      return <CheckCircleIcon className="w-4 h-4 text-green-400" />;
    }
    return <XCircleIcon className="w-4 h-4 text-red-400" />;
  };

  // 获取操作图标
  const getActionIcon = (action: string) => {
    switch (action) {
      case 'GET':
        return <EyeIcon className="w-4 h-4" />;
      case 'POST':
        return <PlusCircleIcon className="w-4 h-4" />;
      case 'PUT':
      case 'PATCH':
        return <PencilSquareIcon className="w-4 h-4" />;
      case 'DELETE':
        return <TrashIcon className="w-4 h-4" />;
      default:
        return <DocumentTextIcon className="w-4 h-4" />;
    }
  };

  // 生成操作描述
  const getActionDescription = (log: any) => {
    // 优先使用后端生成的 message，它包含了更精确的操作描述（如"重启"、"扩缩容"等）
    if (log.message) {
      const user = log.user || '未知用户';
      return `${user} ${log.message}`;
    }

    // 兜底逻辑：使用前端映射
    const user = log.user || '未知用户';
    const action = actionLabels[log.action] || log.action;
    const resource = resourceLabels[log.resource] || log.resource;
    const name = log.resourceName || '未命名资源';
    const namespace = log.namespace ? ` (${log.namespace})` : '';

    return `${user} ${action}了 ${resource} "${name}"${namespace}`;
  };

  // 切换行展开状态
  const toggleRowExpand = (id: number) => {
    const newSet = new Set(expandedRows);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedRows(newSet);
  };

  // 格式化 JSON
  const formatJSON = (str: string) => {
    try {
      const obj = JSON.parse(str);
      return JSON.stringify(obj, null, 2);
    } catch {
      return str;
    }
  };

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">审计日志</h1>
          <p className="text-slate-400 mt-1">
            记录所有 API 操作，共 {total} 条记录
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={clsx(
              'btn btn-secondary flex items-center gap-2',
              showFilters && 'bg-slate-600'
            )}
          >
            <FunnelIcon className="w-4 h-4" />
            筛选
          </button>
          <button onClick={() => refetch()} className="btn btn-secondary">
            <ArrowPathIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 统计卡片 */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <DocumentTextIcon className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.total}</p>
                <p className="text-sm text-slate-400">总操作数</p>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <CheckCircleIcon className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-400">
                  {stats.byAction?.POST || 0}
                </p>
                <p className="text-sm text-slate-400">创建操作</p>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/10">
                <ArrowPathIcon className="w-6 h-6 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-400">
                  {(stats.byAction?.PUT || 0) + (stats.byAction?.PATCH || 0)}
                </p>
                <p className="text-sm text-slate-400">更新操作</p>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <XCircleIcon className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-400">
                  {stats.byAction?.DELETE || 0}
                </p>
                <p className="text-sm text-slate-400">删除操作</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 筛选面板 */}
      {showFilters && (
        <div className="card p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 时间范围 */}
            <div>
              <label className="block text-sm text-slate-400 mb-2">
                <ClockIcon className="w-4 h-4 inline mr-1" />
                时间范围
              </label>
              <select
                value={timeRange}
                onChange={(e) => {
                  setTimeRange(e.target.value);
                  setPage(1);
                }}
                className="input w-full"
              >
                {timeRanges.map((range) => (
                  <option key={range.value} value={range.value}>
                    {range.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 操作类型 */}
            <div>
              <label className="block text-sm text-slate-400 mb-2">
                <UserIcon className="w-4 h-4 inline mr-1" />
                操作类型
              </label>
              <select
                value={actionFilter}
                onChange={(e) => {
                  setActionFilter(e.target.value);
                  setPage(1);
                }}
                className="input w-full"
              >
                <option value="">全部</option>
                <option value="POST">创建 (POST)</option>
                <option value="PUT">更新 (PUT)</option>
                <option value="PATCH">修改 (PATCH)</option>
                <option value="DELETE">删除 (DELETE)</option>
                <option value="GET">查看 (GET)</option>
              </select>
            </div>

            {/* 资源类型 */}
            <div>
              <label className="block text-sm text-slate-400 mb-2">
                <ServerIcon className="w-4 h-4 inline mr-1" />
                资源类型
              </label>
              <select
                value={resourceFilter}
                onChange={(e) => {
                  setResourceFilter(e.target.value);
                  setPage(1);
                }}
                className="input w-full"
              >
                <option value="">全部</option>
                {Object.entries(resourceLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 清除筛选 */}
          {(actionFilter || resourceFilter || timeRange !== '24h') && (
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => {
                  setActionFilter('');
                  setResourceFilter('');
                  setTimeRange('24h');
                  setPage(1);
                }}
                className="text-sm text-blue-400 hover:text-blue-300"
              >
                清除筛选
              </button>
            </div>
          )}
        </div>
      )}

      {/* 资源分布统计 */}
      {stats?.byResource && Object.keys(stats.byResource).length > 0 && (
        <div className="card p-4">
          <h3 className="text-sm font-medium text-slate-300 mb-3">资源操作分布</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.byResource)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 8)
              .map(([resource, count]) => (
                <button
                  key={resource}
                  onClick={() => {
                    setResourceFilter(resource);
                    setPage(1);
                    setShowFilters(true);
                  }}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg text-sm transition-colors',
                    resourceFilter === resource
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  )}
                >
                  {resourceLabels[resource] || resource}{' '}
                  <span className="text-slate-400">({count})</span>
                </button>
              ))}
          </div>
        </div>
      )}

      {/* 日志列表 */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-slate-400 text-sm border-b border-slate-700">
                <th className="pb-3 px-4 w-8"></th>
                <th className="pb-3 px-2">时间</th>
                <th className="pb-3 px-2">操作描述</th>
                <th className="pb-3 px-2">状态</th>
                <th className="pb-3 px-2">耗时</th>
                <th className="pb-3 px-2">来源</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <>
                  <tr
                    key={log.id}
                    className="border-t border-slate-700 hover:bg-slate-800/50 cursor-pointer transition-colors"
                    onClick={() => toggleRowExpand(log.id)}
                  >
                    <td className="py-3 px-4">
                      <button className="text-slate-400 hover:text-slate-300">
                        {expandedRows.has(log.id) ? (
                          <ChevronUpIcon className="w-4 h-4" />
                        ) : (
                          <ChevronDownIcon className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                    <td className="py-3 px-2 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-slate-300 text-sm">
                          {formatTime(log.timestamp)}
                        </span>
                        <span className="text-slate-500 text-xs">
                          {formatRelativeTime(log.timestamp)}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex items-start gap-3">
                        <div className={clsx(
                          'mt-0.5 p-1.5 rounded',
                          log.action === 'DELETE' && 'bg-red-500/10 text-red-400',
                          log.action === 'POST' && 'bg-green-500/10 text-green-400',
                          (log.action === 'PUT' || log.action === 'PATCH') && 'bg-yellow-500/10 text-yellow-400',
                          log.action === 'GET' && 'bg-blue-500/10 text-blue-400'
                        )}>
                          {getActionIcon(log.action)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-slate-200 text-sm leading-relaxed">
                            {getActionDescription(log)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-1.5">
                        {getStatusIcon(log.statusCode)}
                        <span className={clsx(
                          'text-sm font-medium',
                          getStatusColor(log.statusCode)
                        )}>
                          {log.statusCode}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-2 whitespace-nowrap">
                      <span className={clsx(
                        'text-sm',
                        log.duration > 1000 ? 'text-yellow-400' :
                        log.duration > 3000 ? 'text-red-400' : 'text-slate-400'
                      )}>
                        {log.duration}ms
                      </span>
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex flex-col">
                        <span className="text-slate-400 text-xs font-mono">
                          {log.clientIP}
                        </span>
                      </div>
                    </td>
                  </tr>

                  {/* 展开的详情行 */}
                  {expandedRows.has(log.id) && (
                    <tr className="border-t border-slate-700 bg-slate-800/30">
                      <td colSpan={6} className="px-4 py-4">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-sm">
                          {/* 基本信息 */}
                          <div className="space-y-3">
                            <h4 className="text-slate-300 font-medium mb-2 flex items-center gap-2">
                              <DocumentTextIcon className="w-4 h-4" />
                              基本信息
                            </h4>
                            <div className="space-y-2 bg-slate-900/50 rounded-lg p-3">
                              <div className="flex justify-between">
                                <span className="text-slate-500">用户:</span>
                                <span className="text-slate-300 font-medium">{log.user}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-500">操作类型:</span>
                                <span className={clsx('badge', actionColors[log.action] || 'badge-default')}>
                                  {actionLabels[log.action] || log.action}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-500">资源类型:</span>
                                <span className="text-slate-300">{resourceLabels[log.resource] || log.resource}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-500">资源名称:</span>
                                <span className="text-blue-400 font-mono text-xs">{log.resourceName || '-'}</span>
                              </div>
                              {log.namespace && (
                                <div className="flex justify-between">
                                  <span className="text-slate-500">命名空间:</span>
                                  <span className="badge badge-default">{log.namespace}</span>
                                </div>
                              )}
                              <div className="flex justify-between">
                                <span className="text-slate-500">集群:</span>
                                <span className="text-slate-300">{log.cluster || '-'}</span>
                              </div>
                            </div>
                          </div>

                          {/* 请求信息 */}
                          <div className="space-y-3">
                            <h4 className="text-slate-300 font-medium mb-2 flex items-center gap-2">
                              <ServerIcon className="w-4 h-4" />
                              请求信息
                            </h4>
                            <div className="space-y-2 bg-slate-900/50 rounded-lg p-3">
                              <div className="flex justify-between">
                                <span className="text-slate-500">客户端 IP:</span>
                                <span className="text-slate-300 font-mono text-xs">{log.clientIP}</span>
                              </div>
                              {log.userAgent && (
                                <div className="flex flex-col gap-1">
                                  <span className="text-slate-500">User Agent:</span>
                                  <span className="text-slate-400 text-xs font-mono break-all">
                                    {log.userAgent}
                                  </span>
                                </div>
                              )}
                              <div className="flex justify-between">
                                <span className="text-slate-500">响应状态:</span>
                                <div className="flex items-center gap-2">
                                  {getStatusIcon(log.statusCode)}
                                  <span className={getStatusColor(log.statusCode)}>
                                    {log.statusCode}
                                  </span>
                                </div>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-500">请求耗时:</span>
                                <span className={clsx(
                                  'font-medium',
                                  log.duration > 1000 ? 'text-yellow-400' :
                                  log.duration > 3000 ? 'text-red-400' : 'text-green-400'
                                )}>
                                  {log.duration}ms
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* 请求体 */}
                          {log.requestBody && (
                            <div className="lg:col-span-2 space-y-2">
                              <h4 className="text-slate-300 font-medium flex items-center gap-2">
                                <DocumentTextIcon className="w-4 h-4" />
                                请求体
                              </h4>
                              <pre className="bg-slate-900 rounded-lg p-3 text-xs text-slate-300 font-mono overflow-x-auto max-h-64">
                                {formatJSON(log.requestBody)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>

        {logs.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            没有找到审计日志
          </div>
        )}

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700">
            <div className="text-sm text-slate-400">
              第 {page} 页，共 {totalPages} 页（{total} 条记录）
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="btn btn-secondary btn-sm disabled:opacity-50"
              >
                <ChevronLeftIcon className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (page <= 3) {
                    pageNum = i + 1;
                  } else if (page >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = page - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={clsx(
                        'w-8 h-8 rounded text-sm',
                        page === pageNum
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      )}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="btn btn-secondary btn-sm disabled:opacity-50"
              >
                <ChevronRightIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 操作说明 */}
      <div className="text-sm text-slate-500">
        <p>审计日志记录所有对 Kubernetes 资源的写操作（创建、更新、删除）以及对 Secrets 的访问。</p>
        <p>敏感信息（密码、Token 等）已自动过滤。</p>
      </div>
    </div>
  );
}
