import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { serviceApi } from '../../../api';
import { useAppStore } from '../../../store';
import { usePollingInterval } from '../../../utils/polling';
import { useNamespacePagination } from '../../../hooks/useNamespacePagination';
import { queryKeys } from '../../../api/queryKeys';
import { createVisibilityRefetchInterval } from '../../../api/queryPolicy';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import clsx from 'clsx';
import type { Service, ServiceInput } from '../../../types';
import Pagination from '../../../components/common/Pagination';
import ServiceForm from '../../../components/network/ServiceForm';
import { PlusIcon } from '@heroicons/react/24/outline';

export default function Services() {
  const { currentNamespace } = useAppStore();
  const pollingInterval = usePollingInterval('standard');
  const refetchInterval = createVisibilityRefetchInterval(pollingInterval);
  const { currentPage, pageSize, setCurrentPage, setPageSize } = useNamespacePagination(currentNamespace);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.services(currentNamespace),
    queryFn: () =>
      currentNamespace === 'all'
        ? serviceApi.listAll()
        : serviceApi.list(currentNamespace),
    refetchInterval,
  });

  // 创建 Service
  const createMutation = useMutation({
    mutationFn: (service: ServiceInput) => serviceApi.create(currentNamespace, service),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      setShowCreateModal(false);
    },
    onError: (error: Error) => {
      alert(`创建失败: ${error.message}`);
    },
  });

  const services = useMemo(() => data?.items ?? [], [data?.items]);
  const totalItems = services.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const currentServices = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return services.slice(startIndex, endIndex);
  }, [currentPage, pageSize, services]);

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

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  // 获取服务类型颜色
  const getTypeColor = (type?: string) => {
    switch (type) {
      case 'LoadBalancer':
        return 'badge-info';
      case 'NodePort':
        return 'badge-warning';
      case 'ClusterIP':
        return 'badge-success';
      case 'ExternalName':
        return 'badge-purple';
      default:
        return 'badge-default';
    }
  };

  // 格式化端口
  const formatPorts = (service: Service) => {
    return (
      service.spec.ports?.map((p) => {
        let portStr = `${p.port}`;
        if (p.nodePort) portStr += `:${p.nodePort}`;
        portStr += `/${p.protocol || 'TCP'}`;
        return portStr;
      }).join(', ') || '-'
    );
  };

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>Services</h1>
          <p className="mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            共 {services.length} 个 Service
            {currentNamespace !== 'all' && ` 在 ${currentNamespace} 命名空间`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* 创建按钮 */}
          {currentNamespace !== 'all' && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary flex items-center gap-2"
            >
              <PlusIcon className="w-5 h-5" />
              创建 Service
            </button>
          )}
          <button onClick={() => refetch()} className="btn btn-secondary">
            刷新
          </button>
        </div>
      </div>

      {/* Service 列表 */}
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
                <th>类型</th>
                <th>Cluster IP</th>
                <th>External IP</th>
                <th>端口</th>
                <th>创建时间</th>
              </tr>
            </thead>
            <tbody>
              {currentServices.map((service) => {
                const externalIPs = service.status?.loadBalancer?.ingress
                  ?.map((i) => i.ip || i.hostname)
                  .join(', ') || service.spec.externalIPs?.join(', ') || '-';
                return (
                  <tr key={service.metadata.uid}>
                    <td>
                      <Link
                        to={`/network/services/${service.metadata.namespace}/${service.metadata.name}`}
                        className="font-medium transition-colors"
                        style={{ color: 'var(--color-primary)' }}
                      >
                        {service.metadata.name}
                      </Link>
                    </td>
                    {currentNamespace === 'all' && (
                      <td>
                        <span className="badge badge-default">
                          {service.metadata.namespace}
                        </span>
                      </td>
                    )}
                    <td>
                      <span className={clsx('badge', getTypeColor(service.spec.type))}>
                        {service.spec.type || 'ClusterIP'}
                      </span>
                    </td>
                    <td className="font-mono text-sm" style={{ color: 'var(--color-text-muted)' }}>
                      {service.spec.clusterIP || '-'}
                    </td>
                    <td className="font-mono text-sm" style={{ color: 'var(--color-text-muted)' }}>{externalIPs}</td>
                    <td style={{ color: 'var(--color-text-muted)' }}>{formatPorts(service)}</td>
                    <td style={{ color: 'var(--color-text-muted)' }}>
                      {formatDistanceToNow(new Date(service.metadata.creationTimestamp), {
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
        {services.length === 0 && (
          <div className="text-center py-12" style={{ color: 'var(--color-text-muted)' }}>没有找到 Service</div>
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

      {/* 创建 Service 表单 */}
      <ServiceForm
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={async (service) => {
          await createMutation.mutateAsync(service);
        }}
        namespace={currentNamespace}
        isPending={createMutation.isPending}
      />
    </div>
  );
}
