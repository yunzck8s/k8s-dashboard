import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { podApi } from '../../../api';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import clsx from 'clsx';
import type { Pod, Event, PodPhase } from '../../../types';
import PodTerminal from '../../../components/terminal/PodTerminal';
import {
  ArrowLeftIcon,
  TrashIcon,
  ArrowPathIcon,
  ClipboardDocumentIcon,
} from '@heroicons/react/24/outline';

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
  const { data: logsData, refetch: refetchLogs } = useQuery({
    queryKey: ['pod-logs', namespace, name, selectedContainer],
    queryFn: () => podApi.getLogs(namespace!, name!, selectedContainer, 500),
    enabled: !!namespace && !!name && !!selectedContainer && activeTab === 'logs',
  });

  // 删除 Pod
  const deleteMutation = useMutation({
    mutationFn: () => podApi.delete(namespace!, name!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pods'] });
      window.history.back();
    },
  });

  // 设置默认容器
  if (pod && !selectedContainer && pod.spec.containers.length > 0) {
    setSelectedContainer(pod.spec.containers[0].name);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (error || !pod) {
    return (
      <div className="card p-6 text-center">
        <p className="text-red-400">加载失败：{(error as Error)?.message || 'Pod 不存在'}</p>
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
              <h1 className="text-2xl font-bold text-white">{name}</h1>
              <span className={clsx('badge', phaseColors[pod.status.phase])}>
                {pod.status.phase}
              </span>
            </div>
            <p className="text-slate-400 mt-1">
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
      <div className="border-b border-slate-700">
        <nav className="flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-slate-400 hover:text-slate-300'
              )}
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
            selectedContainer={selectedContainer}
            onContainerChange={setSelectedContainer}
            onRefresh={() => refetchLogs()}
          />
        )}
        {activeTab === 'terminal' && (
          <div className="card overflow-hidden" style={{ minHeight: '500px' }}>
            <div className="p-4 border-b border-slate-700">
              <div className="flex items-center gap-4">
                <label className="text-sm text-slate-400">选择容器:</label>
                <select
                  value={selectedContainer}
                  onChange={(e) => setSelectedContainer(e.target.value)}
                  className="bg-slate-700 border-slate-600 rounded px-3 py-1.5 text-sm text-white"
                >
                  {pod.spec.containers.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {selectedContainer && (
              <PodTerminal
                namespace={namespace!}
                name={name!}
                container={selectedContainer}
              />
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
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">基本信息</h3>
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
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-white mb-4">标签</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(pod.metadata.labels || {}).map(([key, value]) => (
              <span key={key} className="badge badge-default text-xs">
                {key}: {value}
              </span>
            ))}
            {!pod.metadata.labels && (
              <span className="text-slate-500">无标签</span>
            )}
          </div>
        </div>

        <div className="card p-6">
          <h3 className="text-lg font-semibold text-white mb-4">注解</h3>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {Object.entries(pod.metadata.annotations || {}).map(([key, value]) => (
              <div key={key} className="text-sm">
                <span className="text-slate-400">{key}:</span>
                <span className="text-slate-300 ml-2 break-all">{value}</span>
              </div>
            ))}
            {!pod.metadata.annotations && (
              <span className="text-slate-500">无注解</span>
            )}
          </div>
        </div>
      </div>

      {/* 条件状态 */}
      <div className="card p-6 lg:col-span-2">
        <h3 className="text-lg font-semibold text-white mb-4">条件状态</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-slate-400 text-sm">
                <th className="pb-3">类型</th>
                <th className="pb-3">状态</th>
                <th className="pb-3">原因</th>
                <th className="pb-3">最后转换时间</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {pod.status.conditions?.map((condition) => (
                <tr key={condition.type} className="border-t border-slate-700">
                  <td className="py-3 text-slate-300">{condition.type}</td>
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
                  <td className="py-3 text-slate-400">{condition.reason || '-'}</td>
                  <td className="py-3 text-slate-400">
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
          <div key={container.name} className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold text-white">{container.name}</h3>
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
                <span className="text-slate-400 text-sm">
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
                  <dt className="text-sm text-slate-400">端口</dt>
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
                  <dt className="text-sm text-slate-400 mb-2">资源</dt>
                  <dd className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-500">请求:</span>
                      <span className="text-slate-300 ml-2">
                        CPU: {container.resources.requests?.cpu || '-'},
                        内存: {container.resources.requests?.memory || '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">限制:</span>
                      <span className="text-slate-300 ml-2">
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
                  <dt className="text-sm text-slate-400 mb-2">环境变量</dt>
                  <dd className="bg-slate-800 rounded p-3 max-h-40 overflow-y-auto">
                    {container.env.map((env, idx) => (
                      <div key={idx} className="text-sm font-mono">
                        <span className="text-blue-400">{env.name}</span>
                        <span className="text-slate-500">=</span>
                        <span className="text-slate-300">
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
                  <dt className="text-sm text-slate-400 mb-2">挂载卷</dt>
                  <dd className="space-y-1">
                    {container.volumeMounts.map((mount, idx) => (
                      <div key={idx} className="text-sm">
                        <span className="text-slate-300 font-mono">{mount.mountPath}</span>
                        <span className="text-slate-500 ml-2">← {mount.name}</span>
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
          <label className="text-slate-400">容器:</label>
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

      <div className="card p-4 bg-slate-900 max-h-[600px] overflow-auto">
        <pre className="text-sm text-slate-300 font-mono whitespace-pre-wrap">
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
      <div className="card p-4 bg-slate-900 max-h-[600px] overflow-auto">
        <pre className="text-sm text-slate-300 font-mono">{yaml || '加载中...'}</pre>
      </div>
    </div>
  );
}

// 事件标签页
function EventsTab({ events }: { events: Event[] }) {
  return (
    <div className="card overflow-hidden">
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
                <td className="text-slate-300">{event.reason}</td>
                <td className="text-slate-400 max-w-md truncate">{event.message}</td>
                <td className="text-slate-400">{event.count || 1}</td>
                <td className="text-slate-400">
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
        <div className="text-center py-12 text-slate-400">暂无事件</div>
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
      <dt className="text-slate-400">{label}</dt>
      <dd className={clsx('text-slate-200', mono && 'font-mono text-sm')}>{value}</dd>
    </div>
  );
}
