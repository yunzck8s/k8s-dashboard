import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { jobApi } from '../../../api';
import { useAppStore } from '../../../store';
import { usePollingInterval } from '../../../utils/polling';
import { useNamespacePagination } from '../../../hooks/useNamespacePagination';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import Pagination from '../../../components/common/Pagination';
import type { Job } from '../../../types';

function JobsSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="h-8 w-24 rounded-lg skeleton" />
        <div className="h-9 w-16 rounded-lg skeleton" />
      </div>
      <div className="h-64 rounded-xl skeleton" />
    </div>
  );
}

function getJobStatus(job: Job): { label: string; style: string } {
  const conditions = job.status.conditions ?? [];
  const completeCond = conditions.find((c) => c.type === 'Complete');
  const failedCond = conditions.find((c) => c.type === 'Failed');
  if (completeCond?.status === 'True')
    return { label: 'Complete', style: 'bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-400/25' };
  if (failedCond?.status === 'True')
    return { label: 'Failed', style: 'bg-rose-400/10 text-rose-300 ring-1 ring-rose-400/25' };
  if ((job.status.active ?? 0) > 0)
    return { label: 'Running', style: 'bg-blue-400/10 text-blue-300 ring-1 ring-blue-400/25' };
  return { label: 'Pending', style: 'bg-amber-400/10 text-amber-300 ring-1 ring-amber-400/25' };
}

function formatDuration(job: Job): string {
  if (!job.status.startTime) return '-';
  const start = new Date(job.status.startTime);
  const end = job.status.completionTime ? new Date(job.status.completionTime) : new Date();
  const s = Math.floor((end.getTime() - start.getTime()) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export default function Jobs() {
  const { currentNamespace } = useAppStore();
  const pollingInterval = usePollingInterval('standard');
  const { currentPage, pageSize, setCurrentPage, setPageSize } = useNamespacePagination(currentNamespace);

  const { data, isLoading, isRefetching, error, refetch } = useQuery({
    queryKey: ['jobs', currentNamespace],
    queryFn: () =>
      currentNamespace === 'all' ? jobApi.listAll() : jobApi.list(currentNamespace),
    refetchInterval: pollingInterval,
  });

  const jobs = useMemo(() => data?.items ?? [], [data?.items]);
  const totalPages = Math.ceil(jobs.length / pageSize);
  const currentItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return jobs.slice(start, start + pageSize);
  }, [currentPage, pageSize, jobs]);

  if (isLoading) return <JobsSkeleton />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-rose-400/20 bg-rose-400/5 py-16 text-center">
        <p className="text-rose-300">加载失败：{(error as Error).message}</p>
        <button onClick={() => refetch()} className="btn btn-secondary btn-sm">重试</button>
      </div>
    );
  }

  const completeCount = jobs.filter((j) => j.status.conditions?.some((c) => c.type === 'Complete' && c.status === 'True')).length;
  const failedCount = jobs.filter((j) => j.status.conditions?.some((c) => c.type === 'Failed' && c.status === 'True')).length;

  return (
    <div className="space-y-5 text-slate-100">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Jobs</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            {completeCount} 已完成
            {failedCount > 0 && <> · <span className="text-rose-400">{failedCount} 失败</span></>}
            {' '}· 共 {jobs.length}
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
                <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">完成数</th>
                <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">持续时间</th>
                <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">镜像</th>
                <th className="py-3 pl-3 pr-4 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">时间</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.map((job) => {
                const { label, style } = getJobStatus(job);
                const succeeded = job.status.succeeded ?? 0;
                const completions = job.spec.completions ?? 1;
                const images = job.spec.template.spec.containers
                  .map((c) => c.image.split('/').pop()?.split(':')[0] || c.image)
                  .join(', ');
                return (
                  <tr key={job.metadata.uid} className="group border-b border-slate-800/60 transition-colors duration-100 hover:bg-slate-800/50">
                    <td className="py-3 pl-4 pr-3">
                      <Link
                        to={`/workloads/jobs/${job.metadata.namespace}/${job.metadata.name}`}
                        className="font-medium text-blue-400 transition-colors duration-150 hover:text-blue-300"
                      >
                        {job.metadata.name}
                      </Link>
                    </td>
                    {currentNamespace === 'all' && (
                      <td className="px-3 py-3">
                        <span className="rounded-full bg-slate-700/50 px-2 py-0.5 text-[11px] text-slate-400 ring-1 ring-slate-600/40">
                          {job.metadata.namespace}
                        </span>
                      </td>
                    )}
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${style}`}>
                        {label}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="font-mono text-xs text-slate-300">{succeeded}/{completions}</span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="font-mono text-xs text-slate-500">{formatDuration(job)}</span>
                    </td>
                    <td className="px-3 py-3 max-w-[200px]">
                      <span className="block truncate font-mono text-[11px] text-slate-500" title={images}>
                        {images || '-'}
                      </span>
                    </td>
                    <td className="py-3 pl-3 pr-4 text-xs text-slate-500">
                      {formatDistanceToNow(new Date(job.metadata.creationTimestamp), { addSuffix: true, locale: zhCN })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {jobs.length === 0 && (
          <div className="py-16 text-center text-sm text-slate-500">没有找到 Job</div>
        )}
      </div>

      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={jobs.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
        />
      )}
    </div>
  );
}
