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
          <h1 className="text-3xl font-bold bg-gradient-to-r from-white via-purple-100 to-pink-100 bg-clip-text text-transparent">
            StatefulSets
          </h1>
          <p className="text-slate-400 mt-2 text-sm font-medium">
            共 <span className="text-purple-400 font-semibold">{statefulSets.length}</span> 个 StatefulSet
            {currentNamespace !== 'all' && (
              <>
                {' '}在 <span className="text-pink-400 font-semibold">{currentNamespace}</span> 命名空间
              </>
            )}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="group relative px-5 py-2.5 bg-slate-800/60 backdrop-blur-sm hover:bg-slate-700/80 border border-slate-700/50 hover:border-purple-500/50 rounded-lg text-sm font-semibold text-slate-300 hover:text-white shadow-lg hover:shadow-purple-500/20 transition-all duration-300 overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-purple-600/0 via-purple-600/10 to-purple-600/0 opacity-0 group-hover:opacity-100 transition-opacity" />
          <span className="relative z-10 flex items-center gap-2">
            <svg className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            刷新
          </span>
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
