import { useQuery } from '@tanstack/react-query';
import { pvcApi } from '../../../api';
import { useAppStore } from '../../../store';
import { usePollingInterval } from '../../../utils/polling';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import clsx from 'clsx';

export default function PersistentVolumeClaims() {
  const { currentNamespace } = useAppStore();
  const pollingInterval = usePollingInterval('standard');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['pvcs', currentNamespace],
    queryFn: () =>
      currentNamespace === 'all'
        ? pvcApi.listAll()
        : pvcApi.list(currentNamespace),
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

  const pvcs = data?.items ?? [];

  // 获取状态颜色
  const getStatusColor = (phase?: string) => {
    switch (phase) {
      case 'Bound':
        return 'badge-success';
      case 'Pending':
        return 'badge-warning';
      case 'Lost':
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

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">PersistentVolumeClaims</h1>
          <p className="text-slate-400 mt-1">
            共 {pvcs.length} 个 PVC
            {currentNamespace !== 'all' && ` 在 ${currentNamespace} 命名空间`}
          </p>
        </div>
        <button onClick={() => refetch()} className="btn btn-secondary">
          刷新
        </button>
      </div>

      {/* PVC 列表 */}
      <div className="card overflow-hidden">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>名称</th>
                {currentNamespace === 'all' && <th>命名空间</th>}
                <th>状态</th>
                <th>Volume</th>
                <th>容量</th>
                <th>访问模式</th>
                <th>StorageClass</th>
                <th>创建时间</th>
              </tr>
            </thead>
            <tbody>
              {pvcs.map((pvc) => (
                <tr key={pvc.metadata.uid}>
                  <td className="text-blue-400 font-medium">
                    {pvc.metadata.name}
                  </td>
                  {currentNamespace === 'all' && (
                    <td>
                      <span className="badge badge-default">{pvc.metadata.namespace}</span>
                    </td>
                  )}
                  <td>
                    <span className={clsx('badge', getStatusColor(pvc.status?.phase))}>
                      {pvc.status?.phase || 'Unknown'}
                    </span>
                  </td>
                  <td className="text-slate-400">
                    {pvc.spec.volumeName || '-'}
                  </td>
                  <td className="text-slate-400">
                    {pvc.status?.capacity?.storage || pvc.spec.resources?.requests?.storage || '-'}
                  </td>
                  <td className="text-slate-400">
                    {formatAccessModes(pvc.spec.accessModes)}
                  </td>
                  <td className="text-slate-400">
                    {pvc.spec.storageClassName || '-'}
                  </td>
                  <td className="text-slate-400">
                    {formatDistanceToNow(new Date(pvc.metadata.creationTimestamp), {
                      addSuffix: true,
                      locale: zhCN,
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pvcs.length === 0 && (
          <div className="text-center py-12 text-slate-400">没有找到 PVC</div>
        )}
      </div>
    </div>
  );
}
