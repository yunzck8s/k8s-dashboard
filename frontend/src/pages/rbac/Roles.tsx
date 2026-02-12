import { useQuery } from '@tanstack/react-query';
import { roleApi } from '../../api';
import { useAppStore } from '../../store';
import { usePollingInterval } from '../../utils/polling';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import type { Role } from '../../types';

export default function Roles() {
  const { currentNamespace } = useAppStore();
  const pollingInterval = usePollingInterval('standard');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['roles', currentNamespace],
    queryFn: () => roleApi.list(currentNamespace === 'all' ? 'default' : currentNamespace),
    refetchInterval: pollingInterval,
    enabled: currentNamespace !== 'all',
  });

  if (currentNamespace === 'all') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Roles</h1>
          <p className="text-text-muted mt-1">请选择一个命名空间来查看 Roles</p>
        </div>
        <div className="card p-12 text-center">
          <p className="text-text-muted">Roles 是命名空间级别的资源，请从侧边栏选择一个具体的命名空间</p>
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

  const roles = data?.items ?? [];

  // 获取规则数量
  const getRulesCount = (role: Role) => {
    return role.rules?.length ?? 0;
  };

  // 格式化规则摘要
  const getRulesSummary = (role: Role) => {
    const rules = role.rules ?? [];
    if (rules.length === 0) return '-';
    const verbs = new Set<string>();
    rules.forEach((r) => r.verbs?.forEach((v) => verbs.add(v)));
    return Array.from(verbs).slice(0, 4).join(', ') + (verbs.size > 4 ? '...' : '');
  };

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Roles</h1>
          <p className="text-text-muted mt-1">
            共 {roles.length} 个 Role 在 {currentNamespace} 命名空间
          </p>
        </div>
        <button onClick={() => refetch()} className="btn btn-secondary">
          刷新
        </button>
      </div>

      {/* Role 列表 */}
      <div className="card overflow-hidden">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>名称</th>
                <th>规则数量</th>
                <th>权限动词</th>
                <th>创建时间</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr key={role.metadata.uid}>
                  <td className="text-blue-400 font-medium">
                    {role.metadata.name}
                  </td>
                  <td className="text-text-muted">{getRulesCount(role)} 条</td>
                  <td className="text-text-muted max-w-xs truncate">
                    {getRulesSummary(role)}
                  </td>
                  <td className="text-text-muted">
                    {formatDistanceToNow(new Date(role.metadata.creationTimestamp), {
                      addSuffix: true,
                      locale: zhCN,
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {roles.length === 0 && (
          <div className="text-center py-12 text-text-muted">没有找到 Role</div>
        )}
      </div>
    </div>
  );
}
