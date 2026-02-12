import { useQuery } from '@tanstack/react-query';
import { clusterRoleBindingApi } from '../../api';
import { usePollingInterval } from '../../utils/polling';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import type { ClusterRoleBinding } from '../../types';

export default function ClusterRoleBindings() {
  const pollingInterval = usePollingInterval('standard');
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['clusterrolebindings'],
    queryFn: () => clusterRoleBindingApi.list(),
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

  const clusterRoleBindings = data?.items ?? [];

  // 格式化 Subject
  const formatSubjects = (crb: ClusterRoleBinding) => {
    const subjects = crb.subjects ?? [];
    if (subjects.length === 0) return '-';
    return subjects.map((s) => {
      if (s.namespace) {
        return `${s.kind}/${s.namespace}/${s.name}`;
      }
      return `${s.kind}/${s.name}`;
    }).slice(0, 2).join(', ') + (subjects.length > 2 ? `... (+${subjects.length - 2})` : '');
  };

  // 格式化 RoleRef
  const formatRoleRef = (crb: ClusterRoleBinding) => {
    return `${crb.roleRef.kind}/${crb.roleRef.name}`;
  };

  // 检查是否是系统绑定
  const isSystemBinding = (crb: ClusterRoleBinding) => {
    return crb.metadata.name.startsWith('system:') ||
           crb.metadata.labels?.['kubernetes.io/bootstrapping'] === 'rbac-defaults';
  };

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">ClusterRoleBindings</h1>
          <p className="text-slate-400 mt-1">
            共 {clusterRoleBindings.length} 个 ClusterRoleBinding
          </p>
        </div>
        <button onClick={() => refetch()} className="btn btn-secondary">
          刷新
        </button>
      </div>

      {/* ClusterRoleBinding 列表 */}
      <div className="card overflow-hidden">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>名称</th>
                <th>角色引用</th>
                <th>主体</th>
                <th>创建时间</th>
              </tr>
            </thead>
            <tbody>
              {clusterRoleBindings.map((crb) => (
                <tr key={crb.metadata.uid}>
                  <td>
                    <span className="text-blue-400 font-medium">
                      {crb.metadata.name}
                    </span>
                    {isSystemBinding(crb) && (
                      <span className="ml-2 badge badge-info text-xs">系统</span>
                    )}
                  </td>
                  <td className="text-slate-300">{formatRoleRef(crb)}</td>
                  <td className="text-slate-400 max-w-xs truncate">
                    {formatSubjects(crb)}
                  </td>
                  <td className="text-slate-400">
                    {formatDistanceToNow(new Date(crb.metadata.creationTimestamp), {
                      addSuffix: true,
                      locale: zhCN,
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {clusterRoleBindings.length === 0 && (
          <div className="text-center py-12 text-slate-400">没有找到 ClusterRoleBinding</div>
        )}
      </div>
    </div>
  );
}
