import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import clsx from 'clsx';
import { jobApi } from '../../../api';
import type { Job, Pod } from '../../../types';
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  ClipboardDocumentIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';

type TabType = 'overview' | 'pods' | 'yaml';

function getJobStatus(job: Job) {
  const complete = job.status.conditions?.find((condition) => condition.type === 'Complete');
  const failed = job.status.conditions?.find((condition) => condition.type === 'Failed');

  if (complete?.status === 'True') {
    return { label: 'Complete', className: 'badge-success' };
  }
  if (failed?.status === 'True') {
    return { label: 'Failed', className: 'badge-error' };
  }
  if ((job.status.active ?? 0) > 0) {
    return { label: 'Running', className: 'badge-info' };
  }
  return { label: 'Pending', className: 'badge-warning' };
}

function formatAge(value?: string) {
  if (!value) return '-';
  return formatDistanceToNow(new Date(value), { addSuffix: true, locale: zhCN });
}

function formatDuration(job: Job) {
  if (!job.status.startTime) return '-';
  const start = new Date(job.status.startTime).getTime();
  const end = job.status.completionTime ? new Date(job.status.completionTime).getTime() : Date.now();
  const seconds = Math.max(0, Math.floor((end - start) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function formatSelector(labels?: Record<string, string>) {
  const entries = Object.entries(labels ?? {});
  if (entries.length === 0) return '-';
  return entries.map(([key, value]) => `${key}=${value}`).join(', ');
}

function podBadgeClass(phase: string) {
  switch (phase) {
    case 'Running':
      return 'badge-success';
    case 'Succeeded':
      return 'badge-info';
    case 'Failed':
      return 'badge-error';
    case 'Pending':
      return 'badge-warning';
    default:
      return 'badge-default';
  }
}

export default function JobDetail() {
  const { namespace, name } = useParams<{ namespace: string; name: string }>();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: job, isLoading, error, refetch } = useQuery({
    queryKey: ['job', namespace, name],
    queryFn: () => jobApi.get(namespace!, name!),
    enabled: !!namespace && !!name,
  });

  const { data: podsData } = useQuery({
    queryKey: ['job-pods', namespace, name],
    queryFn: () => jobApi.getPods(namespace!, name!),
    enabled: !!namespace && !!name && activeTab === 'pods',
    refetchInterval: activeTab === 'pods' ? 5000 : false,
  });

  const { data: yamlData } = useQuery({
    queryKey: ['job-yaml', namespace, name],
    queryFn: () => jobApi.getYaml(namespace!, name!),
    enabled: !!namespace && !!name && activeTab === 'yaml',
  });

  const deleteMutation = useMutation({
    mutationFn: () => jobApi.delete(namespace!, name!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      navigate('/workloads/jobs');
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-500" />
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="card p-6 text-center">
        <p className="text-red-400">加载失败：{(error as Error)?.message || 'Job 不存在'}</p>
        <button onClick={() => refetch()} className="btn btn-primary mt-4">
          重试
        </button>
      </div>
    );
  }

  const status = getJobStatus(job);
  const pods = podsData?.items ?? [];
  const tabs: { id: TabType; label: string }[] = [
    { id: 'overview', label: '概览' },
    { id: 'pods', label: 'Pods' },
    { id: 'yaml', label: 'YAML' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <Link to="/workloads/jobs" className="btn btn-secondary p-2">
            <ArrowLeftIcon className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">{name}</h1>
              <span className={clsx('badge', status.className)}>{status.label}</span>
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
            onClick={() => {
              if (confirm(`确定要删除 Job ${name} 吗？`)) {
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

      {activeTab === 'overview' && <OverviewTab job={job} />}
      {activeTab === 'pods' && <PodsTab pods={pods} />}
      {activeTab === 'yaml' && <YamlTab yaml={yamlData ?? ''} />}
    </div>
  );
}

function OverviewTab({ job }: { job: Job }) {
  const completions = `${job.status.succeeded ?? 0}/${job.spec.completions ?? 1}`;
  const containers = job.spec.template.spec.containers;

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <div className="card p-6 xl:col-span-2">
        <h2 className="mb-4 text-lg font-semibold text-[var(--color-text-primary)]">运行状态</h2>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <InfoItem label="完成数" value={completions} />
          <InfoItem label="活跃 Pods" value={job.status.active ?? 0} />
          <InfoItem label="失败次数" value={job.status.failed ?? 0} />
          <InfoItem label="并行度" value={job.spec.parallelism ?? 1} />
          <InfoItem label="Backoff Limit" value={job.spec.backoffLimit ?? '-'} />
          <InfoItem label="持续时间" value={formatDuration(job)} />
          <InfoItem label="开始时间" value={formatAge(job.status.startTime)} />
          <InfoItem label="完成时间" value={formatAge(job.status.completionTime)} />
          <InfoItem label="创建时间" value={formatAge(job.metadata.creationTimestamp)} />
        </dl>
      </div>

      <div className="card p-6">
        <h2 className="mb-4 text-lg font-semibold text-[var(--color-text-primary)]">Pod 模板</h2>
        <div className="space-y-4">
          <InfoItem label="重启策略" value={job.spec.template.spec.restartPolicy ?? '-'} />
          <InfoItem label="ServiceAccount" value={job.spec.template.spec.serviceAccountName ?? '-'} />
          <InfoItem label="Selector" value={formatSelector(job.metadata.labels)} />
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

      {job.status.conditions && job.status.conditions.length > 0 && (
        <div className="card overflow-hidden xl:col-span-3">
          <div className="border-b border-[var(--color-border)] px-6 py-4">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Conditions</h2>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>类型</th>
                  <th>状态</th>
                  <th>原因</th>
                  <th>消息</th>
                  <th>更新时间</th>
                </tr>
              </thead>
              <tbody>
                {job.status.conditions.map((condition) => (
                  <tr key={condition.type}>
                    <td>{condition.type}</td>
                    <td>
                      <span className={clsx('badge', condition.status === 'True' ? 'badge-success' : 'badge-default')}>
                        {condition.status}
                      </span>
                    </td>
                    <td className="text-text-muted">{condition.reason ?? '-'}</td>
                    <td className="max-w-xl truncate text-text-muted" title={condition.message}>
                      {condition.message ?? '-'}
                    </td>
                    <td className="text-text-muted">{formatAge(condition.lastTransitionTime)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function PodsTab({ pods }: { pods: Pod[] }) {
  return (
    <div className="card overflow-hidden">
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>名称</th>
              <th>状态</th>
              <th>Ready</th>
              <th>节点</th>
              <th>重启策略</th>
              <th>创建时间</th>
            </tr>
          </thead>
          <tbody>
            {pods.map((pod) => {
              const ready = pod.status.containerStatuses?.filter((container) => container.ready).length ?? 0;
              const total = pod.status.containerStatuses?.length ?? pod.spec.containers.length;
              return (
                <tr key={pod.metadata.uid}>
                  <td>
                    <Link
                      to={`/workloads/pods/${pod.metadata.namespace}/${pod.metadata.name}`}
                      className="font-medium text-blue-400 hover:text-blue-300"
                    >
                      {pod.metadata.name}
                    </Link>
                  </td>
                  <td>
                    <span className={clsx('badge', podBadgeClass(pod.status.phase))}>{pod.status.phase}</span>
                  </td>
                  <td>
                    {ready}/{total}
                  </td>
                  <td className="text-text-muted">{pod.spec.nodeName ?? '-'}</td>
                  <td className="text-text-muted">{pod.spec.restartPolicy ?? '-'}</td>
                  <td className="text-text-muted">{formatAge(pod.metadata.creationTimestamp)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {pods.length === 0 && <div className="py-12 text-center text-text-muted">没有关联 Pod</div>}
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
