import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { jobApi } from '../../../api';
import { useAppStore } from '../../../store';
import { usePollingInterval } from '../../../utils/polling';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import clsx from 'clsx';
import type { Job } from '../../../types';

export default function Jobs() {
  const { currentNamespace } = useAppStore();
  const pollingInterval = usePollingInterval('standard');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['jobs', currentNamespace],
    queryFn: () =>
      currentNamespace === 'all'
        ? jobApi.listAll()
        : jobApi.list(currentNamespace),
    refetchInterval: pollingInterval,
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

  const jobs = data?.items ?? [];

  // 获取 Job 状态
  const getJobStatus = (job: Job) => {
    const conditions = job.status.conditions ?? [];
    const completeCond = conditions.find((c) => c.type === 'Complete');
    const failedCond = conditions.find((c) => c.type === 'Failed');

    if (completeCond?.status === 'True') {
      return { status: 'Complete', color: 'badge-success' };
    }
    if (failedCond?.status === 'True') {
      return { status: 'Failed', color: 'badge-error' };
    }
    if ((job.status.active ?? 0) > 0) {
      return { status: 'Running', color: 'badge-info' };
    }
    return { status: 'Pending', color: 'badge-warning' };
  };

  // 格式化完成数
  const formatCompletions = (job: Job) => {
    const succeeded = job.status.succeeded ?? 0;
    const completions = job.spec.completions ?? 1;
    return `${succeeded}/${completions}`;
  };

  // 格式化持续时间
  const formatDuration = (job: Job) => {
    if (!job.status.startTime) return '-';
    const start = new Date(job.status.startTime);
    const end = job.status.completionTime
      ? new Date(job.status.completionTime)
      : new Date();
    const durationMs = end.getTime() - start.getTime();
    const seconds = Math.floor(durationMs / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  };

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Jobs</h1>
          <p className="text-slate-400 mt-1">
            共 {jobs.length} 个 Job
            {currentNamespace !== 'all' && ` 在 ${currentNamespace} 命名空间`}
          </p>
        </div>
        <button onClick={() => refetch()} className="btn btn-secondary">
          刷新
        </button>
      </div>

      {/* Job 列表 */}
      <div className="card overflow-hidden">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>名称</th>
                {currentNamespace === 'all' && <th>命名空间</th>}
                <th>状态</th>
                <th>完成数</th>
                <th>持续时间</th>
                <th>镜像</th>
                <th>创建时间</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => {
                const jobStatus = getJobStatus(job);
                const images = job.spec.template.spec.containers
                  .map((c) => c.image.split('/').pop()?.split(':')[0] || c.image)
                  .join(', ');
                return (
                  <tr key={job.metadata.uid}>
                    <td>
                      <Link
                        to={`/workloads/jobs/${job.metadata.namespace}/${job.metadata.name}`}
                        className="text-blue-400 hover:text-blue-300 font-medium"
                      >
                        {job.metadata.name}
                      </Link>
                    </td>
                    {currentNamespace === 'all' && (
                      <td>
                        <span className="badge badge-default">{job.metadata.namespace}</span>
                      </td>
                    )}
                    <td>
                      <span className={clsx('badge', jobStatus.color)}>
                        {jobStatus.status}
                      </span>
                    </td>
                    <td>{formatCompletions(job)}</td>
                    <td className="text-slate-400">{formatDuration(job)}</td>
                    <td className="text-slate-400 max-w-xs truncate" title={images}>
                      {images}
                    </td>
                    <td className="text-slate-400">
                      {formatDistanceToNow(new Date(job.metadata.creationTimestamp), {
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
        {jobs.length === 0 && (
          <div className="text-center py-12 text-slate-400">没有找到 Job</div>
        )}
      </div>
    </div>
  );
}
