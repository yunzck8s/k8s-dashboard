import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { secretApi } from '../../../api';
import { useAppStore } from '../../../store';
import { usePollingInterval } from '../../../utils/polling';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import clsx from 'clsx';
import Pagination from '../../../components/common/Pagination';
import SecretForm from '../../../components/config/SecretForm';
import { PlusIcon } from '@heroicons/react/24/outline';

export default function Secrets() {
  const { currentNamespace } = useAppStore();
  const pollingInterval = usePollingInterval('standard');
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
    refetchInterval: pollingInterval,
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
          <h1 className="text-3xl font-bold bg-gradient-to-r from-white via-rose-100 to-pink-100 bg-clip-text text-transparent">
            Secrets
          </h1>
          <p className="text-slate-400 mt-2 text-sm font-medium">
            共 <span className="text-rose-400 font-semibold">{secrets.length}</span> 个 Secret
            {currentNamespace !== 'all' && (
              <>
                {' '}在 <span className="text-pink-400 font-semibold">{currentNamespace}</span> 命名空间
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* 创建按钮 */}
          {currentNamespace !== 'all' && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="group relative flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white rounded-lg text-sm font-semibold shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all duration-200 hover:scale-105 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity" />
              <PlusIcon className="w-4 h-4 relative z-10" />
              <span className="relative z-10">创建 Secret</span>
            </button>
          )}
          <button
            onClick={() => refetch()}
            className="group relative px-5 py-2.5 bg-slate-800/60 backdrop-blur-sm hover:bg-slate-700/80 border border-slate-700/50 hover:border-rose-500/50 rounded-lg text-sm font-semibold text-slate-300 hover:text-white shadow-lg hover:shadow-rose-500/20 transition-all duration-300 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-rose-600/0 via-rose-600/10 to-rose-600/0 opacity-0 group-hover:opacity-100 transition-opacity" />
            <span className="relative z-10 flex items-center gap-2">
              <svg className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              刷新
            </span>
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
        onSubmit={async (secret) => {
          await createMutation.mutateAsync(secret);
        }}
        namespace={currentNamespace}
        isPending={createMutation.isPending}
      />
    </div>
  );
}
