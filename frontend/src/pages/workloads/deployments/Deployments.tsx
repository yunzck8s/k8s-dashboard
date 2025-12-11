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
          <h1 className="text-2xl font-bold text-white">Deployments</h1>
          <p className="text-slate-400 mt-1">
            共 {deployments.length} 个 Deployment
            {currentNamespace !== 'all' && ` 在 ${currentNamespace} 命名空间`}
          </p>
        </div>
        <button onClick={() => refetch()} className="btn btn-secondary">
          刷新
        </button>
      </div>

      {/* Deployment 列表 */}
      <div className="card overflow-hidden">
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
                        className="text-blue-400 hover:text-blue-300 font-medium"
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
                    <td className="text-slate-400 max-w-xs truncate" title={images}>
                      {images}
                    </td>
                    <td className="text-slate-400">
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
          <div className="text-center py-12 text-slate-400">没有找到 Deployment</div>
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
