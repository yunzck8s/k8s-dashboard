import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import clsx from 'clsx';
import { cronJobApi } from '../../../api';
import type { CronJob } from '../../../types';
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  ClipboardDocumentIcon,
  PauseIcon,
  PlayIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';

type TabType = 'overview' | 'yaml';

function formatAge(value?: string) {
  if (!value) return '-';
  return formatDistanceToNow(new Date(value), { addSuffix: true, locale: zhCN });
}

function formatSelector(labels?: Record<string, string>) {
  const entries = Object.entries(labels ?? {});
  if (entries.length === 0) return '-';
  return entries.map(([key, value]) => `${key}=${value}`).join(', ');
}

export default function CronJobDetail() {
  const { namespace, name } = useParams<{ namespace: string; name: string }>();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: cronJob, isLoading, error, refetch } = useQuery({
    queryKey: ['cronjob', namespace, name],
    queryFn: () => cronJobApi.get(namespace!, name!),
    enabled: !!namespace && !!name,
  });

  const { data: yamlData } = useQuery({
    queryKey: ['cronjob-yaml', namespace, name],
    queryFn: () => cronJobApi.getYaml(namespace!, name!),
    enabled: !!namespace && !!name && activeTab === 'yaml',
  });

  const triggerMutation = useMutation({
    mutationFn: () => cronJobApi.trigger(namespace!, name!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cronjob', namespace, name] });
      queryClient.invalidateQueries({ queryKey: ['cronjobs'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });

  const suspendMutation = useMutation({
    mutationFn: (suspend: boolean) => cronJobApi.suspend(namespace!, name!, suspend),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cronjob', namespace, name] });
      queryClient.invalidateQueries({ queryKey: ['cronjobs'] });
      queryClient.invalidateQueries({ queryKey: ['cronjob-yaml', namespace, name] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => cronJobApi.delete(namespace!, name!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cronjobs'] });
      navigate('/workloads/cronjobs');
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-500" />
      </div>
    );
  }

  if (error || !cronJob) {
    return (
      <div className="card p-6 text-center">
        <p className="text-red-400">加载失败：{(error as Error)?.message || 'CronJob 不存在'}</p>
        <button onClick={() => refetch()} className="btn btn-primary mt-4">
          重试
        </button>
      </div>
    );
  }

  const isSuspended = cronJob.spec.suspend ?? false;
  const activeJobs = cronJob.status.active ?? [];
  const tabs: { id: TabType; label: string }[] = [
    { id: 'overview', label: '概览' },
    { id: 'yaml', label: 'YAML' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <Link to="/workloads/cronjobs" className="btn btn-secondary p-2">
            <ArrowLeftIcon className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">{name}</h1>
              <span className={clsx('badge', isSuspended ? 'badge-warning' : 'badge-success')}>
                {isSuspended ? 'Suspended' : 'Active'}
              </span>
            </div>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">命名空间: {namespace}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => refetch()} className="btn btn-secondary">
            <ArrowPathIcon className="mr-2 h-4 w-4" />
            刷新
          </button>
          <button
            onClick={() => triggerMutation.mutate()}
            disabled={triggerMutation.isPending || isSuspended}
            className="btn btn-primary"
            title={isSuspended ? 'CronJob 暂停时不能手动触发' : undefined}
          >
            <PlayIcon className="mr-2 h-4 w-4" />
            {triggerMutation.isPending ? '触发中...' : '触发一次'}
          </button>
          <button
            onClick={() => suspendMutation.mutate(!isSuspended)}
            disabled={suspendMutation.isPending}
            className={clsx('btn', isSuspended ? 'btn-success' : 'btn-warning')}
          >
            {isSuspended ? <PlayIcon className="mr-2 h-4 w-4" /> : <PauseIcon className="mr-2 h-4 w-4" />}
            {suspendMutation.isPending ? '处理中...' : isSuspended ? '恢复' : '暂停'}
          </button>
          <button
            onClick={() => {
              if (confirm(`确定要删除 CronJob ${name} 吗？`)) {
                deleteMutation.mutate();
              }
            }}
            disabled={deleteMutation.isPending}
            className="btn btn-danger"
          >
            <TrashIcon className="mr-2 h-4 w-4" />
            {deleteMutation.isPending ? '删除中...' : '删除'}
          </button>
        </div>
      </div>

      <div className="border-b border-[var(--color-border)]">
        <nav className="flex gap-4 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                '-mb-px border-b-2 px-4 py-3 text-sm font-medium transition-colors',
                activeTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-primary'
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'overview' && <OverviewTab cronJob={cronJob} activeJobs={activeJobs} />}
      {activeTab === 'yaml' && <YamlTab yaml={yamlData ?? ''} />}
    </div>
  );
}

function OverviewTab({ cronJob, activeJobs }: { cronJob: CronJob; activeJobs: NonNullable<CronJob['status']['active']> }) {
  const containers = cronJob.spec.jobTemplate.spec.template.spec.containers;

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <div className="card p-6 xl:col-span-2">
        <h2 className="mb-4 text-lg font-semibold text-[var(--color-text-primary)]">调度状态</h2>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <InfoItem label="Schedule" value={<code className="font-mono">{cronJob.spec.schedule}</code>} />
          <InfoItem label="时区" value={cronJob.spec.timeZone ?? 'Controller 默认'} />
          <InfoItem label="并发策略" value={cronJob.spec.concurrencyPolicy ?? 'Allow'} />
          <InfoItem label="活跃 Jobs" value={activeJobs.length} />
          <InfoItem label="最后调度" value={formatAge(cronJob.status.lastScheduleTime)} />
          <InfoItem label="最后成功" value={formatAge(cronJob.status.lastSuccessfulTime)} />
          <InfoItem label="成功历史保留" value={cronJob.spec.successfulJobsHistoryLimit ?? 3} />
          <InfoItem label="失败历史保留" value={cronJob.spec.failedJobsHistoryLimit ?? 1} />
          <InfoItem label="创建时间" value={formatAge(cronJob.metadata.creationTimestamp)} />
        </dl>
      </div>

      <div className="card p-6">
        <h2 className="mb-4 text-lg font-semibold text-[var(--color-text-primary)]">Job 模板</h2>
        <div className="space-y-4">
          <InfoItem label="完成数" value={cronJob.spec.jobTemplate.spec.completions ?? 1} />
          <InfoItem label="并行度" value={cronJob.spec.jobTemplate.spec.parallelism ?? 1} />
          <InfoItem label="Backoff Limit" value={cronJob.spec.jobTemplate.spec.backoffLimit ?? '-'} />
          <InfoItem label="重启策略" value={cronJob.spec.jobTemplate.spec.template.spec.restartPolicy ?? '-'} />
          <InfoItem label="Selector" value={formatSelector(cronJob.spec.jobTemplate.metadata?.labels)} />
        </div>
      </div>

      <div className="card p-6 xl:col-span-3">
        <h2 className="mb-4 text-lg font-semibold text-[var(--color-text-primary)]">容器镜像</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {containers.map((container) => (
            <div key={container.name} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] p-4">
              <p className="font-medium text-[var(--color-text-primary)]">{container.name}</p>
              <p className="mt-1 break-all font-mono text-sm text-[var(--color-text-secondary)]">{container.image}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden xl:col-span-3">
        <div className="border-b border-[var(--color-border)] px-6 py-4">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">活跃 Jobs</h2>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>名称</th>
                <th>命名空间</th>
                <th>UID</th>
              </tr>
            </thead>
            <tbody>
              {activeJobs.map((job) => (
                <tr key={job.uid ?? `${job.namespace}/${job.name}`}>
                  <td>
                    {job.name && job.namespace ? (
                      <Link to={`/workloads/jobs/${job.namespace}/${job.name}`} className="font-medium text-blue-400 hover:text-blue-300">
                        {job.name}
                      </Link>
                    ) : (
                      job.name ?? '-'
                    )}
                  </td>
                  <td>
                    <span className="badge badge-default">{job.namespace ?? cronJob.metadata.namespace}</span>
                  </td>
                  <td className="font-mono text-sm text-text-muted">{job.uid ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {activeJobs.length === 0 && <div className="py-12 text-center text-text-muted">当前没有活跃 Job</div>}
      </div>
    </div>
  );
}

function YamlTab({ yaml }: { yaml: string }) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
        <h3 className="font-semibold text-[var(--color-text-primary)]">YAML</h3>
        <button onClick={() => navigator.clipboard.writeText(yaml)} className="btn btn-sm btn-secondary" disabled={!yaml}>
          <ClipboardDocumentIcon className="mr-2 h-4 w-4" />
          复制
        </button>
      </div>
      <pre className="max-h-[640px] overflow-auto bg-[var(--color-bg-tertiary)] p-4 text-sm text-[var(--color-text-secondary)]">
        <code>{yaml || '正在加载 YAML...'}</code>
      </pre>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-text-muted">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium text-[var(--color-text-primary)]">{value}</dd>
    </div>
  );
}
