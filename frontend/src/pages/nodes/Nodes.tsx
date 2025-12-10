import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { nodeApi, podApi } from '../../api';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import clsx from 'clsx';
import type { Node } from '../../types';

// 解析 CPU 值（转换为毫核）
function parseCpu(value: string): number {
  if (value.endsWith('m')) {
    return parseInt(value);
  }
  return parseFloat(value) * 1000;
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

// 资源使用进度条组件（带气泡效果）
function ResourceBar({
  used,
  total,
  label,
  colorClass = 'bg-blue-500',
}: {
  used: number;
  total: number;
  label: string;
  colorClass?: string;
}) {
  const percentage = total > 0 ? Math.min((used / total) * 100, 100) : 0;
  const getBarColor = () => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 70) return 'bg-amber-500';
    return colorClass;
  };

  // 获取气泡颜色
  const getBubbleColor = () => {
    if (percentage >= 90) return 'rgba(239, 68, 68, 0.6)';
    if (percentage >= 70) return 'rgba(245, 158, 11, 0.6)';
    if (colorClass === 'bg-purple-500') return 'rgba(168, 85, 247, 0.6)';
    return 'rgba(59, 130, 246, 0.6)';
  };

  // 生成气泡数量
  const bubbleCount = Math.max(2, Math.min(Math.floor(percentage / 20) + 1, 4));

  return (
    <div className="min-w-[120px]">
      <style>
        {`
          @keyframes bar-bubble-float {
            0%, 100% {
              transform: translateX(0) scale(1);
              opacity: 0.7;
            }
            50% {
              transform: translateX(3px) scale(1.2);
              opacity: 0.4;
            }
          }
          @keyframes bar-shimmer {
            0% {
              background-position: -100% 0;
            }
            100% {
              background-position: 200% 0;
            }
          }
        `}
      </style>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-slate-400">{label}</span>
        <span className="text-slate-300">{percentage.toFixed(0)}%</span>
      </div>
      <div className="h-2 bg-slate-700 rounded-full overflow-hidden relative">
        <div
          className={clsx('h-full rounded-full transition-all relative overflow-hidden', getBarColor())}
          style={{ width: `${percentage}%` }}
        >
          {/* 光泽效果 */}
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)',
              backgroundSize: '200% 100%',
              animation: 'bar-shimmer 2s infinite linear',
            }}
          />
          {/* 气泡效果 */}
          {percentage > 10 && Array.from({ length: bubbleCount }, (_, i) => (
            <div
              key={i}
              className="absolute rounded-full"
              style={{
                width: `${3 + (i % 2) * 2}px`,
                height: `${3 + (i % 2) * 2}px`,
                backgroundColor: getBubbleColor(),
                left: `${15 + (i * 100) / bubbleCount}%`,
                top: '50%',
                transform: 'translateY(-50%)',
                boxShadow: `0 0 4px ${getBubbleColor()}`,
                animation: `bar-bubble-float ${1.5 + i * 0.3}s ease-in-out ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Nodes() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['nodes'],
    queryFn: () => nodeApi.list(),
    refetchInterval: 30000,
  });

  // 获取所有 Pod 来统计每个节点上运行的 Pod 数量
  const { data: podsData } = useQuery({
    queryKey: ['pods-all'],
    queryFn: () => podApi.listAll(),
    refetchInterval: 30000,
  });

  // 计算每个节点上运行的 Pod 数量
  const getNodePodCount = (nodeName: string) => {
    if (!podsData?.items) return 0;
    return podsData.items.filter(
      (pod) => pod.spec.nodeName === nodeName && pod.status.phase === 'Running'
    ).length;
  };

  // 计算节点上 Pod 的资源请求总和
  const getNodeResourceUsage = (nodeName: string) => {
    if (!podsData?.items) return { cpuRequest: 0, memRequest: 0 };

    let cpuRequest = 0;
    let memRequest = 0;

    const nodePods = podsData.items.filter((pod) => pod.spec.nodeName === nodeName);
    for (const pod of nodePods) {
      const containers = pod.spec.containers ?? [];
      for (const container of containers) {
        const resources = container.resources ?? {};
        if (resources.requests?.cpu) {
          cpuRequest += parseCpu(resources.requests.cpu);
        }
        if (resources.requests?.memory) {
          memRequest += parseMemory(resources.requests.memory);
        }
      }
    }

    return { cpuRequest, memRequest };
  };

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

  const nodes = data?.items ?? [];

  // 获取节点状态
  const getNodeStatus = (node: Node) => {
    const readyCondition = node.status.conditions?.find((c) => c.type === 'Ready');
    return readyCondition?.status === 'True';
  };

  // 获取节点角色
  const getNodeRoles = (node: Node) => {
    const roles: string[] = [];
    const labels = node.metadata.labels || {};
    if (labels['node-role.kubernetes.io/control-plane'] !== undefined) roles.push('control-plane');
    if (labels['node-role.kubernetes.io/master'] !== undefined) roles.push('master');
    if (labels['node-role.kubernetes.io/worker'] !== undefined) roles.push('worker');
    return roles.length > 0 ? roles.join(', ') : 'worker';
  };

  // 格式化内存
  const formatMemory = (value?: string) => {
    if (!value) return '-';
    const ki = parseInt(value);
    if (isNaN(ki)) return value;
    if (ki > 1024 * 1024) return `${(ki / 1024 / 1024).toFixed(1)} Gi`;
    if (ki > 1024) return `${(ki / 1024).toFixed(1)} Mi`;
    return `${ki} Ki`;
  };

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">节点</h1>
          <p className="text-slate-400 mt-1">共 {nodes.length} 个节点</p>
        </div>
        <button onClick={() => refetch()} className="btn btn-secondary">
          刷新
        </button>
      </div>

      {/* 节点列表 */}
      <div className="card overflow-hidden">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>名称</th>
                <th>状态</th>
                <th>角色</th>
                <th>CPU 使用</th>
                <th>内存使用</th>
                <th>Pods</th>
                <th>版本</th>
                <th>创建时间</th>
              </tr>
            </thead>
            <tbody>
              {nodes.map((node) => {
                const isReady = getNodeStatus(node);
                const isUnschedulable = node.spec.unschedulable;
                const nodeName = node.metadata.name;
                const podCount = getNodePodCount(nodeName);
                const podCapacity = parseInt(node.status.allocatable?.pods || '110');
                const resourceUsage = getNodeResourceUsage(nodeName);

                // 解析 CPU 容量（毫核）
                const cpuCapacity = node.status.allocatable?.cpu
                  ? parseCpu(node.status.allocatable.cpu)
                  : 4000;

                // 解析内存容量（字节）
                const memCapacity = node.status.allocatable?.memory
                  ? parseMemory(node.status.allocatable.memory)
                  : 8 * 1024 * 1024 * 1024;

                return (
                  <tr key={node.metadata.uid}>
                    <td>
                      <Link
                        to={`/nodes/${node.metadata.name}`}
                        className="text-blue-400 hover:text-blue-300 font-medium"
                      >
                        {node.metadata.name}
                      </Link>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className={clsx('badge', isReady ? 'badge-success' : 'badge-error')}>
                          {isReady ? 'Ready' : 'NotReady'}
                        </span>
                        {isUnschedulable && (
                          <span className="badge badge-warning">SchedulingDisabled</span>
                        )}
                      </div>
                    </td>
                    <td className="text-slate-400">{getNodeRoles(node)}</td>
                    <td>
                      <ResourceBar
                        used={resourceUsage.cpuRequest}
                        total={cpuCapacity}
                        label={`${(resourceUsage.cpuRequest / 1000).toFixed(1)} / ${(cpuCapacity / 1000).toFixed(0)} cores`}
                        colorClass="bg-blue-500"
                      />
                    </td>
                    <td>
                      <ResourceBar
                        used={resourceUsage.memRequest}
                        total={memCapacity}
                        label={`${(resourceUsage.memRequest / 1024 / 1024 / 1024).toFixed(1)} / ${(memCapacity / 1024 / 1024 / 1024).toFixed(0)} Gi`}
                        colorClass="bg-purple-500"
                      />
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-semibold text-white">{podCount}</span>
                        <span className="text-slate-500">/</span>
                        <span className="text-slate-400">{podCapacity}</span>
                      </div>
                    </td>
                    <td className="text-slate-400">{node.status.nodeInfo?.kubeletVersion || '-'}</td>
                    <td className="text-slate-400">
                      {formatDistanceToNow(new Date(node.metadata.creationTimestamp), {
                        addSuffix: true,
                        locale: zhCN,
                      })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {nodes.length === 0 && (
          <div className="text-center py-12 text-slate-400">没有找到节点</div>
        )}
      </div>
    </div>
  );
}
