import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { observationApi } from '../../../api';
import { usePollingInterval } from '../../../utils/polling';
import clsx from 'clsx';
import { Link } from 'react-router-dom';

type TabType = 'pods' | 'nodes' | 'resources';

const tabs: { key: TabType; label: string }[] = [
  { key: 'pods', label: 'Pod 异常' },
  { key: 'nodes', label: '节点异常' },
  { key: 'resources', label: '资源超限' },
];

export default function AnomalyPanel() {
  const [activeTab, setActiveTab] = useState<TabType>('pods');
  const pollingInterval = usePollingInterval('standard');

  // 获取 Pod 异常
  const { data: podAnomalies, isLoading: podsLoading } = useQuery({
    queryKey: ['observation-pod-anomalies'],
    queryFn: () => observationApi.getPodAnomalies(),
    refetchInterval: pollingInterval,
  });

  // 获取节点异常
  const { data: nodeAnomalies, isLoading: nodesLoading } = useQuery({
    queryKey: ['observation-node-anomalies'],
    queryFn: () => observationApi.getNodeAnomalies(),
    refetchInterval: pollingInterval,
  });

  // 获取资源超限
  const { data: resourceExcess, isLoading: resourcesLoading } = useQuery({
    queryKey: ['observation-resource-excess'],
    queryFn: () => observationApi.getResourceExcess(),
    refetchInterval: pollingInterval,
  });

  const getReasonBadgeColor = (reason: string) => {
    switch (reason) {
      case 'CrashLoopBackOff':
        return 'badge-error';
      case 'OOMKilled':
        return 'badge-error';
      case 'ImagePullBackOff':
      case 'ErrImagePull':
        return 'badge-warning';
      case 'Pending':
        return 'badge-warning';
      case 'HighRestartCount':
        return 'badge-warning';
      case 'NotReady':
        return 'badge-error';
      case 'MemoryPressure':
      case 'DiskPressure':
      case 'PIDPressure':
        return 'badge-warning';
      default:
        return 'badge-default';
    }
  };

  const renderPodAnomalies = () => {
    if (podsLoading) {
      return (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
        </div>
      );
    }

    const items = podAnomalies?.items ?? [];
    if (items.length === 0) {
      return (
        <div className="text-center py-12 text-text-muted">
          <p>没有发现 Pod 异常</p>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-left text-sm font-medium text-text-muted">名称</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-text-muted">命名空间</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-text-muted">原因</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-text-muted">重启次数</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-text-muted">持续时间</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-text-muted">消息</th>
            </tr>
          </thead>
          <tbody>
            {items.map((pod, idx) => (
              <tr key={`${pod.namespace}-${pod.name}-${idx}`} className="border-b border-[color-mix(in_srgb,var(--color-border)_50%,transparent)] hover:bg-[color-mix(in_srgb,var(--color-bg-tertiary)_30%,transparent)]">
                <td className="px-4 py-3">
                  <Link
                    to={`/workloads/pods/${pod.namespace}/${pod.name}`}
                    className="text-blue-400 hover:text-blue-300 font-medium"
                  >
                    {pod.name}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span className="badge badge-default">{pod.namespace}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={clsx('badge', getReasonBadgeColor(pod.reason))}>
                    {pod.reason}
                  </span>
                </td>
                <td className="px-4 py-3 text-text-secondary">{pod.restartCount}</td>
                <td className="px-4 py-3 text-text-muted">{pod.duration}</td>
                <td className="px-4 py-3 text-text-muted max-w-xs truncate" title={pod.message}>
                  {pod.message || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderNodeAnomalies = () => {
    if (nodesLoading) {
      return (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
        </div>
      );
    }

    const items = nodeAnomalies?.items ?? [];
    if (items.length === 0) {
      return (
        <div className="text-center py-12 text-text-muted">
          <p>没有发现节点异常</p>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-left text-sm font-medium text-text-muted">节点名称</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-text-muted">状态</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-text-muted">受影响 Pod</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-text-muted">持续时间</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-text-muted">消息</th>
            </tr>
          </thead>
          <tbody>
            {items.map((node, idx) => (
              <tr key={`${node.name}-${idx}`} className="border-b border-[color-mix(in_srgb,var(--color-border)_50%,transparent)] hover:bg-[color-mix(in_srgb,var(--color-bg-tertiary)_30%,transparent)]">
                <td className="px-4 py-3">
                  <Link
                    to={`/nodes/${node.name}`}
                    className="text-blue-400 hover:text-blue-300 font-medium"
                  >
                    {node.name}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span className={clsx('badge', getReasonBadgeColor(node.reason))}>
                    {node.reason}
                  </span>
                </td>
                <td className="px-4 py-3 text-text-secondary">{node.affectedPods}</td>
                <td className="px-4 py-3 text-text-muted">{node.duration}</td>
                <td className="px-4 py-3 text-text-muted max-w-xs truncate" title={node.message}>
                  {node.message || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderResourceExcess = () => {
    if (resourcesLoading) {
      return (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
        </div>
      );
    }

    const items = resourceExcess?.items ?? [];
    if (items.length === 0) {
      return (
        <div className="text-center py-12 text-text-muted">
          <p>没有发现资源超限</p>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-left text-sm font-medium text-text-muted">资源名称</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-text-muted">命名空间</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-text-muted">类型</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-text-muted">使用率</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-text-muted">阈值</th>
            </tr>
          </thead>
          <tbody>
            {items.map((resource, idx) => (
              <tr key={`${resource.namespace}-${resource.resourceName}-${idx}`} className="border-b border-[color-mix(in_srgb,var(--color-border)_50%,transparent)] hover:bg-[color-mix(in_srgb,var(--color-bg-tertiary)_30%,transparent)]">
                <td className="px-4 py-3">
                  {resource.namespace ? (
                    <Link
                      to={`/workloads/pods/${resource.namespace}/${resource.resourceName}`}
                      className="text-blue-400 hover:text-blue-300 font-medium"
                    >
                      {resource.resourceName}
                    </Link>
                  ) : (
                    <span className="text-text-secondary font-medium">{resource.resourceName}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {resource.namespace ? (
                    <span className="badge badge-default">{resource.namespace}</span>
                  ) : (
                    '-'
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={clsx(
                    'badge',
                    resource.type === 'cpu' ? 'badge-info' : 'badge-purple'
                  )}>
                    {resource.type.toUpperCase()}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-surface-tertiary rounded-full overflow-hidden max-w-[100px]">
                      <div
                        className={clsx(
                          'h-full rounded-full',
                          resource.usagePercent >= 90 ? 'bg-red-500' : 'bg-yellow-500'
                        )}
                        style={{ width: `${Math.min(resource.usagePercent, 100)}%` }}
                      />
                    </div>
                    <span className={clsx(
                      'text-sm font-medium',
                      resource.usagePercent >= 90 ? 'text-red-400' : 'text-yellow-400'
                    )}>
                      {resource.usagePercent.toFixed(1)}%
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-text-muted">{resource.threshold}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="card overflow-hidden">
      {/* Tab 导航 */}
      <div className="flex border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={clsx(
              'px-6 py-3 text-sm font-medium transition-all duration-200 relative',
              activeTab === tab.key
                ? 'text-indigo-400'
                : 'text-text-muted hover:text-white'
            )}
          >
            {tab.label}
            {activeTab === tab.key && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500" />
            )}
          </button>
        ))}
      </div>

      {/* Tab 内容 */}
      <div className="p-4">
        {activeTab === 'pods' && renderPodAnomalies()}
        {activeTab === 'nodes' && renderNodeAnomalies()}
        {activeTab === 'resources' && renderResourceExcess()}
      </div>
    </div>
  );
}
