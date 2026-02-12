import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { cronJobApi } from '../../../api';
import { useAppStore } from '../../../store';
import { usePollingInterval } from '../../../utils/polling';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import clsx from 'clsx';
import type { CronJob } from '../../../types';

export default function CronJobs() {
  const { currentNamespace } = useAppStore();
  const pollingInterval = usePollingInterval('standard');
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['cronjobs', currentNamespace],
    queryFn: () =>
      currentNamespace === 'all'
        ? cronJobApi.listAll()
        : cronJobApi.list(currentNamespace),
    refetchInterval: pollingInterval,
  });

  // 暂停/恢复 CronJob
  const suspendMutation = useMutation({
    mutationFn: ({ namespace, name, suspend }: { namespace: string; name: string; suspend: boolean }) =>
      cronJobApi.suspend(namespace, name, suspend),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cronjobs'] });
    },
  });

  // 触发 CronJob
  const triggerMutation = useMutation({
    mutationFn: ({ namespace, name }: { namespace: string; name: string }) =>
      cronJobApi.trigger(namespace, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cronjobs'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
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

  const cronJobs = data?.items ?? [];

  // 获取最后调度时间
  const getLastSchedule = (cronJob: CronJob) => {
    if (!cronJob.status.lastScheduleTime) return '从未';
    return formatDistanceToNow(new Date(cronJob.status.lastScheduleTime), {
      addSuffix: true,
      locale: zhCN,
    });
  };

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">CronJobs</h1>
          <p className="text-text-muted mt-1">
            共 {cronJobs.length} 个 CronJob
            {currentNamespace !== 'all' && ` 在 ${currentNamespace} 命名空间`}
          </p>
        </div>
        <button onClick={() => refetch()} className="btn btn-secondary">
          刷新
        </button>
      </div>

      {/* CronJob 列表 */}
      <div className="card overflow-hidden">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>名称</th>
                {currentNamespace === 'all' && <th>命名空间</th>}
                <th>调度表达式</th>
                <th>状态</th>
                <th>活跃 Jobs</th>
                <th>最后调度</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {cronJobs.map((cronJob) => {
                const isSuspended = cronJob.spec.suspend ?? false;
                const activeJobs = cronJob.status.active?.length ?? 0;
                return (
                  <tr key={cronJob.metadata.uid}>
                    <td>
                      <Link
                        to={`/workloads/cronjobs/${cronJob.metadata.namespace}/${cronJob.metadata.name}`}
                        className="text-blue-400 hover:text-blue-300 font-medium"
                      >
                        {cronJob.metadata.name}
                      </Link>
                    </td>
                    {currentNamespace === 'all' && (
                      <td>
                        <span className="badge badge-default">{cronJob.metadata.namespace}</span>
                      </td>
                    )}
                    <td className="font-mono text-sm text-text-secondary">
                      {cronJob.spec.schedule}
                    </td>
                    <td>
                      <span
                        className={clsx(
                          'badge',
                          isSuspended ? 'badge-warning' : 'badge-success'
                        )}
                      >
                        {isSuspended ? 'Suspended' : 'Active'}
                      </span>
                    </td>
                    <td>{activeJobs}</td>
                    <td className="text-text-muted">{getLastSchedule(cronJob)}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            triggerMutation.mutate({
                              namespace: cronJob.metadata.namespace!,
                              name: cronJob.metadata.name,
                            })
                          }
                          disabled={triggerMutation.isPending}
                          className="btn btn-sm btn-primary"
                        >
                          触发
                        </button>
                        <button
                          onClick={() =>
                            suspendMutation.mutate({
                              namespace: cronJob.metadata.namespace!,
                              name: cronJob.metadata.name,
                              suspend: !isSuspended,
                            })
                          }
                          disabled={suspendMutation.isPending}
                          className={clsx(
                            'btn btn-sm',
                            isSuspended ? 'btn-success' : 'btn-warning'
                          )}
                        >
                          {isSuspended ? '恢复' : '暂停'}
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
          <div className="text-center py-12 text-text-muted">没有找到 CronJob</div>
        )}
      </div>
    </div>
  );
}
