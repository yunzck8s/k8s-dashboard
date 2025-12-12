import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { secretApi } from '../../../api';
import { useAppStore } from '../../../store';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import clsx from 'clsx';
import Pagination from '../../../components/common/Pagination';
import SecretForm from '../../../components/config/SecretForm';
import { PlusIcon } from '@heroicons/react/24/outline';

export default function Secrets() {
  const { currentNamespace } = useAppStore();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const queryClient = useQueryClient();

  // 命名空间变化时重置页码
  useEffect(() => {
    setCurrentPage(1);
  }, [currentNamespace]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['secrets', currentNamespace],
    queryFn: () =>
      currentNamespace === 'all'
        ? secretApi.listAll()
        : secretApi.list(currentNamespace),
    refetchInterval: 30000,
  });

  // 创建 Secret
  const createMutation = useMutation({
    mutationFn: (secret: any) => secretApi.create(currentNamespace, secret),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['secrets'] });
      setShowCreateModal(false);
    },
    onError: (error: Error) => {
      alert(`创建失败: ${error.message}`);
    },
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

  const secrets = data?.items ?? [];

  // 分页逻辑
  const totalItems = secrets.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const currentSecrets = secrets.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  // 获取类型颜色
  const getTypeColor = (type?: string) => {
    switch (type) {
      case 'kubernetes.io/service-account-token':
        return 'badge-info';
      case 'kubernetes.io/dockerconfigjson':
        return 'badge-purple';
      case 'kubernetes.io/tls':
        return 'badge-success';
      case 'Opaque':
        return 'badge-default';
      default:
        return 'badge-warning';
    }
  };

  // 格式化类型名称
  const formatType = (type?: string) => {
    if (!type) return 'Opaque';
    return type.replace('kubernetes.io/', '');
  };

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Secrets</h1>
          <p className="text-slate-400 mt-1">
            共 {secrets.length} 个 Secret
            {currentNamespace !== 'all' && ` 在 ${currentNamespace} 命名空间`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* 创建按钮 */}
          {currentNamespace !== 'all' && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium transition-colors"
            >
              <PlusIcon className="w-5 h-5" />
              创建 Secret
            </button>
          )}
          <button onClick={() => refetch()} className="btn btn-secondary">
            刷新
          </button>
        </div>
      </div>

      {/* Secret 列表 */}
      <div className="card overflow-hidden">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>名称</th>
                {currentNamespace === 'all' && <th>命名空间</th>}
                <th>类型</th>
                <th>数据条数</th>
                <th>创建时间</th>
              </tr>
            </thead>
            <tbody>
              {currentSecrets.map((secret) => (
                <tr key={secret.metadata.uid}>
                  <td>
                    <Link
                      to={`/config/secrets/${secret.metadata.namespace}/${secret.metadata.name}`}
                      className="text-blue-400 hover:text-blue-300 font-medium"
                    >
                      {secret.metadata.name}
                    </Link>
                  </td>
                  {currentNamespace === 'all' && (
                    <td>
                      <span className="badge badge-default">{secret.metadata.namespace}</span>
                    </td>
                  )}
                  <td>
                    <span className={clsx('badge', getTypeColor(secret.type))}>
                      {formatType(secret.type)}
                    </span>
                  </td>
                  <td className="text-slate-400">
                    {Object.keys(secret.data || {}).length} 条
                  </td>
                  <td className="text-slate-400">
                    {formatDistanceToNow(new Date(secret.metadata.creationTimestamp), {
                      addSuffix: true,
                      locale: zhCN,
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {secrets.length === 0 && (
          <div className="text-center py-12 text-slate-400">没有找到 Secret</div>
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

      {/* 创建 Secret 表单 */}
      <SecretForm
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={(secret) => createMutation.mutateAsync(secret)}
        namespace={currentNamespace}
        isPending={createMutation.isPending}
      />
    </div>
  );
}
