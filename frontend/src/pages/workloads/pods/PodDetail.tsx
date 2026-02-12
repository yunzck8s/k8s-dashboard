import { Suspense, lazy, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { podApi } from '../../../api';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import clsx from 'clsx';
import type { Pod, Event, PodPhase } from '../../../types';
import {
  ArrowLeftIcon,
  TrashIcon,
  ArrowPathIcon,
  ClipboardDocumentIcon,
} from '@heroicons/react/24/outline';

const PodTerminal = lazy(() => import('../../../components/terminal/PodTerminal'));

// Tab 类型
type TabType = 'overview' | 'containers' | 'logs' | 'terminal' | 'yaml' | 'events';

// 状态颜色
const phaseColors: Record<PodPhase, string> = {
  Running: 'badge-success',
  Pending: 'badge-warning',
  Succeeded: 'badge-info',
  Failed: 'badge-error',
  Unknown: 'badge-default',
};

// 获取 Pod 状态颜色（增强版：考虑容器 Ready 状态）
function getPodStatusColor(pod: Pod): string {
  const phase = pod.status.phase;

  // 对于 Running 状态，检查容器是否真的准备好
  if (phase === 'Running') {
    const containerStatuses = pod.status.containerStatuses ?? [];
    const ready = containerStatuses.filter((cs) => cs.ready).length;
    const total = containerStatuses.length;

    // 如果不是所有容器都 ready，显示为警告状态（黄色）
    if (total > 0 && ready < total) {
      return 'badge-warning';
    }

    // 所有容器都 ready，显示为成功状态（绿色）
    return 'badge-success';
  }

  // 其他状态使用默认颜色
  return phaseColors[phase] || 'badge-default';
}

export default function PodDetail() {
  const { namespace, name } = useParams<{ namespace: string; name: string }>();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [selectedContainer, setSelectedContainer] = useState<string>('');
  const queryClient = useQueryClient();

  // 获取 Pod 详情
  const { data: pod, isLoading, error, refetch } = useQuery({
    queryKey: ['pod', namespace, name],
    queryFn: () => podApi.get(namespace!, name!),
    enabled: !!namespace && !!name,
  });

  // 获取 Pod YAML
  const { data: yamlData } = useQuery({
    queryKey: ['pod-yaml', namespace, name],
    queryFn: () => podApi.getYaml(namespace!, name!),
    enabled: !!namespace && !!name && activeTab === 'yaml',
  });

  // 获取 Pod 事件
  const { data: eventsData } = useQuery({
    queryKey: ['pod-events', namespace, name],
    queryFn: () => podApi.getEvents(namespace!, name!),
    enabled: !!namespace && !!name && activeTab === 'events',
  });

  // 获取 Pod 日志
  const effectiveSelectedContainer = selectedContainer || pod?.spec.containers[0]?.name || '';

  const { data: logsData, refetch: refetchLogs } = useQuery({
    queryKey: ['pod-logs', namespace, name, effectiveSelectedContainer],
    queryFn: () => podApi.getLogs(namespace!, name!, effectiveSelectedContainer, 500),
    enabled: !!namespace && !!name && !!effectiveSelectedContainer && activeTab === 'logs',
  });

  // 删除 Pod
  const deleteMutation = useMutation({
    mutationFn: () => podApi.delete(namespace!, name!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pods'] });
      window.history.back();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div
          className="animate-spin rounded-full h-8 w-8 border-b-2"
          style={{ borderColor: 'var(--color-primary)' }}
        />
      </div>
    );
  }

  if (error || !pod) {
    return (
      <div
        className="p-6 text-center rounded-xl"
        style={{
          background: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
        }}
      >
        <p style={{ color: '#F87171' }}>加载失败：{(error as Error)?.message || 'Pod 不存在'}</p>
        <button onClick={() => refetch()} className="btn btn-primary mt-4">
          重试
        </button>
      </div>
    );
  }

  const tabs: { id: TabType; label: string }[] = [
    { id: 'overview', label: '概览' },
    { id: 'containers', label: '容器' },
    { id: 'logs', label: '日志' },
    { id: 'terminal', label: '终端' },
    { id: 'yaml', label: 'YAML' },
    { id: 'events', label: '事件' },
  ];

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/workloads/pods" className="btn btn-secondary p-2">
            <ArrowLeftIcon className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">{name}</h1>
              <span className={clsx('badge', getPodStatusColor(pod))}>
                {pod.status.phase}
              </span>
            </div>
            <p className="mt-1 text-[var(--color-text-secondary)]">
              命名空间: {namespace} | 节点: {pod.spec.nodeName || 'Pending'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => refetch()} className="btn btn-secondary">
            <ArrowPathIcon className="w-4 h-4 mr-2" />
            刷新
          </button>
          <button
            onClick={() => {
              if (confirm('确定要删除此 Pod 吗？')) {
                deleteMutation.mutate();
              }
            }}
            className="btn btn-danger"
            disabled={deleteMutation.isPending}
          >
            <TrashIcon className="w-4 h-4 mr-2" />
            删除
          </button>
        </div>
      </div>

      {/* 标签页导航 */}
      <div style={{ borderBottom: '1px solid var(--color-border)' }}>
        <nav className="flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors duration-150',
                activeTab === tab.id
                  ? 'border-current'
                  : 'border-transparent'
              )}
              style={{
                color: activeTab === tab.id ? 'var(--color-primary)' : 'var(--color-text-muted)',
                borderColor: activeTab === tab.id ? 'var(--color-primary)' : 'transparent',
              }}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* 标签页内容 */}
      <div>
        {activeTab === 'overview' && <OverviewTab pod={pod} />}
        {activeTab === 'containers' && <ContainersTab pod={pod} />}
        {activeTab === 'logs' && (
          <LogsTab
            pod={pod}
            logs={logsData || ''}
            selectedContainer={effectiveSelectedContainer}
            onContainerChange={setSelectedContainer}
            onRefresh={() => refetchLogs()}
          />
        )}
        {activeTab === 'terminal' && (
          <div
            className="overflow-hidden rounded-xl"
            style={{
              minHeight: '500px',
              background: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div className="p-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <div className="flex items-center gap-4">
                <label className="text-sm text-[var(--color-text-secondary)]">选择容器:</label>
                <select
                  value={effectiveSelectedContainer}
                  onChange={(e) => setSelectedContainer(e.target.value)}
                  className="rounded px-3 py-1.5 text-sm"
                  style={{
                    background: 'var(--color-bg-tertiary)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  {pod.spec.containers.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {effectiveSelectedContainer && (
              <Suspense
                fallback={
                  <div className="h-[420px] flex items-center justify-center">
                    <div
                      className="animate-spin rounded-full h-6 w-6 border-b-2"
                      style={{ borderColor: 'var(--color-primary)' }}
                    />
                  </div>
                }
              >
                <PodTerminal
                  namespace={namespace!}
                  name={name!}
                  container={effectiveSelectedContainer}
                />
              </Suspense>
            )}
          </div>
        )}
        {activeTab === 'yaml' && <YamlTab yaml={yamlData || ''} />}
        {activeTab === 'events' && <EventsTab events={eventsData?.items || []} />}
      </div>
    </div>
  );
}

// 概览标签页
function OverviewTab({ pod }: { pod: Pod }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 基本信息 */}
      <div
        className="p-6 rounded-xl"
        style={{
          background: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
        }}
      >
        <h3 className="text-lg font-semibold mb-4 text-[var(--color-text-primary)]">基本信息</h3>
        <dl className="space-y-3">
          <InfoRow label="名称" value={pod.metadata.name} />
          <InfoRow label="命名空间" value={pod.metadata.namespace || '-'} />
          <InfoRow label="UID" value={pod.metadata.uid} mono />
          <InfoRow
            label="创建时间"
            value={formatDistanceToNow(new Date(pod.metadata.creationTimestamp), {
              addSuffix: true,
              locale: zhCN,
            })}
          />
          <InfoRow label="节点" value={pod.spec.nodeName || 'Pending'} />
          <InfoRow label="Pod IP" value={pod.status.podIP || '-'} mono />
          <InfoRow label="Host IP" value={pod.status.hostIP || '-'} mono />
          <InfoRow label="QoS 等级" value={pod.status.qosClass || '-'} />
          <InfoRow label="重启策略" value={pod.spec.restartPolicy || '-'} />
          <InfoRow label="服务账户" value={pod.spec.serviceAccountName || 'default'} />
        </dl>
      </div>

      {/* 标签和注解 */}
      <div className="space-y-6">
        <div
          className="p-6 rounded-xl"
          style={{
            background: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
          }}
        >
          <h3 className="text-lg font-semibold mb-4 text-[var(--color-text-primary)]">标签</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(pod.metadata.labels || {}).map(([key, value]) => (
              <span key={key} className="badge badge-default text-xs">
                {key}: {value}
              </span>
            ))}
            {!pod.metadata.labels && (
              <span className="text-[var(--color-text-muted)]">无标签</span>
            )}
          </div>
        </div>

        <div
          className="p-6 rounded-xl"
          style={{
            background: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
          }}
        >
          <h3 className="text-lg font-semibold mb-4 text-[var(--color-text-primary)]">注解</h3>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {Object.entries(pod.metadata.annotations || {}).map(([key, value]) => (
              <div key={key} className="text-sm">
                <span className="text-[var(--color-text-muted)]">{key}:</span>
                <span className="ml-2 break-all text-[var(--color-text-secondary)]">{value}</span>
              </div>
            ))}
            {!pod.metadata.annotations && (
              <span className="text-[var(--color-text-muted)]">无注解</span>
            )}
          </div>
        </div>
      </div>

      {/* 条件状态 */}
      <div
        className="p-6 lg:col-span-2 rounded-xl"
        style={{
          background: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
        }}
      >
        <h3 className="text-lg font-semibold mb-4 text-[var(--color-text-primary)]">条件状态</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-[var(--color-text-muted)]">
                <th className="pb-3">类型</th>
                <th className="pb-3">状态</th>
                <th className="pb-3">原因</th>
                <th className="pb-3">最后转换时间</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {pod.status.conditions?.map((condition) => (
                <tr key={condition.type} style={{ borderTop: '1px solid var(--color-border)' }}>
                  <td className="py-3 text-[var(--color-text-secondary)]">{condition.type}</td>
                  <td className="py-3">
                    <span
                      className={clsx(
                        'badge',
                        condition.status === 'True' ? 'badge-success' : 'badge-warning'
                      )}
                    >
                      {condition.status}
                    </span>
                  </td>
                  <td className="py-3 text-[var(--color-text-muted)]">{condition.reason || '-'}</td>
                  <td className="py-3 text-[var(--color-text-muted)]">
                    {condition.lastTransitionTime
                      ? formatDistanceToNow(new Date(condition.lastTransitionTime), {
                          addSuffix: true,
                          locale: zhCN,
                        })
                      : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// 容器标签页
function ContainersTab({ pod }: { pod: Pod }) {
  const containerStatuses = pod.status.containerStatuses || [];

  return (
    <div className="space-y-4">
      {pod.spec.containers.map((container) => {
        const status = containerStatuses.find((cs) => cs.name === container.name);
        return (
          <div
            key={container.name}
            className="p-6 rounded-xl"
            style={{
              background: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">{container.name}</h3>
                {status && (
                  <span
                    className={clsx(
                      'badge',
                      status.ready ? 'badge-success' : 'badge-warning'
                    )}
                  >
                    {status.ready ? '就绪' : '未就绪'}
                  </span>
                )}
              </div>
              {status && (
                <span className="text-sm text-[var(--color-text-muted)]">
                  重启次数: {status.restartCount}
                </span>
              )}
            </div>

            <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoRow label="镜像" value={container.image} mono />
              <InfoRow label="镜像拉取策略" value={container.imagePullPolicy || 'Always'} />

              {/* 端口 */}
              {container.ports && container.ports.length > 0 && (
                <div className="md:col-span-2">
                  <dt className="text-sm text-text-muted">端口</dt>
                  <dd className="mt-1 flex flex-wrap gap-2">
                    {container.ports.map((port, idx) => (
                      <span key={idx} className="badge badge-default">
                        {port.name ? `${port.name}: ` : ''}{port.containerPort}/{port.protocol || 'TCP'}
                      </span>
                    ))}
                  </dd>
                </div>
              )}

              {/* 资源限制 */}
              {container.resources && (
                <div className="md:col-span-2">
                  <dt className="text-sm mb-2 text-[var(--color-text-muted)]">资源</dt>
                  <dd className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-[var(--color-text-muted)]">请求:</span>
                      <span className="ml-2 text-[var(--color-text-secondary)]">
                        CPU: {container.resources.requests?.cpu || '-'},
                        内存: {container.resources.requests?.memory || '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[var(--color-text-muted)]">限制:</span>
                      <span className="ml-2 text-[var(--color-text-secondary)]">
                        CPU: {container.resources.limits?.cpu || '-'},
                        内存: {container.resources.limits?.memory || '-'}
                      </span>
                    </div>
                  </dd>
                </div>
              )}

              {/* 环境变量 */}
              {container.env && container.env.length > 0 && (
                <div className="md:col-span-2">
                  <dt className="text-sm mb-2 text-[var(--color-text-muted)]">环境变量</dt>
                  <dd
                    className="rounded p-3 max-h-40 overflow-y-auto"
                    style={{ background: 'var(--color-bg-tertiary)' }}
                  >
                    {container.env.map((env, idx) => (
                      <div key={idx} className="text-sm font-mono">
                        <span className="text-[var(--color-primary)]">{env.name}</span>
                        <span className="text-[var(--color-text-muted)]">=</span>
                        <span className="text-[var(--color-text-secondary)]">
                          {env.value || (env.valueFrom ? '[from secret/configmap]' : '')}
                        </span>
                      </div>
                    ))}
                  </dd>
                </div>
              )}

              {/* 挂载卷 */}
              {container.volumeMounts && container.volumeMounts.length > 0 && (
                <div className="md:col-span-2">
                  <dt className="text-sm mb-2 text-[var(--color-text-muted)]">挂载卷</dt>
                  <dd className="space-y-1">
                    {container.volumeMounts.map((mount, idx) => (
                      <div key={idx} className="text-sm">
                        <span className="font-mono text-[var(--color-text-secondary)]">{mount.mountPath}</span>
                        <span className="ml-2 text-[var(--color-text-muted)]">← {mount.name}</span>
                        {mount.readOnly && <span className="badge badge-default ml-2">只读</span>}
                      </div>
                    ))}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        );
      })}
    </div>
  );
}

// 日志标签页
function LogsTab({
  pod,
  logs,
  selectedContainer,
  onContainerChange,
  onRefresh,
}: {
  pod: Pod;
  logs: string;
  selectedContainer: string;
  onContainerChange: (container: string) => void;
  onRefresh: () => void;
}) {
  const copyLogs = () => {
    navigator.clipboard.writeText(logs);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <label className="text-[var(--color-text-muted)]">容器:</label>
          <select
            value={selectedContainer}
            onChange={(e) => onContainerChange(e.target.value)}
            className="input w-48"
          >
            {pod.spec.containers.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={copyLogs} className="btn btn-secondary">
            <ClipboardDocumentIcon className="w-4 h-4 mr-2" />
            复制
          </button>
          <button onClick={onRefresh} className="btn btn-secondary">
            <ArrowPathIcon className="w-4 h-4 mr-2" />
            刷新
          </button>
        </div>
      </div>

      <div
        className="p-4 rounded-xl max-h-[600px] overflow-auto"
        style={{
          background: 'var(--color-bg-tertiary)',
          border: '1px solid var(--color-border)',
        }}
      >
        <pre className="text-sm font-mono whitespace-pre-wrap text-[var(--color-text-secondary)]">
          {logs || '暂无日志'}
        </pre>
      </div>
    </div>
  );
}

// YAML 标签页
function YamlTab({ yaml }: { yaml: string }) {
  const copyYaml = () => {
    navigator.clipboard.writeText(yaml);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={copyYaml} className="btn btn-secondary">
          <ClipboardDocumentIcon className="w-4 h-4 mr-2" />
          复制 YAML
        </button>
      </div>
      <div
        className="p-4 rounded-xl max-h-[600px] overflow-auto"
        style={{
          background: 'var(--color-bg-tertiary)',
          border: '1px solid var(--color-border)',
        }}
      >
        <pre className="text-sm font-mono text-[var(--color-text-secondary)]">
          {yaml || '加载中...'}
        </pre>
      </div>
    </div>
  );
}

// 事件标签页
function EventsTab({ events }: { events: Event[] }) {
  return (
    <div
      className="overflow-hidden rounded-xl"
      style={{
        background: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border)',
      }}
    >
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>类型</th>
              <th>原因</th>
              <th>消息</th>
              <th>次数</th>
              <th>时间</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event, idx) => (
              <tr key={idx}>
                <td>
                  <span
                    className={clsx(
                      'badge',
                      event.type === 'Normal' ? 'badge-success' : 'badge-warning'
                    )}
                  >
                    {event.type}
                  </span>
                </td>
                <td className="text-[var(--color-text-secondary)]">{event.reason}</td>
                <td className="max-w-md truncate text-[var(--color-text-muted)]">{event.message}</td>
                <td className="text-[var(--color-text-muted)]">{event.count || 1}</td>
                <td className="text-[var(--color-text-muted)]">
                  {event.lastTimestamp
                    ? formatDistanceToNow(new Date(event.lastTimestamp), {
                        addSuffix: true,
                        locale: zhCN,
                      })
                    : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {events.length === 0 && (
        <div className="text-center py-12 text-[var(--color-text-muted)]">暂无事件</div>
      )}
    </div>
  );
}

// 信息行组件
function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between">
      <dt className="text-[var(--color-text-muted)]">{label}</dt>
      <dd className={clsx(mono && 'font-mono text-sm')} style={{ color: 'var(--color-text-secondary)' }}>{value}</dd>
    </div>
  );
}
