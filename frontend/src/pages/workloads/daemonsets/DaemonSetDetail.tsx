import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { daemonSetApi } from '../../../api';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import clsx from 'clsx';
import type { DaemonSet, Pod, Event } from '../../../types';
import UpdateStrategyEditor from '../../../components/workloads/UpdateStrategyEditor';
import YamlEditorModal from '../../../components/common/YamlEditorModal';
import {
  ArrowLeftIcon,
  TrashIcon,
  ClipboardDocumentIcon,
  ArrowPathIcon,
  PencilIcon,
} from '@heroicons/react/24/outline';

type TabType = 'overview' | 'pods' | 'yaml' | 'events';

export default function DaemonSetDetail() {
  const { namespace, name } = useParams<{ namespace: string; name: string }>();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [showYamlEditor, setShowYamlEditor] = useState(false);
  const queryClient = useQueryClient();

  // 获取 DaemonSet 详情
  const { data: daemonSet, isLoading, error, refetch } = useQuery({
    queryKey: ['daemonset', namespace, name],
    queryFn: () => daemonSetApi.get(namespace!, name!),
    enabled: !!namespace && !!name,
  });

  // 获取 DaemonSet YAML
  const { data: yamlData } = useQuery({
    queryKey: ['daemonset-yaml', namespace, name],
    queryFn: () => daemonSetApi.getYaml(namespace!, name!),
    enabled: !!namespace && !!name,
  });

  // 获取关联的 Pods（使用后端 API）
  const { data: podsData } = useQuery({
    queryKey: ['daemonset-pods', namespace, name],
    queryFn: () => daemonSetApi.getPods(namespace!, name!),
    enabled: !!namespace && !!name && activeTab === 'pods',
  });

  // 获取事件
  const { data: eventsData } = useQuery({
    queryKey: ['daemonset-events', namespace, name],
    queryFn: () => daemonSetApi.getEvents(namespace!, name!),
    enabled: !!namespace && !!name && activeTab === 'events',
  });

  // 删除 DaemonSet
  const deleteMutation = useMutation({
    mutationFn: () => daemonSetApi.delete(namespace!, name!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daemonsets'] });
      window.history.back();
    },
  });

  // 重启 DaemonSet
  const restartMutation = useMutation({
    mutationFn: () => daemonSetApi.restart(namespace!, name!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daemonset', namespace, name] });
    },
  });

  // 更新 YAML
  const updateYamlMutation = useMutation({
    mutationFn: (yaml: string) => daemonSetApi.updateYaml(namespace!, name!, yaml),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daemonset', namespace, name] });
      queryClient.invalidateQueries({ queryKey: ['daemonset-yaml', namespace, name] });
      setShowYamlEditor(false);
    },
    onError: (error: Error) => {
      alert(`更新失败: ${error.message}`);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (error || !daemonSet) {
    return (
      <div className="card p-6 text-center">
        <p className="text-red-400">加载失败：{(error as Error)?.message || 'DaemonSet 不存在'}</p>
        <button onClick={() => refetch()} className="btn btn-primary mt-4">
          重试
        </button>
      </div>
    );
  }

  const tabs: { id: TabType; label: string }[] = [
    { id: 'overview', label: '概览' },
    { id: 'pods', label: 'Pods' },
    { id: 'yaml', label: 'YAML' },
    { id: 'events', label: '事件' },
  ];

  const isHealthy =
    daemonSet.status.numberReady === daemonSet.status.desiredNumberScheduled &&
    (daemonSet.status.desiredNumberScheduled || 0) > 0;

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/workloads/daemonsets"
            className="group p-2 bg-[color-mix(in_srgb,var(--color-bg-secondary)_60%,transparent)] backdrop-blur-sm hover:bg-[color-mix(in_srgb,var(--color-bg-tertiary)_80%,transparent)] border border-[color-mix(in_srgb,var(--color-border)_50%,transparent)] hover:border-border-hover rounded-lg transition-all duration-200 hover:scale-105"
          >
            <ArrowLeftIcon className="w-5 h-5 text-text-muted group-hover:text-white transition-colors" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-text-secondary bg-clip-text text-transparent">{name}</h1>
              <span className={clsx(
                'px-3 py-1 rounded-full text-xs font-semibold tracking-wide backdrop-blur-sm',
                isHealthy
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-lg shadow-emerald-500/10'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-lg shadow-amber-500/10'
              )}>
                {daemonSet.status.numberReady || 0}/{daemonSet.status.desiredNumberScheduled || 0} Ready
              </span>
            </div>
            <p className="text-text-muted mt-1.5 text-sm font-medium">命名空间: <span className="text-text-secondary">{namespace}</span></p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* 主要操作按钮组 */}
          <div className="flex items-center bg-[color-mix(in_srgb,var(--color-bg-secondary)_60%,transparent)] backdrop-blur-sm rounded-lg border border-[color-mix(in_srgb,var(--color-border)_50%,transparent)] shadow-xl overflow-hidden">
            <button
              onClick={() => {
                if (confirm('确定要重启此 DaemonSet 吗？')) {
                  restartMutation.mutate();
                }
              }}
              disabled={restartMutation.isPending}
              className="group relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-text-secondary hover:text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-600/0 via-cyan-600/10 to-cyan-600/0 opacity-0 group-hover:opacity-100 transition-opacity" />
              <ArrowPathIcon className={clsx('w-4 h-4 relative z-10 group-hover:scale-110 transition-transform', restartMutation.isPending && 'animate-spin')} />
              <span className="relative z-10">重启</span>
            </button>
          </div>

          {/* 删除按钮 */}
          <button
            onClick={() => {
              if (confirm('确定要删除此 DaemonSet 吗？')) {
                deleteMutation.mutate();
              }
            }}
            disabled={deleteMutation.isPending}
            className="group relative flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white rounded-lg text-sm font-semibold shadow-lg shadow-red-500/25 hover:shadow-red-500/40 transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity" />
            <TrashIcon className="w-4 h-4 relative z-10" />
            <span className="relative z-10">删除</span>
          </button>
        </div>
      </div>

      {/* 标签页导航 - 现代胶囊式设计 */}
      <div className="relative">
        {/* 背景装饰 */}
        <div className="absolute inset-0 bg-gradient-to-r from-[color-mix(in_srgb,var(--color-bg-secondary)_30%,transparent)] via-[color-mix(in_srgb,var(--color-bg-secondary)_10%,transparent)] to-[color-mix(in_srgb,var(--color-bg-secondary)_30%,transparent)] rounded-xl blur-xl" />
        <nav className="relative flex gap-2 p-1.5 bg-[color-mix(in_srgb,var(--color-bg-secondary)_40%,transparent)] backdrop-blur-xl border border-[color-mix(in_srgb,var(--color-border)_50%,transparent)] rounded-xl shadow-2xl">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'relative px-6 py-2.5 text-sm font-semibold rounded-lg transition-all duration-300',
                activeTab === tab.id
                  ? 'text-white shadow-lg'
                  : 'text-text-muted hover:text-text-secondary hover:bg-[color-mix(in_srgb,var(--color-bg-tertiary)_30%,transparent)]'
              )}
            >
              {/* 激活状态背景 */}
              {activeTab === tab.id && (
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 rounded-lg shadow-lg shadow-blue-500/30" />
              )}
              {/* 激活状态光晕 */}
              {activeTab === tab.id && (
                <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 via-blue-300/20 to-cyan-400/20 rounded-lg blur-md" />
              )}
              <span className="relative z-10">{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* 标签页内容 */}
      <div>
        {activeTab === 'overview' && <OverviewTab daemonSet={daemonSet} namespace={namespace!} name={name!} />}
        {activeTab === 'pods' && <PodsTab pods={podsData?.items || []} namespace={namespace!} />}
        {activeTab === 'yaml' && (
          <YamlTab
            yaml={yamlData || ''}
            onEditYaml={() => setShowYamlEditor(true)}
          />
        )}
        {activeTab === 'events' && <EventsTab events={eventsData?.items || []} />}
      </div>

      <YamlEditorModal
        isOpen={showYamlEditor}
        onClose={() => setShowYamlEditor(false)}
        onSave={async (yaml) => {
          await updateYamlMutation.mutateAsync(yaml);
        }}
        initialYaml={yamlData || ''}
        resourceType="DaemonSet"
        title={`编辑 DaemonSet - ${name}`}
        isPending={updateYamlMutation.isPending}
      />
    </div>
  );
}

// 概览标签页
function OverviewTab({ daemonSet, namespace, name }: { daemonSet: DaemonSet; namespace: string; name: string }) {
  // 获取更新策略
  const currentStrategy = {
    type: (daemonSet.spec.updateStrategy?.type || 'RollingUpdate') as 'RollingUpdate' | 'OnDelete',
    maxUnavailable: daemonSet.spec.updateStrategy?.rollingUpdate?.maxUnavailable?.toString() || '1',
    maxSurge: daemonSet.spec.updateStrategy?.rollingUpdate?.maxSurge?.toString(),
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 基本信息 */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">基本信息</h3>
        <dl className="space-y-3">
          <InfoRow label="名称" value={daemonSet.metadata.name} />
          <InfoRow label="命名空间" value={daemonSet.metadata.namespace || '-'} />
          <InfoRow label="UID" value={daemonSet.metadata.uid} mono />
          <InfoRow
            label="创建时间"
            value={formatDistanceToNow(new Date(daemonSet.metadata.creationTimestamp), {
              addSuffix: true,
              locale: zhCN,
            })}
          />
          <InfoRow label="更新策略" value={daemonSet.spec.updateStrategy?.type || 'RollingUpdate'} />
        </dl>
      </div>

      {/* 状态 */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">状态</h3>
        <dl className="space-y-3">
          <InfoRow label="期望节点数" value={`${daemonSet.status.desiredNumberScheduled || 0}`} />
          <InfoRow label="当前节点数" value={`${daemonSet.status.currentNumberScheduled || 0}`} />
          <InfoRow label="就绪数量" value={`${daemonSet.status.numberReady || 0}`} />
          <InfoRow label="可用数量" value={`${daemonSet.status.numberAvailable || 0}`} />
          <InfoRow label="更新数量" value={`${daemonSet.status.updatedNumberScheduled || 0}`} />
          <InfoRow label="错误调度" value={`${daemonSet.status.numberMisscheduled || 0}`} />
          <InfoRow label="观察代数" value={`${daemonSet.status.observedGeneration || 0}`} />
        </dl>
      </div>

      {/* 更新策略编辑器 */}
      <div className="lg:col-span-2">
        <UpdateStrategyEditor
          namespace={namespace}
          name={name}
          resourceType="DaemonSet"
          currentStrategy={currentStrategy}
        />
      </div>

      {/* 标签 */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">标签</h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(daemonSet.metadata.labels || {}).map(([key, value]) => (
            <span key={key} className="badge badge-default text-xs">
              {key}: {value}
            </span>
          ))}
          {!daemonSet.metadata.labels && <span className="text-text-muted">无标签</span>}
        </div>
      </div>

      {/* 选择器 */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">选择器</h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(daemonSet.spec.selector?.matchLabels || {}).map(([key, value]) => (
            <span key={key} className="badge badge-info text-xs">
              {key}: {value}
            </span>
          ))}
        </div>
      </div>

      {/* 节点选择器 */}
      {daemonSet.spec.template.spec.nodeSelector && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-white mb-4">节点选择器</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(daemonSet.spec.template.spec.nodeSelector).map(([key, value]) => (
              <span key={key} className="badge badge-warning text-xs">
                {key}: {value}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 容忍度 */}
      {daemonSet.spec.template.spec.tolerations && daemonSet.spec.template.spec.tolerations.length > 0 && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-white mb-4">容忍度</h3>
          <div className="space-y-2">
            {daemonSet.spec.template.spec.tolerations.map((toleration, index) => (
              <div key={index} className="bg-surface-secondary rounded p-2 text-sm">
                <span className="text-text-secondary">
                  {toleration.key || '*'}{toleration.operator === 'Exists' ? '' : `=${toleration.value}`}
                  :{toleration.effect || '*'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 容器模板 */}
      <div className="card p-6 lg:col-span-2">
        <h3 className="text-lg font-semibold text-white mb-4">容器模板</h3>
        <div className="space-y-4">
          {daemonSet.spec.template.spec.containers.map((container) => (
            <div key={container.name} className="bg-surface-secondary rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-medium text-white">{container.name}</span>
              </div>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <dt className="text-text-muted">镜像</dt>
                <dd className="text-text-secondary font-mono text-xs break-all">{container.image}</dd>
                {container.ports && container.ports.length > 0 && (
                  <>
                    <dt className="text-text-muted">端口</dt>
                    <dd className="text-text-secondary">
                      {container.ports.map((p) => `${p.containerPort}/${p.protocol || 'TCP'}`).join(', ')}
                    </dd>
                  </>
                )}
                {container.resources?.requests && (
                  <>
                    <dt className="text-text-muted">资源请求</dt>
                    <dd className="text-text-secondary">
                      CPU: {container.resources.requests.cpu || '-'},
                      内存: {container.resources.requests.memory || '-'}
                    </dd>
                  </>
                )}
                {container.resources?.limits && (
                  <>
                    <dt className="text-text-muted">资源限制</dt>
                    <dd className="text-text-secondary">
                      CPU: {container.resources.limits.cpu || '-'},
                      内存: {container.resources.limits.memory || '-'}
                    </dd>
                  </>
                )}
              </dl>
            </div>
          ))}
        </div>
      </div>

      {/* 条件状态 */}
      {daemonSet.status.conditions && daemonSet.status.conditions.length > 0 && (
        <div className="card p-6 lg:col-span-2">
          <h3 className="text-lg font-semibold text-white mb-4">条件状态</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-text-muted text-sm">
                  <th className="pb-3">类型</th>
                  <th className="pb-3">状态</th>
                  <th className="pb-3">原因</th>
                  <th className="pb-3">消息</th>
                  <th className="pb-3">最后更新</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {daemonSet.status.conditions.map((condition) => (
                  <tr key={condition.type} className="border-t border-border">
                    <td className="py-3 text-text-secondary">{condition.type}</td>
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
                    <td className="py-3 text-text-muted">{condition.reason || '-'}</td>
                    <td className="py-3 text-text-muted max-w-xs truncate">{condition.message || '-'}</td>
                    <td className="py-3 text-text-muted">
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
      )}
    </div>
  );
}

// Pods 标签页
function PodsTab({ pods, namespace }: { pods: Pod[]; namespace: string }) {
  // 获取 Pod 状态颜色（增强版：考虑容器 Ready 状态）
  const getPodStatusColor = (pod: Pod): string => {
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

    // 其他状态
    if (phase === 'Succeeded') return 'badge-info';
    if (phase === 'Failed') return 'badge-error';
    if (phase === 'Pending') return 'badge-warning';
    return 'badge-default';
  };

  return (
    <div className="card overflow-hidden">
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>名称</th>
              <th>状态</th>
              <th>Ready</th>
              <th>重启</th>
              <th>IP</th>
              <th>节点</th>
              <th>创建时间</th>
            </tr>
          </thead>
          <tbody>
            {pods.map((pod) => {
              const ready = pod.status.containerStatuses?.filter((c) => c.ready).length || 0;
              const total = pod.status.containerStatuses?.length || 0;
              const restarts = pod.status.containerStatuses?.reduce((sum, c) => sum + c.restartCount, 0) || 0;
              return (
                <tr key={pod.metadata.uid}>
                  <td>
                    <Link
                      to={`/workloads/pods/${namespace}/${pod.metadata.name}`}
                      className="text-blue-400 hover:text-blue-300"
                    >
                      {pod.metadata.name}
                    </Link>
                  </td>
                  <td>
                    <span className={clsx('badge', getPodStatusColor(pod))}>
                      {pod.status.phase}
                    </span>
                  </td>
                  <td>{ready}/{total}</td>
                  <td>{restarts}</td>
                  <td className="text-text-muted font-mono text-sm">{pod.status.podIP || '-'}</td>
                  <td className="text-text-muted">{pod.spec.nodeName || '-'}</td>
                  <td className="text-text-muted">
                    {formatDistanceToNow(new Date(pod.metadata.creationTimestamp), {
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
      {pods.length === 0 && (
        <div className="text-center py-12 text-text-muted">暂无 Pods</div>
      )}
    </div>
  );
}

// YAML 标签页
function YamlTab({ yaml, onEditYaml }: { yaml: string; onEditYaml: () => void }) {
  const [copied, setCopied] = useState(false);

  const copyYaml = () => {
    navigator.clipboard.writeText(yaml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative">
      {/* 浮动工具栏 - 毛玻璃效果 */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-1 px-2 py-1.5 bg-[color-mix(in_srgb,var(--color-bg-secondary)_60%,transparent)] backdrop-blur-xl border border-[color-mix(in_srgb,var(--color-border)_50%,transparent)] rounded-lg shadow-lg">
        {/* 复制按钮 */}
        <button
          onClick={copyYaml}
          className="group relative p-2 text-text-muted hover:text-blue-400 hover:bg-[color-mix(in_srgb,var(--color-bg-tertiary)_50%,transparent)] rounded-md transition-all duration-200 hover:scale-105"
          title="复制 YAML"
        >
          <ClipboardDocumentIcon className="w-4 h-4" />
          {copied && (
            <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-green-500 text-white text-xs rounded whitespace-nowrap">
              已复制
            </span>
          )}
        </button>

        {/* 分隔线 */}
        <div className="w-px h-4 bg-[color-mix(in_srgb,var(--color-bg-tertiary)_50%,transparent)]" />

        {/* 编辑按钮 */}
        <button
          onClick={onEditYaml}
          className="group relative p-2 text-text-muted hover:text-blue-400 hover:bg-[color-mix(in_srgb,var(--color-bg-tertiary)_50%,transparent)] rounded-md transition-all duration-200 hover:scale-105"
          title="编辑 YAML"
        >
          <PencilIcon className="w-4 h-4" />
        </button>
      </div>

      {/* YAML 代码块 */}
      <div className="card p-6 bg-surface-tertiary max-h-[600px] overflow-y-auto border border-[color-mix(in_srgb,var(--color-border)_55%,transparent)]">
        <pre className="text-sm text-text-secondary font-mono whitespace-pre-wrap break-words leading-relaxed">{yaml || '加载中...'}</pre>
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
              <th>最后发生时间</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event, index) => (
              <tr key={event.metadata.uid || index}>
                <td>
                  <span
                    className={clsx(
                      'badge',
                      event.type === 'Warning' ? 'badge-warning' : 'badge-success'
                    )}
                  >
                    {event.type}
                  </span>
                </td>
                <td className="text-text-secondary">{event.reason}</td>
                <td className="text-text-muted max-w-md truncate">{event.message}</td>
                <td className="text-text-muted">{event.count || 1}</td>
                <td className="text-text-muted">
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
        <div className="text-center py-12 text-text-muted">暂无事件</div>
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
      <dt className="text-text-muted">{label}</dt>
      <dd className={clsx('text-text-secondary', mono && 'font-mono text-sm')}>{value}</dd>
    </div>
  );
}
