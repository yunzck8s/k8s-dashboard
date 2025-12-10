import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { podApi } from '../../../api';
import { useAppStore } from '../../../store';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import clsx from 'clsx';
import type { Pod, PodPhase } from '../../../types';

// Pod 状态颜色映射
const phaseColors: Record<PodPhase, string> = {
  Running: 'badge-success',
  Pending: 'badge-warning',
  Succeeded: 'badge-info',
  Failed: 'badge-error',
  Unknown: 'badge-default',
};

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

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['pods', currentNamespace],
    queryFn: () =>
      currentNamespace === 'all'
        ? podApi.listAll()
        : podApi.list(currentNamespace),
    refetchInterval: 30000,
  });

  // 获取所有 Pod 的实际资源使用量
  const { data: metricsData } = useQuery({
    queryKey: ['pods-metrics'],
    queryFn: () => podApi.listAllMetrics(),
    refetchInterval: 30000,
  });

  // 创建 metrics 查找 map
  const metricsMap = new Map<string, { cpuUsage: number; memoryUsage: number }>();
  if (metricsData?.items) {
    for (const m of metricsData.items) {
      const key = `${m.namespace}/${m.name}`;
      metricsMap.set(key, {
        cpuUsage: m.cpuUsage,
        memoryUsage: m.memoryUsage,
      });
    }
  }

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

  const pods = data?.items ?? [];

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Pods</h1>
          <p className="text-slate-400 mt-1">
            共 {pods.length} 个 Pod
            {currentNamespace !== 'all' && ` 在 ${currentNamespace} 命名空间`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => refetch()} className="btn btn-secondary">
            刷新
          </button>
        </div>
      </div>

      {/* Pod 列表 */}
      <div className="card overflow-hidden">
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
              {pods.map((pod) => {
                const status = getPodStatus(pod);
                const resources = getPodResources(pod);
                const podKey = `${pod.metadata.namespace}/${pod.metadata.name}`;
                const metrics = metricsMap.get(podKey);

                return (
                  <tr key={pod.metadata.uid}>
                    <td>
                      <Link
                        to={`/workloads/pods/${pod.metadata.namespace}/${pod.metadata.name}`}
                        className="text-blue-400 hover:text-blue-300 font-medium"
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
                      <span className={clsx('badge', phaseColors[status.phase])}>
                        {status.reason || status.phase}
                      </span>
                    </td>
                    <td>{getReadyContainers(pod)}</td>
                    <td>{getRestartCount(pod)}</td>
                    <td className="text-slate-300 font-mono text-sm">
                      <div className="flex flex-col">
                        <span className="text-green-400">
                          {metrics ? formatCpuUsage(metrics.cpuUsage) : '-'}
                        </span>
                        <span className="text-xs text-slate-500">
                          请求: <span className="text-blue-400">{resources.cpuRequest}</span>
                          {resources.cpuLimit !== '-' && (
                            <> / 限制: <span className="text-orange-400">{resources.cpuLimit}</span></>
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="text-slate-300 font-mono text-sm">
                      <div className="flex flex-col">
                        <span className="text-green-400">
                          {metrics ? formatMemory(metrics.memoryUsage) : '-'}
                        </span>
                        <span className="text-xs text-slate-500">
                          请求: <span className="text-blue-400">{resources.memRequest}</span>
                          {resources.memLimit !== '-' && (
                            <> / 限制: <span className="text-orange-400">{resources.memLimit}</span></>
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="text-slate-400">
                      {pod.spec.nodeName || '-'}
                    </td>
                    <td className="text-slate-400">
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
        {pods.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            没有找到 Pod
          </div>
        )}
      </div>
    </div>
  );
}
