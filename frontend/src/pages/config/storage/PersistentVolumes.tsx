import { useQuery } from '@tanstack/react-query';
import { pvApi } from '../../../api';
import { usePollingInterval } from '../../../utils/polling';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import clsx from 'clsx';
import type { PersistentVolume } from '../../../types';

export default function PersistentVolumes() {
  const pollingInterval = usePollingInterval('standard');
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['pvs'],
    queryFn: () => pvApi.list(),
    refetchInterval: pollingInterval,
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

  const pvs = data?.items ?? [];

  // 获取状态颜色
  const getStatusColor = (phase?: string) => {
    switch (phase) {
      case 'Bound':
        return 'badge-success';
      case 'Available':
        return 'badge-info';
      case 'Pending':
        return 'badge-warning';
      case 'Released':
        return 'badge-purple';
      case 'Failed':
        return 'badge-error';
      default:
        return 'badge-default';
    }
  };

  // 格式化访问模式
  const formatAccessModes = (modes?: string[]) => {
    if (!modes || modes.length === 0) return '-';
    return modes.map((m) => {
      switch (m) {
        case 'ReadWriteOnce':
          return 'RWO';
        case 'ReadOnlyMany':
          return 'ROX';
        case 'ReadWriteMany':
          return 'RWX';
        case 'ReadWriteOncePod':
          return 'RWOP';
        default:
          return m;
      }
    }).join(', ');
  };

  // 获取回收策略颜色
  const getReclaimColor = (policy?: string) => {
    switch (policy) {
      case 'Retain':
        return 'badge-info';
      case 'Delete':
        return 'badge-error';
      case 'Recycle':
        return 'badge-warning';
      default:
        return 'badge-default';
    }
  };

  // 获取 Claim 引用
  const getClaimRef = (pv: PersistentVolume) => {
    const ref = pv.spec.claimRef;
    if (!ref) return '-';
    return `${ref.namespace}/${ref.name}`;
  };

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">PersistentVolumes</h1>
          <p className="text-text-muted mt-1">
            共 {pvs.length} 个 PV
          </p>
        </div>
        <button onClick={() => refetch()} className="btn btn-secondary">
          刷新
        </button>
      </div>

      {/* PV 列表 */}
      <div className="card overflow-hidden">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>名称</th>
                <th>状态</th>
                <th>容量</th>
                <th>访问模式</th>
                <th>回收策略</th>
                <th>StorageClass</th>
                <th>Claim</th>
                <th>创建时间</th>
              </tr>
            </thead>
            <tbody>
              {pvs.map((pv) => (
                <tr key={pv.metadata.uid}>
                  <td className="text-blue-400 font-medium">
                    {pv.metadata.name}
                  </td>
                  <td>
                    <span className={clsx('badge', getStatusColor(pv.status?.phase))}>
                      {pv.status?.phase || 'Unknown'}
                    </span>
                  </td>
                  <td className="text-text-muted">
                    {pv.spec.capacity?.storage || '-'}
                  </td>
                  <td className="text-text-muted">
                    {formatAccessModes(pv.spec.accessModes)}
                  </td>
                  <td>
                    <span className={clsx('badge', getReclaimColor(pv.spec.persistentVolumeReclaimPolicy))}>
                      {pv.spec.persistentVolumeReclaimPolicy || '-'}
                    </span>
                  </td>
                  <td className="text-text-muted">
                    {pv.spec.storageClassName || '-'}
                  </td>
                  <td className="text-text-muted">
                    {getClaimRef(pv)}
                  </td>
                  <td className="text-text-muted">
                    {formatDistanceToNow(new Date(pv.metadata.creationTimestamp), {
                      addSuffix: true,
                      locale: zhCN,
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pvs.length === 0 && (
          <div className="text-center py-12 text-text-muted">没有找到 PV</div>
        )}
      </div>
    </div>
  );
}
