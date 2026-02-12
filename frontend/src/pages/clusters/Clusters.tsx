import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clusterApi } from '../../api';
import { useAppStore } from '../../store';
import { usePollingInterval } from '../../utils/polling';
import { queryKeys } from '../../api/queryKeys';
import { createVisibilityRefetchInterval, invalidateClusterScopedQueries } from '../../api/queryPolicy';
import type { ClusterInfo } from '../../types';

function statusColor(status: ClusterInfo['status']): string {
  if (status === 'connected') return 'var(--color-success)';
  if (status === 'error') return 'var(--color-error)';
  return 'var(--color-warning)';
}

function formatDateTime(value?: string): string {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('zh-CN');
}

export default function Clusters() {
  const queryClient = useQueryClient();
  const pollingInterval = usePollingInterval('standard');
  const refetchInterval = createVisibilityRefetchInterval(pollingInterval);
  const { currentCluster, setCurrentCluster, clearClusterError } = useAppStore();
  const [name, setName] = useState('');
  const [kubeconfig, setKubeconfig] = useState('');
  const [message, setMessage] = useState<string>('');
  const [testResult, setTestResult] = useState<ClusterInfo | null>(null);

  const { data: clusters = [], isLoading } = useQuery({
    queryKey: queryKeys.clusters,
    queryFn: () => clusterApi.list(),
    refetchInterval,
  });

  const defaultCluster = useMemo(
    () => clusters.find((cluster) => cluster.isDefault)?.name || 'default',
    [clusters]
  );

  const testMutation = useMutation({
    mutationFn: () => clusterApi.test(kubeconfig),
    onSuccess: (result) => {
      setMessage(result.message || '连通性测试成功');
      setTestResult(result.cluster ?? null);
    },
    onError: (error) => {
      setMessage((error as Error).message || '连通性测试失败');
      setTestResult(null);
    },
  });

  const addMutation = useMutation({
    mutationFn: () => clusterApi.add({ name: name.trim(), kubeconfig }),
    onSuccess: async () => {
      setMessage('集群已添加');
      setName('');
      setKubeconfig('');
      setTestResult(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.clusters });
    },
    onError: (error) => {
      setMessage((error as Error).message || '添加失败');
    },
  });

  const switchMutation = useMutation({
    mutationFn: async (clusterName: string) => clusterApi.switch(clusterName),
    onSuccess: async (cluster) => {
      setCurrentCluster(cluster.name);
      clearClusterError();
      setMessage(`已切换到集群 ${cluster.name}`);
      await invalidateClusterScopedQueries(queryClient);
    },
    onError: (error) => {
      setMessage((error as Error).message || '切换失败');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (clusterName: string) => clusterApi.delete(clusterName),
    onSuccess: async (_, clusterName) => {
      if (currentCluster === clusterName) {
        setCurrentCluster(defaultCluster);
      }
      setMessage(`集群 ${clusterName} 已删除`);
      await queryClient.invalidateQueries({ queryKey: queryKeys.clusters });
      await invalidateClusterScopedQueries(queryClient);
    },
    onError: (error) => {
      setMessage((error as Error).message || '删除失败');
    },
  });

  const submitAddCluster = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage('');
    if (!name.trim()) {
      setMessage('请输入集群名称');
      return;
    }
    if (!kubeconfig.trim()) {
      setMessage('请输入 kubeconfig 内容');
      return;
    }
    await addMutation.mutateAsync();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">
          集群管理
        </h1>
        <p className="mt-1 text-[var(--color-text-secondary)]">
          管理多集群连接、连通性检测和请求级切换
        </p>
      </div>

      {message && (
        <div
          className="rounded-lg px-4 py-3 text-sm"
          style={{
            background: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-primary)',
          }}
        >
          {message}
        </div>
      )}

      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-[var(--color-text-primary)]">
            集群列表
          </h2>
          <span className="text-sm text-[var(--color-text-muted)]">
            当前集群：{currentCluster || defaultCluster}
          </span>
        </div>

        {isLoading ? (
          <div className="py-8 text-center text-[var(--color-text-muted)]">
            正在加载集群列表...
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>名称</th>
                  <th>状态</th>
                  <th>来源</th>
                  <th>版本</th>
                  <th>节点 / Pod</th>
                  <th>最后检测</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {clusters.map((cluster) => (
                  <tr key={cluster.name}>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="text-[var(--color-text-primary)]">{cluster.name}</span>
                        {cluster.isDefault && <span className="badge badge-info">default</span>}
                      </div>
                      {cluster.lastError && (
                        <div className="text-xs mt-1 text-[var(--color-error)]">
                          {cluster.lastError}
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block w-2 h-2 rounded-full"
                          style={{ background: statusColor(cluster.status) }}
                        />
                        <span className="text-[var(--color-text-secondary)]">{cluster.status}</span>
                      </div>
                    </td>
                    <td>{cluster.source}</td>
                    <td>{cluster.version || '-'}</td>
                    <td>{cluster.nodeCount} / {cluster.podCount}</td>
                    <td>{formatDateTime(cluster.lastChecked)}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => switchMutation.mutate(cluster.name)}
                          disabled={switchMutation.isPending || currentCluster === cluster.name}
                        >
                          切换
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => {
                            if (window.confirm(`确认删除集群 ${cluster.name} 吗？`)) {
                              deleteMutation.mutate(cluster.name);
                            }
                          }}
                          disabled={cluster.isDefault || cluster.name === 'default' || deleteMutation.isPending}
                          title={cluster.isDefault ? '默认集群不可删除' : undefined}
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {clusters.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-[var(--color-text-muted)]">
                      暂无集群记录
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card p-5">
        <h2 className="text-lg font-medium mb-4 text-[var(--color-text-primary)]">
          添加集群（kubeconfig）
        </h2>
        <form className="space-y-4" onSubmit={submitAddCluster}>
          <div>
            <label className="block text-sm mb-1 text-[var(--color-text-secondary)]">
              集群名称
            </label>
            <input
              className="input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="例如：prod-cluster"
            />
          </div>
          <div>
            <label className="block text-sm mb-1 text-[var(--color-text-secondary)]">
              kubeconfig
            </label>
            <textarea
              className="input min-h-[220px]"
              value={kubeconfig}
              onChange={(event) => setKubeconfig(event.target.value)}
              placeholder="粘贴 kubeconfig 内容"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={testMutation.isPending || !kubeconfig.trim()}
              onClick={() => {
                setMessage('');
                testMutation.mutate();
              }}
            >
              {testMutation.isPending ? '测试中...' : '连通性测试'}
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={addMutation.isPending || !name.trim() || !kubeconfig.trim()}
            >
              {addMutation.isPending ? '添加中...' : '添加集群'}
            </button>
          </div>
        </form>

        {testResult && (
          <div
            className="mt-4 rounded-lg px-4 py-3 text-sm"
            style={{
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: 'var(--color-text-primary)',
            }}
          >
            测试成功：endpoint={testResult.endpoint || '-'}，version={testResult.version || '-'}，nodes=
            {testResult.nodeCount}，pods={testResult.podCount}
          </div>
        )}
      </div>
    </div>
  );
}
