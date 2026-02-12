import { useQuery } from '@tanstack/react-query';
import { serviceAccountApi } from '../../api';
import { useAppStore } from '../../store';
import { usePollingInterval } from '../../utils/polling';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import type { ServiceAccount } from '../../types';

export default function ServiceAccounts() {
  const { currentNamespace } = useAppStore();
  const pollingInterval = usePollingInterval('standard');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['serviceaccounts', currentNamespace],
    queryFn: () =>
      currentNamespace === 'all'
        ? serviceAccountApi.listAll()
        : serviceAccountApi.list(currentNamespace),
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

  const serviceAccounts = data?.items ?? [];

  // 获取 Secrets 数量
  const getSecretsCount = (sa: ServiceAccount) => {
    return sa.secrets?.length ?? 0;
  };

  // 获取 ImagePullSecrets 数量
  const getImagePullSecretsCount = (sa: ServiceAccount) => {
    return sa.imagePullSecrets?.length ?? 0;
  };

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">ServiceAccounts</h1>
          <p className="text-text-muted mt-1">
            共 {serviceAccounts.length} 个 ServiceAccount
            {currentNamespace !== 'all' && ` 在 ${currentNamespace} 命名空间`}
          </p>
        </div>
        <button onClick={() => refetch()} className="btn btn-secondary">
          刷新
        </button>
      </div>

      {/* ServiceAccount 列表 */}
      <div className="card overflow-hidden">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>名称</th>
                {currentNamespace === 'all' && <th>命名空间</th>}
                <th>Secrets</th>
                <th>ImagePullSecrets</th>
                <th>创建时间</th>
              </tr>
            </thead>
            <tbody>
              {serviceAccounts.map((sa) => (
                <tr key={sa.metadata.uid}>
                  <td className="text-blue-400 font-medium">
                    {sa.metadata.name}
                    {sa.metadata.name === 'default' && (
                      <span className="ml-2 badge badge-info text-xs">默认</span>
                    )}
                  </td>
                  {currentNamespace === 'all' && (
                    <td>
                      <span className="badge badge-default">{sa.metadata.namespace}</span>
                    </td>
                  )}
                  <td className="text-text-muted">
                    {getSecretsCount(sa)} 个
                    {sa.secrets && sa.secrets.length > 0 && (
                      <span className="text-text-muted text-sm ml-1">
                        ({sa.secrets.map((s) => s.name).join(', ')})
                      </span>
                    )}
                  </td>
                  <td className="text-text-muted">
                    {getImagePullSecretsCount(sa)} 个
                  </td>
                  <td className="text-text-muted">
                    {formatDistanceToNow(new Date(sa.metadata.creationTimestamp), {
                      addSuffix: true,
                      locale: zhCN,
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {serviceAccounts.length === 0 && (
          <div className="text-center py-12 text-text-muted">没有找到 ServiceAccount</div>
        )}
      </div>
    </div>
  );
}
