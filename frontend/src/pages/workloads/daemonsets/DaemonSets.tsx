import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { daemonSetApi } from '../../../api';
import { useAppStore } from '../../../store';
import { usePollingInterval } from '../../../utils/polling';
import { useNamespacePagination } from '../../../hooks/useNamespacePagination';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import Pagination from '../../../components/common/Pagination';

function useMountAnimation(delayMs = 100) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), delayMs);
    return () => clearTimeout(t);
  }, [delayMs]);
  return mounted;
}

function DaemonSetsSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="h-8 w-36 rounded-lg skeleton" />
        <div className="h-9 w-16 rounded-lg skeleton" />
      </div>
      <div className="h-64 rounded-xl skeleton" />
    </div>
  );
}

function CoverageBar({ ready, desired, delay = 0 }: { ready: number; desired: number; delay?: number }) {
  const mounted = useMountAnimation(120 + delay);
  if (desired === 0) return <span className="font-mono text-xs text-slate-600">0/0</span>;
  const pct = Math.min((ready / desired) * 100, 100);
  const color = ready === desired ? '#10b981' : ready > 0 ? '#f59e0b' : '#ef4444';
  return (
    <div className="min-w-[80px]">
      <div className="mb-1 flex items-baseline gap-1">
        <span className="font-mono text-xs font-semibold text-slate-200">{ready}</span>
        <span className="text-[10px] text-slate-600">/</span>
        <span className="font-mono text-[10px] text-slate-500">{desired}</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full"
          style={{
            width: `${mounted ? pct : 0}%`,
            backgroundColor: color,
            transition: `width 0.75s cubic-bezier(0.4,0,0.2,1) ${delay}ms`,
          }}
        />
      </div>
    </div>
  );
}

export default function DaemonSets() {
  const { currentNamespace } = useAppStore();
  const pollingInterval = usePollingInterval('standard');
  const { currentPage, pageSize, setCurrentPage, setPageSize } = useNamespacePagination(currentNamespace);

  const { data, isLoading, isRefetching, error, refetch } = useQuery({
    queryKey: ['daemonsets', currentNamespace],
    queryFn: () =>
      currentNamespace === 'all'
        ? daemonSetApi.listAll()
        : daemonSetApi.list(currentNamespace),
    refetchInterval: pollingInterval,
  });

  const daemonSets = useMemo(() => data?.items ?? [], [data?.items]);
  const totalPages = Math.ceil(daemonSets.length / pageSize);
  const currentItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return daemonSets.slice(start, start + pageSize);
  }, [currentPage, pageSize, daemonSets]);

  if (isLoading) return <DaemonSetsSkeleton />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-rose-400/20 bg-rose-400/5 py-16 text-center">
        <p className="text-rose-300">加载失败：{(error as Error).message}</p>
        <button onClick={() => refetch()} className="btn btn-secondary btn-sm">重试</button>
      </div>
    );
  }

  const healthyCount = daemonSets.filter(
    (d) => d.status.numberReady === d.status.desiredNumberScheduled && (d.status.desiredNumberScheduled ?? 0) > 0
  ).length;

  return (
    <div className="space-y-5 text-slate-100">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">DaemonSets</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            {healthyCount}/{daemonSets.length} 健康
            {currentNamespace !== 'all' && (
              <> · <span className="text-slate-400">{currentNamespace}</span></>
            )}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="btn btn-secondary btn-sm flex items-center gap-2"
        >
          <ArrowPathIcon className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
          刷新
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-700/80 bg-slate-900/65">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60">
                <th className="py-3 pl-4 pr-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">名称</th>
                {currentNamespace === 'all' && (
                  <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">命名空间</th>
                )}
                <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">状态</th>
                <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">期望 / 就绪</th>
                <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">可用</th>
                <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">节点选择器</th>
                <th className="py-3 pl-3 pr-4 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">时间</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.map((ds, index) => {
                const desired = ds.status.desiredNumberScheduled ?? 0;
                const ready = ds.status.numberReady ?? 0;
                const available = ds.status.numberAvailable ?? 0;
                const isHealthy = ready === desired && desired > 0;
                const nodeSelector = ds.spec.template.spec.nodeSelector
                  ? Object.entries(ds.spec.template.spec.nodeSelector)
                      .map(([k, v]) => `${k}=${v}`)
                      .join(', ')
                  : null;

                return (
                  <tr key={ds.metadata.uid} className="group border-b border-slate-800/60 transition-colors duration-100 hover:bg-slate-800/50">
                    <td className="py-3 pl-4 pr-3">
                      <Link
                        to={`/workloads/daemonsets/${ds.metadata.namespace}/${ds.metadata.name}`}
                        className="font-medium text-blue-400 transition-colors duration-150 hover:text-blue-300"
                      >
                        {ds.metadata.name}
                      </Link>
                    </td>
                    {currentNamespace === 'all' && (
                      <td className="px-3 py-3">
                        <span className="rounded-full bg-slate-700/50 px-2 py-0.5 text-[11px] text-slate-400 ring-1 ring-slate-600/40">
                          {ds.metadata.namespace}
                        </span>
                      </td>
                    )}
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5">
                        {isHealthy ? (
                          <span className="relative flex h-1.5 w-1.5 shrink-0">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          </span>
                        ) : (
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                        )}
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${
                            isHealthy
                              ? 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/25'
                              : 'bg-amber-400/10 text-amber-300 ring-amber-400/25'
                          }`}
                        >
                          {isHealthy ? 'Healthy' : 'Degraded'}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <CoverageBar ready={ready} desired={desired} delay={index * 25} />
                    </td>
                    <td className="px-3 py-3">
                      <span className="font-mono text-xs text-slate-400">{available}</span>
                    </td>
                    <td className="px-3 py-3 max-w-[180px]">
                      <span className="block truncate font-mono text-[11px] text-slate-500" title={nodeSelector ?? '-'}>
                        {nodeSelector ?? <span className="text-slate-600">—</span>}
                      </span>
                    </td>
                    <td className="py-3 pl-3 pr-4 text-xs text-slate-500">
                      {formatDistanceToNow(new Date(ds.metadata.creationTimestamp), { addSuffix: true, locale: zhCN })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {daemonSets.length === 0 && (
          <div className="py-16 text-center text-sm text-slate-500">没有找到 DaemonSet</div>
        )}
      </div>

      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={daemonSets.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
        />
      )}
    </div>
  );
}
