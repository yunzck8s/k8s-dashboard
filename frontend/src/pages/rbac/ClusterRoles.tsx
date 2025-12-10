import { useQuery } from '@tanstack/react-query';
import { clusterRoleApi } from '../../api';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import type { ClusterRole } from '../../types';

export default function ClusterRoles() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['clusterroles'],
    queryFn: () => clusterRoleApi.list(),
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

  const clusterRoles = data?.items ?? [];

  // 获取规则数量
  const getRulesCount = (role: ClusterRole) => {
    return role.rules?.length ?? 0;
  };

  // 格式化规则摘要
  const getRulesSummary = (role: ClusterRole) => {
    const rules = role.rules ?? [];
    if (rules.length === 0) return '-';
    const verbs = new Set<string>();
    rules.forEach((r) => r.verbs?.forEach((v) => verbs.add(v)));
    return Array.from(verbs).slice(0, 4).join(', ') + (verbs.size > 4 ? '...' : '');
  };

  // 检查是否是系统角色
  const isSystemRole = (role: ClusterRole) => {
    return role.metadata.name.startsWith('system:') ||
           role.metadata.labels?.['kubernetes.io/bootstrapping'] === 'rbac-defaults';
  };

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">ClusterRoles</h1>
          <p className="text-slate-400 mt-1">
            共 {clusterRoles.length} 个 ClusterRole
          </p>
        </div>
        <button onClick={() => refetch()} className="btn btn-secondary">
          刷新
        </button>
      </div>

      {/* ClusterRole 列表 */}
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
              {clusterRoles.map((role) => (
                <tr key={role.metadata.uid}>
                  <td>
                    <span className="text-blue-400 font-medium">
                      {role.metadata.name}
                    </span>
                    {isSystemRole(role) && (
                      <span className="ml-2 badge badge-info text-xs">系统</span>
                    )}
                  </td>
                  <td className="text-slate-400">{getRulesCount(role)} 条</td>
                  <td className="text-slate-400 max-w-xs truncate">
                    {getRulesSummary(role)}
                  </td>
                  <td className="text-slate-400">
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
        {clusterRoles.length === 0 && (
          <div className="text-center py-12 text-slate-400">没有找到 ClusterRole</div>
        )}
      </div>
    </div>
  );
}
