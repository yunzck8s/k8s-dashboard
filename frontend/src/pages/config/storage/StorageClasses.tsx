import { useQuery } from '@tanstack/react-query';
import { storageClassApi } from '../../../api';
import { usePollingInterval } from '../../../utils/polling';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import clsx from 'clsx';
import type { StorageClass } from '../../../types';

export default function StorageClasses() {
  const pollingInterval = usePollingInterval('standard');
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['storageclasses'],
    queryFn: () => storageClassApi.list(),
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

  const storageClasses = data?.items ?? [];

  // 检查是否是默认 StorageClass
  const isDefault = (sc: StorageClass) => {
    const annotations = sc.metadata.annotations;
    return (
      annotations?.['storageclass.kubernetes.io/is-default-class'] === 'true' ||
      annotations?.['storageclass.beta.kubernetes.io/is-default-class'] === 'true'
    );
  };

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">StorageClasses</h1>
          <p className="text-slate-400 mt-1">
            共 {storageClasses.length} 个 StorageClass
          </p>
        </div>
        <button onClick={() => refetch()} className="btn btn-secondary">
          刷新
        </button>
      </div>

      {/* StorageClass 列表 */}
      <div className="card overflow-hidden">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>名称</th>
                <th>Provisioner</th>
                <th>回收策略</th>
                <th>卷绑定模式</th>
                <th>允许扩容</th>
                <th>创建时间</th>
              </tr>
            </thead>
            <tbody>
              {storageClasses.map((sc) => (
                <tr key={sc.metadata.uid}>
                  <td>
                    <span className="text-blue-400 font-medium">
                      {sc.metadata.name}
                    </span>
                    {isDefault(sc) && (
                      <span className="ml-2 badge badge-success text-xs">默认</span>
                    )}
                  </td>
                  <td className="text-slate-400 font-mono text-sm">
                    {sc.provisioner}
                  </td>
                  <td>
                    <span
                      className={clsx(
                        'badge',
                        sc.reclaimPolicy === 'Delete' ? 'badge-error' : 'badge-info'
                      )}
                    >
                      {sc.reclaimPolicy || 'Delete'}
                    </span>
                  </td>
                  <td className="text-slate-400">
                    {sc.volumeBindingMode || 'Immediate'}
                  </td>
                  <td>
                    <span
                      className={clsx(
                        'badge',
                        sc.allowVolumeExpansion ? 'badge-success' : 'badge-default'
                      )}
                    >
                      {sc.allowVolumeExpansion ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="text-slate-400">
                    {formatDistanceToNow(new Date(sc.metadata.creationTimestamp), {
                      addSuffix: true,
                      locale: zhCN,
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {storageClasses.length === 0 && (
          <div className="text-center py-12 text-slate-400">没有找到 StorageClass</div>
        )}
      </div>
    </div>
  );
}
