import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { namespaceApi } from '../../api';
import { usePollingInterval } from '../../utils/polling';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import clsx from 'clsx';
import type { Namespace } from '../../types';

export default function Namespaces() {
  const pollingInterval = usePollingInterval('standard');
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['namespaces'],
    queryFn: () => namespaceApi.list(),
    refetchInterval: pollingInterval,
  });

  // 删除命名空间
  const deleteMutation = useMutation({
    mutationFn: (name: string) => namespaceApi.delete(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['namespaces'] });
    },
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

  const namespaces = data?.items ?? [];

  // 获取命名空间状态颜色
  const getStatusColor = (phase?: string) => {
    switch (phase) {
      case 'Active':
        return 'badge-success';
      case 'Terminating':
        return 'badge-warning';
      default:
        return 'badge-default';
    }
  };

  // 检查是否是系统命名空间
  const isSystemNamespace = (ns: Namespace) => {
    const systemNs = ['kube-system', 'kube-public', 'kube-node-lease', 'default'];
    return systemNs.includes(ns.metadata.name);
  };

  // 处理删除
  const handleDelete = (ns: Namespace) => {
    if (isSystemNamespace(ns)) {
      alert('不能删除系统命名空间');
      return;
    }
    if (confirm(`确定要删除命名空间 "${ns.metadata.name}" 吗？此操作不可恢复！`)) {
      deleteMutation.mutate(ns.metadata.name);
    }
  };

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">命名空间</h1>
          <p className="text-text-muted mt-1">
            共 {namespaces.length} 个命名空间
          </p>
        </div>
        <button onClick={() => refetch()} className="btn btn-secondary">
          刷新
        </button>
      </div>

      {/* 命名空间列表 */}
      <div className="card overflow-hidden">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>名称</th>
                <th>状态</th>
                <th>标签</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {namespaces.map((ns) => {
                const labels = ns.metadata.labels
                  ? Object.entries(ns.metadata.labels)
                      .slice(0, 3)
                      .map(([k, v]) => `${k}=${v}`)
                      .join(', ')
                  : '-';
                const labelCount = ns.metadata.labels
                  ? Object.keys(ns.metadata.labels).length
                  : 0;
                return (
                  <tr key={ns.metadata.uid}>
                    <td>
                      <Link
                        to={`/namespaces/${ns.metadata.name}`}
                        className="text-blue-400 hover:text-blue-300 font-medium"
                      >
                        {ns.metadata.name}
                        {isSystemNamespace(ns) && (
                          <span className="ml-2 badge badge-info text-xs">系统</span>
                        )}
                      </Link>
                    </td>
                    <td>
                      <span className={clsx('badge', getStatusColor(ns.status?.phase))}>
                        {ns.status?.phase || 'Unknown'}
                      </span>
                    </td>
                    <td className="text-text-muted max-w-xs truncate" title={labels}>
                      {labels}
                      {labelCount > 3 && (
                        <span className="text-text-muted ml-1">
                          (+{labelCount - 3})
                        </span>
                      )}
                    </td>
                    <td className="text-text-muted">
                      {formatDistanceToNow(new Date(ns.metadata.creationTimestamp), {
                        addSuffix: true,
                        locale: zhCN,
                      })}
                    </td>
                    <td>
                      {!isSystemNamespace(ns) && ns.status?.phase !== 'Terminating' && (
                        <button
                          onClick={() => handleDelete(ns)}
                          disabled={deleteMutation.isPending}
                          className="btn btn-sm btn-error"
                        >
                          删除
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {namespaces.length === 0 && (
          <div className="text-center py-12 text-text-muted">没有找到命名空间</div>
        )}
      </div>
    </div>
  );
}
