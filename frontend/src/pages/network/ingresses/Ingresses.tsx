import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ingressApi } from '../../../api';
import { useAppStore } from '../../../store';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import clsx from 'clsx';
import type { Ingress } from '../../../types';

export default function Ingresses() {
  const { currentNamespace } = useAppStore();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['ingresses', currentNamespace],
    queryFn: () =>
      currentNamespace === 'all'
        ? ingressApi.listAll()
        : ingressApi.list(currentNamespace),
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

  const ingresses = data?.items ?? [];

  // 获取 Hosts
  const getHosts = (ingress: Ingress) => {
    const hosts: string[] = [];
    ingress.spec.rules?.forEach((rule) => {
      if (rule.host) hosts.push(rule.host);
    });
    return hosts.length > 0 ? hosts : ['-'];
  };

  // 获取 Paths
  const getPaths = (ingress: Ingress) => {
    const paths: string[] = [];
    ingress.spec.rules?.forEach((rule) => {
      rule.http?.paths?.forEach((path) => {
        paths.push(path.path || '/');
      });
    });
    return paths.length > 0 ? paths.join(', ') : '/';
  };

  // 获取 Address
  const getAddress = (ingress: Ingress) => {
    const addresses = ingress.status?.loadBalancer?.ingress
      ?.map((i) => i.ip || i.hostname)
      .filter(Boolean);
    return addresses?.join(', ') || '-';
  };

  // 获取 TLS 状态
  const hasTLS = (ingress: Ingress) => {
    return (ingress.spec.tls?.length ?? 0) > 0;
  };

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Ingresses</h1>
          <p className="text-slate-400 mt-1">
            共 {ingresses.length} 个 Ingress
            {currentNamespace !== 'all' && ` 在 ${currentNamespace} 命名空间`}
          </p>
        </div>
        <button onClick={() => refetch()} className="btn btn-secondary">
          刷新
        </button>
      </div>

      {/* Ingress 列表 */}
      <div className="card overflow-hidden">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>名称</th>
                {currentNamespace === 'all' && <th>命名空间</th>}
                <th>Class</th>
                <th>Hosts</th>
                <th>Paths</th>
                <th>Address</th>
                <th>TLS</th>
                <th>创建时间</th>
              </tr>
            </thead>
            <tbody>
              {ingresses.map((ingress) => {
                const hosts = getHosts(ingress);
                return (
                  <tr key={ingress.metadata.uid}>
                    <td>
                      <Link
                        to={`/network/ingresses/${ingress.metadata.namespace}/${ingress.metadata.name}`}
                        className="text-blue-400 hover:text-blue-300 font-medium"
                      >
                        {ingress.metadata.name}
                      </Link>
                    </td>
                    {currentNamespace === 'all' && (
                      <td>
                        <span className="badge badge-default">{ingress.metadata.namespace}</span>
                      </td>
                    )}
                    <td className="text-slate-400">
                      {ingress.spec.ingressClassName || '-'}
                    </td>
                    <td>
                      <div className="flex flex-col gap-1">
                        {hosts.map((host, idx) => (
                          <a
                            key={idx}
                            href={`${hasTLS(ingress) ? 'https' : 'http'}://${host}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300"
                          >
                            {host}
                          </a>
                        ))}
                      </div>
                    </td>
                    <td className="text-slate-400 max-w-xs truncate">
                      {getPaths(ingress)}
                    </td>
                    <td className="text-slate-400 font-mono text-sm">
                      {getAddress(ingress)}
                    </td>
                    <td>
                      <span
                        className={clsx(
                          'badge',
                          hasTLS(ingress) ? 'badge-success' : 'badge-default'
                        )}
                      >
                        {hasTLS(ingress) ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="text-slate-400">
                      {formatDistanceToNow(new Date(ingress.metadata.creationTimestamp), {
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
        {ingresses.length === 0 && (
          <div className="text-center py-12 text-slate-400">没有找到 Ingress</div>
        )}
      </div>
    </div>
  );
}
