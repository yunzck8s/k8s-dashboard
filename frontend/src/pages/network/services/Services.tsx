import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { serviceApi } from '../../../api';
import { useAppStore } from '../../../store';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import clsx from 'clsx';
import type { Service } from '../../../types';
import Pagination from '../../../components/common/Pagination';

export default function Services() {
  const { currentNamespace } = useAppStore();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // 命名空间变化时重置页码
  useEffect(() => {
    setCurrentPage(1);
  }, [currentNamespace]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['services', currentNamespace],
    queryFn: () =>
      currentNamespace === 'all'
        ? serviceApi.listAll()
        : serviceApi.list(currentNamespace),
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

  const services = data?.items ?? [];

  // 分页逻辑
  const totalItems = services.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const currentServices = services.slice(startIndex, endIndex);

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
          <h1 className="text-2xl font-bold text-white">Services</h1>
          <p className="text-slate-400 mt-1">
            共 {services.length} 个 Service
            {currentNamespace !== 'all' && ` 在 ${currentNamespace} 命名空间`}
          </p>
        </div>
        <button onClick={() => refetch()} className="btn btn-secondary">
          刷新
        </button>
      </div>

      {/* Service 列表 */}
      <div className="card overflow-hidden">
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
                        className="text-blue-400 hover:text-blue-300 font-medium"
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
                    <td className="text-slate-400 font-mono text-sm">
                      {service.spec.clusterIP || '-'}
                    </td>
                    <td className="text-slate-400 font-mono text-sm">{externalIPs}</td>
                    <td className="text-slate-400">{formatPorts(service)}</td>
                    <td className="text-slate-400">
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
          <div className="text-center py-12 text-slate-400">没有找到 Service</div>
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
