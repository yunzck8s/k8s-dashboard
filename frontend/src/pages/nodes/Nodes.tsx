import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { nodeApi, podApi } from '../../api';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import clsx from 'clsx';
import type { Node } from '../../types';
import Pagination from '../../components/common/Pagination';

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

// 资源使用进度条组件（简化版）
function ResourceBar({
  used,
  total,
  label,
}: {
  used: number;
  total: number;
  label: string;
  colorClass?: string;
}) {
  const percentage = total > 0 ? Math.min((used / total) * 100, 100) : 0;

  const getBarColor = () => {
    if (percentage >= 90) return '#EF4444';
    if (percentage >= 70) return '#F59E0B';
    return 'var(--color-primary)';
  };

  return (
    <div className="min-w-[120px]">
      <div className="flex items-center justify-between text-xs mb-1">
        <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
        <span style={{ color: 'var(--color-text-secondary)' }}>{percentage.toFixed(0)}%</span>
      </div>
      <div
        className="h-2 rounded-full overflow-hidden"
        style={{ background: 'var(--color-bg-tertiary)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${percentage}%`,
            background: getBarColor(),
          }}
        />
      </div>
    </div>
  );
}

export default function Nodes() {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

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

  const nodes = data?.items ?? [];

  // 分页逻辑
  const totalItems = nodes.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const currentNodes = nodes.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1); // 切换页面大小时重置到第一页
  };

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

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>节点</h1>
          <p className="mt-1" style={{ color: 'var(--color-text-secondary)' }}>共 {nodes.length} 个节点</p>
        </div>
        <button onClick={() => refetch()} className="btn btn-secondary">
          刷新
        </button>
      </div>

      {/* 节点列表 */}
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
              {currentNodes.map((node) => {
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
                        className="font-medium transition-colors"
                        style={{ color: 'var(--color-primary)' }}
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
                    <td style={{ color: 'var(--color-text-muted)' }}>{getNodeRoles(node)}</td>
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
                        <span className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>{podCount}</span>
                        <span style={{ color: 'var(--color-text-muted)' }}>/</span>
                        <span style={{ color: 'var(--color-text-muted)' }}>{podCapacity}</span>
                      </div>
                    </td>
                    <td style={{ color: 'var(--color-text-muted)' }}>{node.status.nodeInfo?.kubeletVersion || '-'}</td>
                    <td style={{ color: 'var(--color-text-muted)' }}>
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
          <div className="text-center py-12" style={{ color: 'var(--color-text-muted)' }}>没有找到节点</div>
        )}
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      )}
    </div>
  );
}
