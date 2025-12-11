import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { nodeApi } from '../../api';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import clsx from 'clsx';
import type { Node, Pod } from '../../types';
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  ClipboardDocumentIcon,
  ShieldExclamationIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';

type TabType = 'overview' | 'pods' | 'yaml' | 'metrics';

export default function NodeDetail() {
  const { name } = useParams<{ name: string }>();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const queryClient = useQueryClient();

  // 获取节点详情
  const { data: node, isLoading, error, refetch } = useQuery({
    queryKey: ['node', name],
    queryFn: () => nodeApi.get(name!),
    enabled: !!name,
  });

  // 获取节点 YAML
  const { data: yamlData } = useQuery({
    queryKey: ['node-yaml', name],
    queryFn: () => nodeApi.getYaml(name!),
    enabled: !!name && activeTab === 'yaml',
  });

  // 获取节点上的 Pods
  const { data: podsData } = useQuery({
    queryKey: ['node-pods', name],
    queryFn: () => nodeApi.getPods(name!),
    enabled: !!name && activeTab === 'pods',
  });

  // 获取节点指标
  const { data: metricsData } = useQuery({
    queryKey: ['node-metrics', name],
    queryFn: () => nodeApi.getMetrics(name!),
    enabled: !!name && activeTab === 'metrics',
    refetchInterval: 30000,
  });

  // Cordon 节点
  const cordonMutation = useMutation({
    mutationFn: () => nodeApi.cordon(name!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['node', name] });
    },
  });

  // Uncordon 节点
  const uncordonMutation = useMutation({
    mutationFn: () => nodeApi.uncordon(name!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['node', name] });
    },
  });

  // Drain 节点
  const drainMutation = useMutation({
    mutationFn: () => nodeApi.drain(name!, { force: true, gracePeriod: 30 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['node', name] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (error || !node) {
    return (
      <div className="card p-6 text-center">
        <p className="text-red-400">加载失败：{(error as Error)?.message || '节点不存在'}</p>
        <button onClick={() => refetch()} className="btn btn-primary mt-4">
          重试
        </button>
      </div>
    );
  }

  const tabs: { id: TabType; label: string }[] = [
    { id: 'overview', label: '概览' },
    { id: 'pods', label: 'Pods' },
    { id: 'metrics', label: '指标' },
    { id: 'yaml', label: 'YAML' },
  ];

  // 检查节点是否就绪
  const isReady = node.status.conditions?.some(
    (c) => c.type === 'Ready' && c.status === 'True'
  );

  // 检查节点是否被 cordon
  const isUnschedulable = node.spec.unschedulable;

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/nodes" className="btn btn-secondary p-2">
            <ArrowLeftIcon className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{name}</h1>
              <span className={clsx('badge', isReady ? 'badge-success' : 'badge-error')}>
                {isReady ? 'Ready' : 'NotReady'}
              </span>
              {isUnschedulable && (
                <span className="badge badge-warning">SchedulingDisabled</span>
              )}
            </div>
            <p className="text-slate-400 mt-1">
              {node.status.nodeInfo?.kubeletVersion} | {node.status.nodeInfo?.osImage}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => refetch()} className="btn btn-secondary">
            <ArrowPathIcon className="w-4 h-4 mr-2" />
            刷新
          </button>
          {isUnschedulable ? (
            <button
              onClick={() => uncordonMutation.mutate()}
              className="btn btn-primary"
              disabled={uncordonMutation.isPending}
            >
              <ShieldCheckIcon className="w-4 h-4 mr-2" />
              Uncordon
            </button>
          ) : (
            <button
              onClick={() => cordonMutation.mutate()}
              className="btn btn-warning"
              disabled={cordonMutation.isPending}
            >
              <ShieldExclamationIcon className="w-4 h-4 mr-2" />
              Cordon
            </button>
          )}
          <button
            onClick={() => {
              if (confirm('确定要驱逐此节点上的所有 Pod 吗？此操作不可逆！')) {
                drainMutation.mutate();
              }
            }}
            className="btn btn-danger"
            disabled={drainMutation.isPending}
          >
            Drain
          </button>
        </div>
      </div>

      {/* 标签页导航 */}
      <div className="border-b border-slate-700">
        <nav className="flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-slate-400 hover:text-slate-300'
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* 标签页内容 */}
      <div>
        {activeTab === 'overview' && <OverviewTab node={node} />}
        {activeTab === 'pods' && <PodsTab pods={podsData?.items || []} />}
        {activeTab === 'metrics' && <MetricsTab metrics={metricsData} />}
        {activeTab === 'yaml' && <YamlTab yaml={yamlData || ''} />}
      </div>
    </div>
  );
}

// 概览标签页
function OverviewTab({ node }: { node: Node }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 基本信息 */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">基本信息</h3>
        <dl className="space-y-3">
          <InfoRow label="名称" value={node.metadata.name} />
          <InfoRow label="UID" value={node.metadata.uid} mono />
          <InfoRow
            label="创建时间"
            value={formatDistanceToNow(new Date(node.metadata.creationTimestamp), {
              addSuffix: true,
              locale: zhCN,
            })}
          />
          <InfoRow label="Pod CIDR" value={node.spec.podCIDR || '-'} />
          <InfoRow label="Provider ID" value={node.spec.providerID || '-'} mono />
        </dl>
      </div>

      {/* 系统信息 */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">系统信息</h3>
        <dl className="space-y-3">
          <InfoRow label="操作系统" value={node.status.nodeInfo?.osImage || '-'} />
          <InfoRow label="内核版本" value={node.status.nodeInfo?.kernelVersion || '-'} />
          <InfoRow label="容器运行时" value={node.status.nodeInfo?.containerRuntimeVersion || '-'} />
          <InfoRow label="Kubelet 版本" value={node.status.nodeInfo?.kubeletVersion || '-'} />
          <InfoRow label="Kube-Proxy 版本" value={node.status.nodeInfo?.kubeProxyVersion || '-'} />
          <InfoRow label="架构" value={node.status.nodeInfo?.architecture || '-'} />
        </dl>
      </div>

      {/* 资源容量 */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">资源容量</h3>
        <dl className="space-y-3">
          <InfoRow label="CPU" value={node.status.capacity?.cpu || '-'} />
          <InfoRow label="内存" value={formatMemory(node.status.capacity?.memory)} />
          <InfoRow label="存储" value={formatMemory(node.status.capacity?.['ephemeral-storage'])} />
          <InfoRow label="Pods" value={node.status.capacity?.pods || '-'} />
        </dl>
      </div>

      {/* 可分配资源 */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">可分配资源</h3>
        <dl className="space-y-3">
          <InfoRow label="CPU" value={node.status.allocatable?.cpu || '-'} />
          <InfoRow label="内存" value={formatMemory(node.status.allocatable?.memory)} />
          <InfoRow label="存储" value={formatMemory(node.status.allocatable?.['ephemeral-storage'])} />
          <InfoRow label="Pods" value={node.status.allocatable?.pods || '-'} />
        </dl>
      </div>

      {/* 地址 */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">地址</h3>
        <dl className="space-y-3">
          {node.status.addresses?.map((addr) => (
            <InfoRow key={addr.type} label={addr.type} value={addr.address} mono />
          ))}
        </dl>
      </div>

      {/* 标签 */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">标签</h3>
        <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
          {Object.entries(node.metadata.labels || {}).map(([key, value]) => (
            <span key={key} className="badge badge-default text-xs">
              {key}: {value}
            </span>
          ))}
        </div>
      </div>

      {/* 污点 */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">污点 (Taints)</h3>
        <div className="space-y-2">
          {node.spec.taints?.map((taint, idx) => (
            <div key={idx} className="badge badge-warning text-xs">
              {taint.key}={taint.value}:{taint.effect}
            </div>
          )) || <span className="text-slate-500">无污点</span>}
        </div>
      </div>

      {/* 条件状态 */}
      <div className="card p-6 lg:col-span-2">
        <h3 className="text-lg font-semibold text-white mb-4">条件状态</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-slate-400 text-sm">
                <th className="pb-3">类型</th>
                <th className="pb-3">状态</th>
                <th className="pb-3">原因</th>
                <th className="pb-3">消息</th>
                <th className="pb-3">最后心跳</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {node.status.conditions?.map((condition) => (
                <tr key={condition.type} className="border-t border-slate-700">
                  <td className="py-3 text-slate-300">{condition.type}</td>
                  <td className="py-3">
                    <span
                      className={clsx(
                        'badge',
                        condition.type === 'Ready'
                          ? condition.status === 'True'
                            ? 'badge-success'
                            : 'badge-error'
                          : condition.status === 'False'
                          ? 'badge-success'
                          : 'badge-warning'
                      )}
                    >
                      {condition.status}
                    </span>
                  </td>
                  <td className="py-3 text-slate-400">{condition.reason || '-'}</td>
                  <td className="py-3 text-slate-400 max-w-xs truncate">{condition.message || '-'}</td>
                  <td className="py-3 text-slate-400">
                    {condition.lastHeartbeatTime
                      ? formatDistanceToNow(new Date(condition.lastHeartbeatTime), {
                          addSuffix: true,
                          locale: zhCN,
                        })
                      : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Pods 标签页
function PodsTab({ pods }: { pods: Pod[] }) {
  // 获取 Pod 状态颜色（增强版：考虑容器 Ready 状态）
  const getPodStatusColor = (pod: Pod): string => {
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

    // 其他状态
    if (phase === 'Succeeded') return 'badge-info';
    if (phase === 'Failed') return 'badge-error';
    if (phase === 'Pending') return 'badge-warning';
    return 'badge-default';
  };

  return (
    <div className="card overflow-hidden">
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>名称</th>
              <th>命名空间</th>
              <th>状态</th>
              <th>Ready</th>
              <th>重启</th>
              <th>IP</th>
              <th>创建时间</th>
            </tr>
          </thead>
          <tbody>
            {pods.map((pod) => {
              const ready = pod.status.containerStatuses?.filter((c) => c.ready).length || 0;
              const total = pod.status.containerStatuses?.length || 0;
              const restarts = pod.status.containerStatuses?.reduce((sum, c) => sum + c.restartCount, 0) || 0;
              return (
                <tr key={pod.metadata.uid}>
                  <td>
                    <Link
                      to={`/workloads/pods/${pod.metadata.namespace}/${pod.metadata.name}`}
                      className="text-blue-400 hover:text-blue-300"
                    >
                      {pod.metadata.name}
                    </Link>
                  </td>
                  <td>
                    <span className="badge badge-default">{pod.metadata.namespace}</span>
                  </td>
                  <td>
                    <span className={clsx('badge', getPodStatusColor(pod))}>
                      {pod.status.phase}
                    </span>
                  </td>
                  <td>{ready}/{total}</td>
                  <td>{restarts}</td>
                  <td className="text-slate-400 font-mono text-sm">{pod.status.podIP || '-'}</td>
                  <td className="text-slate-400">
                    {formatDistanceToNow(new Date(pod.metadata.creationTimestamp), {
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
      {pods.length === 0 && (
        <div className="text-center py-12 text-slate-400">此节点上暂无 Pods</div>
      )}
    </div>
  );
}

// 指标标签页
function MetricsTab({ metrics }: { metrics?: any }) {
  if (!metrics) {
    return (
      <div className="card p-6 text-center">
        <p className="text-slate-400">暂无指标数据</p>
      </div>
    );
  }

  const cpuPercentage = metrics.cpu?.percentage || 0;
  const memoryPercentage = metrics.memory?.percentage || 0;
  const cpuUsage = metrics.cpu?.usage || 0;
  const cpuCapacity = metrics.cpu?.capacity || 1;
  const memoryUsage = metrics.memory?.usage || 0;
  const memoryCapacity = metrics.memory?.capacity || 1;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">CPU 使用率</h3>
        <div className="text-4xl font-bold text-blue-400 mb-4">
          {cpuPercentage.toFixed(1)}%
        </div>
        <div className="text-sm text-slate-400">
          <div className="flex justify-between mb-1">
            <span>使用量:</span>
            <span className="font-mono">{(cpuUsage / 1000).toFixed(2)} cores</span>
          </div>
          <div className="flex justify-between">
            <span>总容量:</span>
            <span className="font-mono">{(cpuCapacity / 1000).toFixed(2)} cores</span>
          </div>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-2 mt-4">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${Math.min(cpuPercentage, 100)}%` }}
          />
        </div>
      </div>
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">内存使用率</h3>
        <div className="text-4xl font-bold text-green-400 mb-4">
          {memoryPercentage.toFixed(1)}%
        </div>
        <div className="text-sm text-slate-400">
          <div className="flex justify-between mb-1">
            <span>使用量:</span>
            <span className="font-mono">{(memoryUsage / 1024 / 1024 / 1024).toFixed(2)} GB</span>
          </div>
          <div className="flex justify-between">
            <span>总容量:</span>
            <span className="font-mono">{(memoryCapacity / 1024 / 1024 / 1024).toFixed(2)} GB</span>
          </div>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-2 mt-4">
          <div
            className="bg-green-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${Math.min(memoryPercentage, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// YAML 标签页
function YamlTab({ yaml }: { yaml: string }) {
  const copyYaml = () => {
    navigator.clipboard.writeText(yaml);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={copyYaml} className="btn btn-secondary">
          <ClipboardDocumentIcon className="w-4 h-4 mr-2" />
          复制 YAML
        </button>
      </div>
      <div className="card p-4 bg-slate-900 max-h-[600px] overflow-auto">
        <pre className="text-sm text-slate-300 font-mono">{yaml || '加载中...'}</pre>
      </div>
    </div>
  );
}

// 信息行组件
function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between">
      <dt className="text-slate-400">{label}</dt>
      <dd className={clsx('text-slate-200', mono && 'font-mono text-sm')}>{value}</dd>
    </div>
  );
}

// 格式化内存
function formatMemory(value?: string): string {
  if (!value) return '-';
  const num = parseInt(value);
  if (isNaN(num)) return value;
  if (value.endsWith('Ki')) {
    const ki = parseInt(value);
    if (ki > 1024 * 1024) return `${(ki / 1024 / 1024).toFixed(1)} Gi`;
    if (ki > 1024) return `${(ki / 1024).toFixed(1)} Mi`;
    return `${ki} Ki`;
  }
  return value;
}
