import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { cronJobApi } from '../../../api';
import { useAppStore } from '../../../store';
import { usePollingInterval } from '../../../utils/polling';
import { useNamespacePagination } from '../../../hooks/useNamespacePagination';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { ArrowPathIcon, PlayIcon, PauseIcon } from '@heroicons/react/24/outline';
import Pagination from '../../../components/common/Pagination';
import type { CronJob } from '../../../types';

function CronJobsSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="h-8 w-32 rounded-lg skeleton" />
        <div className="h-9 w-16 rounded-lg skeleton" />
      </div>
      <div className="h-64 rounded-xl skeleton" />
    </div>
  );
}

function getLastSchedule(cronJob: CronJob): string {
  if (!cronJob.status.lastScheduleTime) return '从未';
  return formatDistanceToNow(new Date(cronJob.status.lastScheduleTime), { addSuffix: true, locale: zhCN });
}

export default function CronJobs() {
  const { currentNamespace } = useAppStore();
  const pollingInterval = usePollingInterval('standard');
  const queryClient = useQueryClient();
  const { currentPage, pageSize, setCurrentPage, setPageSize } = useNamespacePagination(currentNamespace);

  const { data, isLoading, isRefetching, error, refetch } = useQuery({
    queryKey: ['cronjobs', currentNamespace],
    queryFn: () =>
      currentNamespace === 'all' ? cronJobApi.listAll() : cronJobApi.list(currentNamespace),
    refetchInterval: pollingInterval,
  });

  const suspendMutation = useMutation({
    mutationFn: ({ namespace, name, suspend }: { namespace: string; name: string; suspend: boolean }) =>
      cronJobApi.suspend(namespace, name, suspend),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cronjobs'] });
    },
  });

  const triggerMutation = useMutation({
    mutationFn: ({ namespace, name }: { namespace: string; name: string }) =>
      cronJobApi.trigger(namespace, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cronjobs'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });

  const cronJobs = useMemo(() => data?.items ?? [], [data?.items]);
  const totalPages = Math.ceil(cronJobs.length / pageSize);
  const currentItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return cronJobs.slice(start, start + pageSize);
  }, [currentPage, pageSize, cronJobs]);

  if (isLoading) return <CronJobsSkeleton />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-rose-400/20 bg-rose-400/5 py-16 text-center">
        <p className="text-rose-300">加载失败：{(error as Error).message}</p>
        <button onClick={() => refetch()} className="btn btn-secondary btn-sm">重试</button>
      </div>
    );
  }

  const activeCount = cronJobs.filter((c) => !(c.spec.suspend ?? false)).length;
  const suspendedCount = cronJobs.length - activeCount;

  return (
    <div className="space-y-5 text-slate-100">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">CronJobs</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            {activeCount} 运行中
            {suspendedCount > 0 && <> · <span className="text-amber-400">{suspendedCount} 已暂停</span></>}
            {' '}· 共 {cronJobs.length}
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
                <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">调度</th>
                <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">状态</th>
                <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">活跃 Jobs</th>
                <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">最后调度</th>
                <th className="py-3 pl-3 pr-4 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">操作</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.map((cronJob) => {
                const isSuspended = cronJob.spec.suspend ?? false;
                const activeJobs = cronJob.status.active?.length ?? 0;
                const isSuspendPending =
                  suspendMutation.isPending &&
                  suspendMutation.variables?.namespace === cronJob.metadata.namespace &&
                  suspendMutation.variables?.name === cronJob.metadata.name;
                const isTriggerPending =
                  triggerMutation.isPending &&
                  triggerMutation.variables?.namespace === cronJob.metadata.namespace &&
                  triggerMutation.variables?.name === cronJob.metadata.name;

                return (
                  <tr key={cronJob.metadata.uid} className="group border-b border-slate-800/60 transition-colors duration-100 hover:bg-slate-800/50">
                    <td className="py-3 pl-4 pr-3">
                      <Link
                        to={`/workloads/cronjobs/${cronJob.metadata.namespace}/${cronJob.metadata.name}`}
                        className="font-medium text-blue-400 transition-colors duration-150 hover:text-blue-300"
                      >
                        {cronJob.metadata.name}
                      </Link>
                    </td>
                    {currentNamespace === 'all' && (
                      <td className="px-3 py-3">
                        <span className="rounded-full bg-slate-700/50 px-2 py-0.5 text-[11px] text-slate-400 ring-1 ring-slate-600/40">
                          {cronJob.metadata.namespace}
                        </span>
                      </td>
                    )}
                    <td className="px-3 py-3">
                      <span className="rounded bg-slate-800/80 px-2 py-0.5 font-mono text-[11px] text-slate-300">
                        {cronJob.spec.schedule}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5">
                        {!isSuspended && (
                          <span className="relative flex h-1.5 w-1.5 shrink-0">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          </span>
                        )}
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${
                            isSuspended
                              ? 'bg-amber-400/10 text-amber-300 ring-amber-400/25'
                              : 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/25'
                          }`}
                        >
                          {isSuspended ? 'Suspended' : 'Active'}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="font-mono text-xs text-slate-400">{activeJobs}</span>
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-500">
                      {getLastSchedule(cronJob)}
                    </td>
                    <td className="py-3 pl-3 pr-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            triggerMutation.mutate({
                              namespace: cronJob.metadata.namespace!,
                              name: cronJob.metadata.name,
                            })
                          }
                          disabled={isTriggerPending}
                          className="flex items-center gap-1 rounded-md bg-blue-500/10 px-2.5 py-1 text-[11px] font-medium text-blue-300 ring-1 ring-blue-400/25 transition-colors hover:bg-blue-500/20 disabled:opacity-50"
                        >
                          <PlayIcon className="h-3 w-3" />
                          {isTriggerPending ? '触发中' : '触发'}
                        </button>
                        <button
                          onClick={() =>
                            suspendMutation.mutate({
                              namespace: cronJob.metadata.namespace!,
                              name: cronJob.metadata.name,
                              suspend: !isSuspended,
                            })
                          }
                          disabled={isSuspendPending}
                          className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium ring-1 transition-colors disabled:opacity-50 ${
                            isSuspended
                              ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-400/25 hover:bg-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-300 ring-amber-400/25 hover:bg-amber-500/20'
                          }`}
                        >
                          {isSuspended ? (
                            <><PlayIcon className="h-3 w-3" />{isSuspendPending ? '恢复中' : '恢复'}</>
                          ) : (
                            <><PauseIcon className="h-3 w-3" />{isSuspendPending ? '暂停中' : '暂停'}</>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {cronJobs.length === 0 && (
          <div className="py-16 text-center text-sm text-slate-500">没有找到 CronJob</div>
        )}
      </div>

      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={cronJobs.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
        />
      )}
    </div>
  );
}
