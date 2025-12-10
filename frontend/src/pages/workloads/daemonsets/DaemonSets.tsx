import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { daemonSetApi } from '../../../api';
import { useAppStore } from '../../../store';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import clsx from 'clsx';

export default function DaemonSets() {
  const { currentNamespace } = useAppStore();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['daemonsets', currentNamespace],
    queryFn: () =>
      currentNamespace === 'all'
        ? daemonSetApi.listAll()
        : daemonSetApi.list(currentNamespace),
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

  const daemonSets = data?.items ?? [];

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">DaemonSets</h1>
          <p className="text-slate-400 mt-1">
            共 {daemonSets.length} 个 DaemonSet
            {currentNamespace !== 'all' && ` 在 ${currentNamespace} 命名空间`}
          </p>
        </div>
        <button onClick={() => refetch()} className="btn btn-secondary">
          刷新
        </button>
      </div>

      {/* DaemonSet 列表 */}
      <div className="card overflow-hidden">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>名称</th>
                {currentNamespace === 'all' && <th>命名空间</th>}
                <th>状态</th>
                <th>期望</th>
                <th>就绪</th>
                <th>可用</th>
                <th>节点选择器</th>
                <th>创建时间</th>
              </tr>
            </thead>
            <tbody>
              {daemonSets.map((ds) => {
                const isHealthy =
                  ds.status.numberReady === ds.status.desiredNumberScheduled &&
                  (ds.status.desiredNumberScheduled ?? 0) > 0;
                const nodeSelector = ds.spec.template.spec.nodeSelector
                  ? Object.entries(ds.spec.template.spec.nodeSelector)
                      .map(([k, v]) => `${k}=${v}`)
                      .join(', ')
                  : '-';
                return (
                  <tr key={ds.metadata.uid}>
                    <td>
                      <Link
                        to={`/workloads/daemonsets/${ds.metadata.namespace}/${ds.metadata.name}`}
                        className="text-blue-400 hover:text-blue-300 font-medium"
                      >
                        {ds.metadata.name}
                      </Link>
                    </td>
                    {currentNamespace === 'all' && (
                      <td>
                        <span className="badge badge-default">{ds.metadata.namespace}</span>
                      </td>
                    )}
                    <td>
                      <span className={clsx('badge', isHealthy ? 'badge-success' : 'badge-warning')}>
                        {isHealthy ? 'Healthy' : 'Progressing'}
                      </span>
                    </td>
                    <td>{ds.status.desiredNumberScheduled ?? 0}</td>
                    <td>{ds.status.numberReady ?? 0}</td>
                    <td>{ds.status.numberAvailable ?? 0}</td>
                    <td className="text-slate-400 max-w-xs truncate" title={nodeSelector}>
                      {nodeSelector}
                    </td>
                    <td className="text-slate-400">
                      {formatDistanceToNow(new Date(ds.metadata.creationTimestamp), {
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
        {daemonSets.length === 0 && (
          <div className="text-center py-12 text-slate-400">没有找到 DaemonSet</div>
        )}
      </div>
    </div>
  );
}
