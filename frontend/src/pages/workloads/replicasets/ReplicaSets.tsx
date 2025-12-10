import { useQuery } from '@tanstack/react-query';
import { replicaSetApi } from '../../../api';
import { useAppStore } from '../../../store';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import clsx from 'clsx';
import type { ReplicaSet } from '../../../types';

export default function ReplicaSets() {
  const { currentNamespace } = useAppStore();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['replicasets', currentNamespace],
    queryFn: () =>
      currentNamespace === 'all'
        ? replicaSetApi.listAll()
        : replicaSetApi.list(currentNamespace),
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

  const replicaSets = data?.items ?? [];

  // 获取所有者信息
  const getOwner = (rs: ReplicaSet) => {
    const owners = rs.metadata.ownerReferences;
    if (!owners || owners.length === 0) return '-';
    const owner = owners[0];
    return `${owner.kind}/${owner.name}`;
  };

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">ReplicaSets</h1>
          <p className="text-slate-400 mt-1">
            共 {replicaSets.length} 个 ReplicaSet
            {currentNamespace !== 'all' && ` 在 ${currentNamespace} 命名空间`}
          </p>
        </div>
        <button onClick={() => refetch()} className="btn btn-secondary">
          刷新
        </button>
      </div>

      {/* ReplicaSet 列表 */}
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
                <th>所有者</th>
                <th>创建时间</th>
              </tr>
            </thead>
            <tbody>
              {replicaSets.map((rs) => {
                const desired = rs.spec.replicas ?? 0;
                const ready = rs.status.readyReplicas ?? 0;
                const available = rs.status.availableReplicas ?? 0;
                const isHealthy = ready === desired && desired > 0;
                return (
                  <tr key={rs.metadata.uid}>
                    <td>
                      <span className="text-blue-400 font-medium">
                        {rs.metadata.name}
                      </span>
                    </td>
                    {currentNamespace === 'all' && (
                      <td>
                        <span className="badge badge-default">{rs.metadata.namespace}</span>
                      </td>
                    )}
                    <td>
                      <span className={clsx('badge', isHealthy ? 'badge-success' : 'badge-warning')}>
                        {isHealthy ? 'Healthy' : 'Progressing'}
                      </span>
                    </td>
                    <td>{desired}</td>
                    <td>{ready}</td>
                    <td>{available}</td>
                    <td className="text-slate-400">{getOwner(rs)}</td>
                    <td className="text-slate-400">
                      {formatDistanceToNow(new Date(rs.metadata.creationTimestamp), {
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
        {replicaSets.length === 0 && (
          <div className="text-center py-12 text-slate-400">没有找到 ReplicaSet</div>
        )}
      </div>
    </div>
  );
}
