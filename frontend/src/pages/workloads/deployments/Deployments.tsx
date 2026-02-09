import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { deploymentApi } from '../../../api';
import { useAppStore } from '../../../store';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import clsx from 'clsx';
import Pagination from '../../../components/common/Pagination';

export default function Deployments() {
  const { currentNamespace } = useAppStore();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // 命名空间变化时重置页码
  useEffect(() => {
    setCurrentPage(1);
  }, [currentNamespace]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['deployments', currentNamespace],
    queryFn: () =>
      currentNamespace === 'all'
        ? deploymentApi.listAll()
        : deploymentApi.list(currentNamespace),
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div
          className="animate-spin rounded-full h-8 w-8 border-b-2"
          style={{ borderColor: 'var(--color-primary)' }}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="p-6 text-center rounded-xl"
        style={{
          background: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
        }}
      >
        <p style={{ color: '#F87171' }}>加载失败：{(error as Error).message}</p>
        <button onClick={() => refetch()} className="btn btn-primary mt-4">
          重试
        </button>
      </div>
    );
  }

  const deployments = data?.items ?? [];

  // 分页逻辑
  const totalItems = deployments.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const currentDeployments = deployments.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Deployments
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            共 <span style={{ color: 'var(--color-primary)' }}>{deployments.length}</span> 个 Deployment
            {currentNamespace !== 'all' && (
              <>
                {' '}在 <span style={{ color: 'var(--color-primary)' }}>{currentNamespace}</span> 命名空间
              </>
            )}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="btn btn-secondary flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          刷新
        </button>
      </div>

      {/* Deployment 列表 */}
      <div
        className="overflow-hidden rounded-xl"
        style={{
          background: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
        }}
      >
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>名称</th>
                {currentNamespace === 'all' && <th>命名空间</th>}
                <th>状态</th>
                <th>就绪</th>
                <th>最新</th>
                <th>可用</th>
                <th>镜像</th>
                <th>创建时间</th>
              </tr>
            </thead>
            <tbody>
              {currentDeployments.map((deployment) => {
                const isHealthy =
                  deployment.status.readyReplicas === deployment.status.replicas &&
                  (deployment.status.replicas ?? 0) > 0;
                const images = deployment.spec.template.spec.containers
                  .map((c) => c.image.split('/').pop()?.split(':')[0] || c.image)
                  .join(', ');
                return (
                  <tr key={deployment.metadata.uid}>
                    <td>
                      <Link
                        to={`/workloads/deployments/${deployment.metadata.namespace}/${deployment.metadata.name}`}
                        className="font-medium transition-colors"
                        style={{ color: 'var(--color-primary)' }}
                      >
                        {deployment.metadata.name}
                      </Link>
                    </td>
                    {currentNamespace === 'all' && (
                      <td>
                        <span className="badge badge-default">
                          {deployment.metadata.namespace}
                        </span>
                      </td>
                    )}
                    <td>
                      <span
                        className={clsx('badge', isHealthy ? 'badge-success' : 'badge-warning')}
                      >
                        {isHealthy ? 'Healthy' : 'Progressing'}
                      </span>
                    </td>
                    <td>
                      {deployment.status.readyReplicas ?? 0}/{deployment.status.replicas ?? 0}
                    </td>
                    <td>{deployment.status.updatedReplicas ?? 0}</td>
                    <td>{deployment.status.availableReplicas ?? 0}</td>
                    <td className="max-w-xs truncate" style={{ color: 'var(--color-text-muted)' }} title={images}>
                      {images}
                    </td>
                    <td style={{ color: 'var(--color-text-muted)' }}>
                      {formatDistanceToNow(new Date(deployment.metadata.creationTimestamp), {
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
        {deployments.length === 0 && (
          <div className="text-center py-12" style={{ color: 'var(--color-text-muted)' }}>没有找到 Deployment</div>
        )}
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      )}
    </div>
  );
}
