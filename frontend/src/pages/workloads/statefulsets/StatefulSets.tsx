import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { statefulSetApi } from '../../../api';
import { useAppStore } from '../../../store';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import clsx from 'clsx';

export default function StatefulSets() {
  const { currentNamespace } = useAppStore();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['statefulsets', currentNamespace],
    queryFn: () =>
      currentNamespace === 'all'
        ? statefulSetApi.listAll()
        : statefulSetApi.list(currentNamespace),
    refetchInterval: 30000,
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

  const statefulSets = data?.items ?? [];

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">StatefulSets</h1>
          <p className="text-slate-400 mt-1">
            共 {statefulSets.length} 个 StatefulSet
            {currentNamespace !== 'all' && ` 在 ${currentNamespace} 命名空间`}
          </p>
        </div>
        <button onClick={() => refetch()} className="btn btn-secondary">
          刷新
        </button>
      </div>

      {/* StatefulSet 列表 */}
      <div className="card overflow-hidden">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>名称</th>
                {currentNamespace === 'all' && <th>命名空间</th>}
                <th>状态</th>
                <th>就绪</th>
                <th>镜像</th>
                <th>创建时间</th>
              </tr>
            </thead>
            <tbody>
              {statefulSets.map((sts) => {
                const isHealthy =
                  sts.status.readyReplicas === sts.status.replicas &&
                  (sts.status.replicas ?? 0) > 0;
                const images = sts.spec.template.spec.containers
                  .map((c) => c.image.split('/').pop()?.split(':')[0] || c.image)
                  .join(', ');
                return (
                  <tr key={sts.metadata.uid}>
                    <td>
                      <Link
                        to={`/workloads/statefulsets/${sts.metadata.namespace}/${sts.metadata.name}`}
                        className="text-blue-400 hover:text-blue-300 font-medium"
                      >
                        {sts.metadata.name}
                      </Link>
                    </td>
                    {currentNamespace === 'all' && (
                      <td>
                        <span className="badge badge-default">{sts.metadata.namespace}</span>
                      </td>
                    )}
                    <td>
                      <span className={clsx('badge', isHealthy ? 'badge-success' : 'badge-warning')}>
                        {isHealthy ? 'Healthy' : 'Progressing'}
                      </span>
                    </td>
                    <td>
                      {sts.status.readyReplicas ?? 0}/{sts.status.replicas ?? 0}
                    </td>
                    <td className="text-slate-400 max-w-xs truncate" title={images}>
                      {images}
                    </td>
                    <td className="text-slate-400">
                      {formatDistanceToNow(new Date(sts.metadata.creationTimestamp), {
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
        {statefulSets.length === 0 && (
          <div className="text-center py-12 text-slate-400">没有找到 StatefulSet</div>
        )}
      </div>
    </div>
  );
}
