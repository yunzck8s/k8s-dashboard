import { useQuery } from '@tanstack/react-query';
import { roleBindingApi } from '../../api';
import { useAppStore } from '../../store';
import { usePollingInterval } from '../../utils/polling';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import type { RoleBinding } from '../../types';

export default function RoleBindings() {
  const { currentNamespace } = useAppStore();
  const pollingInterval = usePollingInterval('standard');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['rolebindings', currentNamespace],
    queryFn: () => roleBindingApi.list(currentNamespace === 'all' ? 'default' : currentNamespace),
    refetchInterval: pollingInterval,
    enabled: currentNamespace !== 'all',
  });

  if (currentNamespace === 'all') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">RoleBindings</h1>
          <p className="text-slate-400 mt-1">请选择一个命名空间来查看 RoleBindings</p>
        </div>
        <div className="card p-12 text-center">
          <p className="text-slate-500">RoleBindings 是命名空间级别的资源，请从侧边栏选择一个具体的命名空间</p>
        </div>
      </div>
    );
  }

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

  const roleBindings = data?.items ?? [];

  // 格式化 Subject
  const formatSubjects = (rb: RoleBinding) => {
    const subjects = rb.subjects ?? [];
    if (subjects.length === 0) return '-';
    return subjects.map((s) => `${s.kind}/${s.name}`).slice(0, 2).join(', ') +
           (subjects.length > 2 ? `... (+${subjects.length - 2})` : '');
  };

  // 格式化 RoleRef
  const formatRoleRef = (rb: RoleBinding) => {
    return `${rb.roleRef.kind}/${rb.roleRef.name}`;
  };

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">RoleBindings</h1>
          <p className="text-slate-400 mt-1">
            共 {roleBindings.length} 个 RoleBinding 在 {currentNamespace} 命名空间
          </p>
        </div>
        <button onClick={() => refetch()} className="btn btn-secondary">
          刷新
        </button>
      </div>

      {/* RoleBinding 列表 */}
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
              {roleBindings.map((rb) => (
                <tr key={rb.metadata.uid}>
                  <td className="text-blue-400 font-medium">
                    {rb.metadata.name}
                  </td>
                  <td className="text-slate-300">{formatRoleRef(rb)}</td>
                  <td className="text-slate-400 max-w-xs truncate">
                    {formatSubjects(rb)}
                  </td>
                  <td className="text-slate-400">
                    {formatDistanceToNow(new Date(rb.metadata.creationTimestamp), {
                      addSuffix: true,
                      locale: zhCN,
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {roleBindings.length === 0 && (
          <div className="text-center py-12 text-slate-400">没有找到 RoleBinding</div>
        )}
      </div>
    </div>
  );
}
