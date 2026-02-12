import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { podApi } from '../../../api';
import { useAppStore } from '../../../store';
import { usePollingInterval } from '../../../utils/polling';
import { queryKeys } from '../../../api/queryKeys';
import { createVisibilityRefetchInterval } from '../../../api/queryPolicy';
import { useNamespacePagination } from '../../../hooks/useNamespacePagination';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import clsx from 'clsx';
import Pagination from '../../../components/common/Pagination';
import type { Pod, PodPhase } from '../../../types';

// Pod 状态颜色映射
const phaseColors: Record<PodPhase, string> = {
  Running: 'badge-success',
  Pending: 'badge-warning',
  Succeeded: 'badge-info',
  Failed: 'badge-error',
  Unknown: 'badge-default',
};

// 获取 Pod 状态颜色（增强版：考虑容器 Ready 状态）
function getPodStatusColor(pod: Pod): string {
  const phase = pod.status.phase;

  // 对于 Running 状态，检查容器是否真的准备好
  if (phase === 'Running') {
    const containerStatuses = pod.status.containerStatuses ?? [];
    const ready = containerStatuses.filter((cs) => cs.ready).length;
    const total = containerStatuses.length;

    // 如果不是所有容器都 ready，显示为警告状态（黄色）
    if (total > 0 && ready < total) {
      return 'badge-warning';
    }

    // 所有容器都 ready，显示为成功状态（绿色）
    return 'badge-success';
  }

  // 其他状态使用默认颜色
  return phaseColors[phase] || 'badge-default';
}

// 获取 Pod 状态
function getPodStatus(pod: Pod): { phase: PodPhase; reason?: string } {
  const phase = pod.status.phase;

  // 检查容器状态
  const containerStatuses = pod.status.containerStatuses ?? [];
  for (const cs of containerStatuses) {
    if (cs.state.waiting?.reason) {
      return { phase, reason: cs.state.waiting.reason };
    }
    if (cs.state.terminated?.reason) {
      return { phase, reason: cs.state.terminated.reason };
    }
  }

  return { phase };
}

// 获取 Ready 容器数
function getReadyContainers(pod: Pod): string {
  const containerStatuses = pod.status.containerStatuses ?? [];
  const ready = containerStatuses.filter((cs) => cs.ready).length;
  const total = containerStatuses.length;
  return `${ready}/${total}`;
}

// 获取重启次数
function getRestartCount(pod: Pod): number {
  const containerStatuses = pod.status.containerStatuses ?? [];
  return containerStatuses.reduce((sum, cs) => sum + cs.restartCount, 0);
}

// 获取 Pod 资源请求/限制
function getPodResources(pod: Pod): {
  cpuRequest: string;
  cpuLimit: string;
  memRequest: string;
  memLimit: string;
} {
  let cpuRequest = 0;
  let cpuLimit = 0;
  let memRequest = 0;
  let memLimit = 0;

  const containers = pod.spec.containers ?? [];
  for (const container of containers) {
    const resources = container.resources ?? {};

    // CPU requests/limits
    if (resources.requests?.cpu) {
      cpuRequest += parseCpu(resources.requests.cpu);
    }
    if (resources.limits?.cpu) {
      cpuLimit += parseCpu(resources.limits.cpu);
    }

    // Memory requests/limits
    if (resources.requests?.memory) {
      memRequest += parseMemory(resources.requests.memory);
    }
    if (resources.limits?.memory) {
      memLimit += parseMemory(resources.limits.memory);
    }
  }

  return {
    cpuRequest: cpuRequest > 0 ? formatCpu(cpuRequest) : '-',
    cpuLimit: cpuLimit > 0 ? formatCpu(cpuLimit) : '-',
    memRequest: memRequest > 0 ? formatMemory(memRequest) : '-',
    memLimit: memLimit > 0 ? formatMemory(memLimit) : '-',
  };
}

// 解析 CPU 值（转换为毫核）
function parseCpu(value: string): number {
  if (value.endsWith('m')) {
    return parseInt(value);
  }
  return parseFloat(value) * 1000;
}

// 格式化 CPU 值
function formatCpu(milliCores: number): string {
  if (milliCores >= 1000) {
    return `${(milliCores / 1000).toFixed(1)}`;
  }
  return `${milliCores}m`;
}

// 格式化 CPU 使用量（从 cores 转换）
function formatCpuUsage(cores: number): string {
  const milliCores = cores * 1000;
  if (milliCores >= 1000) {
    return `${(milliCores / 1000).toFixed(2)}`;
  }
  return `${Math.round(milliCores)}m`;
}

// 解析内存值（转换为字节）
function parseMemory(value: string): number {
  const units: Record<string, number> = {
    Ki: 1024,
    Mi: 1024 * 1024,
    Gi: 1024 * 1024 * 1024,
    Ti: 1024 * 1024 * 1024 * 1024,
    K: 1000,
    M: 1000 * 1000,
    G: 1000 * 1000 * 1000,
    T: 1000 * 1000 * 1000 * 1000,
  };

  for (const [unit, multiplier] of Object.entries(units)) {
    if (value.endsWith(unit)) {
      return parseFloat(value) * multiplier;
    }
  }
  return parseFloat(value);
}

// 格式化内存值
function formatMemory(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / 1024 / 1024 / 1024).toFixed(1)}Gi`;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(0)}Mi`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(0)}Ki`;
  }
  return `${bytes}B`;
}

export default function Pods() {
  const { currentNamespace } = useAppStore();
  const pollingInterval = usePollingInterval('standard');
  const refetchInterval = createVisibilityRefetchInterval(pollingInterval);
  const { currentPage, pageSize, setCurrentPage, setPageSize } = useNamespacePagination(currentNamespace);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.pods(currentNamespace),
    queryFn: () =>
      currentNamespace === 'all'
        ? podApi.listAll()
        : podApi.list(currentNamespace),
    refetchInterval,
  });

  // 获取所有 Pod 的实际资源使用量
  const { data: metricsData } = useQuery({
    queryKey: queryKeys.podsMetrics,
    queryFn: () => podApi.listAllMetrics(),
    refetchInterval,
  });

  // 创建 metrics 查找 map
  const metricsMap = useMemo(() => {
    const map = new Map<string, { cpuUsage: number; memoryUsage: number }>();
    if (!metricsData?.items) {
      return map;
    }
    for (const metrics of metricsData.items) {
      map.set(`${metrics.namespace}/${metrics.name}`, {
        cpuUsage: metrics.cpuUsage,
        memoryUsage: metrics.memoryUsage,
      });
    }
    return map;
  }, [metricsData]);

  const pods = useMemo(() => data?.items ?? [], [data?.items]);
  const totalItems = pods.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const currentPods = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return pods.slice(startIndex, endIndex);
  }, [currentPage, pageSize, pods]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div
          className="animate-spin rounded-full h-8 w-8 border-b-2"
          style={{ borderColor: 'var(--color-primary)' }}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="p-6 text-center rounded-xl"
        style={{
          background: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
        }}
      >
        <p style={{ color: '#F87171' }}>加载失败：{(error as Error).message}</p>
        <button onClick={() => refetch()} className="btn btn-primary mt-4">
          重试
        </button>
      </div>
    );
  }

  // 处理页码变化
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 处理每页数量变化
  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1); // 重置到第一页
  };

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">
            Pods
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            共 <span className="text-[var(--color-primary)]">{totalItems}</span> 个 Pod
            {currentNamespace !== 'all' && (
              <>
                {' '}在 <span className="text-[var(--color-primary)]">{currentNamespace}</span> 命名空间
              </>
            )}
            {totalPages > 1 && (
              <span className="ml-2 text-xs text-[var(--color-text-muted)]">
                (第 {currentPage}/{totalPages} 页)
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="btn btn-secondary flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          刷新
        </button>
      </div>

      {/* Pod 列表 */}
      <div
        className="overflow-hidden rounded-xl"
        style={{
          background: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
        }}
      >
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>名称</th>
                {currentNamespace === 'all' && <th>命名空间</th>}
                <th>状态</th>
                <th>Ready</th>
                <th>重启</th>
                <th>CPU 使用</th>
                <th>内存使用</th>
                <th>节点</th>
                <th>创建时间</th>
              </tr>
            </thead>
            <tbody>
              {currentPods.map((pod) => {
                const status = getPodStatus(pod);
                const resources = getPodResources(pod);
                const podKey = `${pod.metadata.namespace}/${pod.metadata.name}`;
                const metrics = metricsMap.get(podKey);

                return (
                  <tr key={pod.metadata.uid}>
                    <td>
                      <Link
                        to={`/workloads/pods/${pod.metadata.namespace}/${pod.metadata.name}`}
                        className="font-medium transition-colors"
                        style={{ color: 'var(--color-primary)' }}
                      >
                        {pod.metadata.name}
                      </Link>
                    </td>
                    {currentNamespace === 'all' && (
                      <td>
                        <span className="badge badge-default">
                          {pod.metadata.namespace}
                        </span>
                      </td>
                    )}
                    <td>
                      <span className={clsx('badge', getPodStatusColor(pod))}>
                        {status.reason || status.phase}
                      </span>
                    </td>
                    <td>{getReadyContainers(pod)}</td>
                    <td>{getRestartCount(pod)}</td>
                    <td className="font-mono text-sm">
                      <div className="flex flex-col">
                        <span style={{ color: '#34D399' }}>
                          {metrics ? formatCpuUsage(metrics.cpuUsage) : '-'}
                        </span>
                        <span className="text-xs text-[var(--color-text-muted)]">
                          请求: <span style={{ color: '#60A5FA' }}>{resources.cpuRequest}</span>
                          {resources.cpuLimit !== '-' && (
                            <> / 限制: <span style={{ color: '#FBBF24' }}>{resources.cpuLimit}</span></>
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="font-mono text-sm">
                      <div className="flex flex-col">
                        <span style={{ color: '#34D399' }}>
                          {metrics ? formatMemory(metrics.memoryUsage) : '-'}
                        </span>
                        <span className="text-xs text-[var(--color-text-muted)]">
                          请求: <span style={{ color: '#60A5FA' }}>{resources.memRequest}</span>
                          {resources.memLimit !== '-' && (
                            <> / 限制: <span style={{ color: '#FBBF24' }}>{resources.memLimit}</span></>
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="text-[var(--color-text-secondary)]">
                      {pod.spec.nodeName || '-'}
                    </td>
                    <td className="text-[var(--color-text-secondary)]">
                      {formatDistanceToNow(
                        new Date(pod.metadata.creationTimestamp),
                        { addSuffix: true, locale: zhCN }
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 空状态 */}
        {pods.length === 0 && (
          <div className="text-center py-12 text-[var(--color-text-muted)]">
            没有找到 Pod
          </div>
        )}

        {/* 分页 */}
        {pods.length > 0 && totalPages > 1 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            pageSizeOptions={[10, 20, 50, 100]}
          />
        )}
      </div>
    </div>
  );
}
