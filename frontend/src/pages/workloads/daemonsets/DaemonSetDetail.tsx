import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { daemonSetApi, podApi } from '../../../api';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import clsx from 'clsx';
import type { DaemonSet, Pod } from '../../../types';
import {
  ArrowLeftIcon,
  TrashIcon,
  ClipboardDocumentIcon,
} from '@heroicons/react/24/outline';

type TabType = 'overview' | 'pods' | 'yaml' | 'events';

export default function DaemonSetDetail() {
  const { namespace, name } = useParams<{ namespace: string; name: string }>();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
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
    enabled: !!namespace && !!name && activeTab === 'yaml',
  });

  // 获取关联的 Pods（通过标签选择器过滤）
  const { data: podsData } = useQuery({
    queryKey: ['daemonset-pods', namespace, name],
    queryFn: async () => {
      const allPods = await podApi.list(namespace!);
      // 根据 ownerReferences 或标签过滤 DaemonSet 的 Pods
      const filteredPods = allPods.items.filter(pod => {
        const ownerRefs = pod.metadata.ownerReferences || [];
        return ownerRefs.some(ref => ref.kind === 'DaemonSet' && ref.name === name);
      });
      return { items: filteredPods };
    },
    enabled: !!namespace && !!name && activeTab === 'pods',
  });

  // 删除 DaemonSet
  const deleteMutation = useMutation({
    mutationFn: () => daemonSetApi.delete(namespace!, name!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daemonsets'] });
      window.history.back();
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
          <Link to="/workloads/daemonsets" className="btn btn-secondary p-2">
            <ArrowLeftIcon className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{name}</h1>
              <span className={clsx('badge', isHealthy ? 'badge-success' : 'badge-warning')}>
                {daemonSet.status.numberReady || 0}/{daemonSet.status.desiredNumberScheduled || 0} Ready
              </span>
            </div>
            <p className="text-slate-400 mt-1">命名空间: {namespace}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (confirm('确定要删除此 DaemonSet 吗？')) {
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
        {activeTab === 'overview' && <OverviewTab daemonSet={daemonSet} />}
        {activeTab === 'pods' && <PodsTab pods={podsData?.items || []} namespace={namespace!} />}
        {activeTab === 'yaml' && <YamlTab yaml={yamlData || ''} />}
        {activeTab === 'events' && <EventsTab namespace={namespace!} name={name!} />}
      </div>
    </div>
  );
}

// 概览标签页
function OverviewTab({ daemonSet }: { daemonSet: DaemonSet }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 基本信息 */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">基本信息</h3>
        <dl className="space-y-3">
          <InfoRow label="名称" value={daemonSet.metadata.name} />
          <InfoRow label="命名空间" value={daemonSet.metadata.namespace} />
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

      {/* 标签 */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">标签</h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(daemonSet.metadata.labels || {}).map(([key, value]) => (
            <span key={key} className="badge badge-default text-xs">
              {key}: {value}
            </span>
          ))}
          {!daemonSet.metadata.labels && <span className="text-slate-500">无标签</span>}
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
              <div key={index} className="bg-slate-800 rounded p-2 text-sm">
                <span className="text-slate-300">
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
            <div key={container.name} className="bg-slate-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-medium text-white">{container.name}</span>
              </div>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <dt className="text-slate-400">镜像</dt>
                <dd className="text-slate-200 font-mono text-xs break-all">{container.image}</dd>
                {container.ports && container.ports.length > 0 && (
                  <>
                    <dt className="text-slate-400">端口</dt>
                    <dd className="text-slate-200">
                      {container.ports.map((p) => `${p.containerPort}/${p.protocol || 'TCP'}`).join(', ')}
                    </dd>
                  </>
                )}
                {container.resources?.requests && (
                  <>
                    <dt className="text-slate-400">资源请求</dt>
                    <dd className="text-slate-200">
                      CPU: {container.resources.requests.cpu || '-'},
                      内存: {container.resources.requests.memory || '-'}
                    </dd>
                  </>
                )}
                {container.resources?.limits && (
                  <>
                    <dt className="text-slate-400">资源限制</dt>
                    <dd className="text-slate-200">
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
                <tr className="text-left text-slate-400 text-sm">
                  <th className="pb-3">类型</th>
                  <th className="pb-3">状态</th>
                  <th className="pb-3">原因</th>
                  <th className="pb-3">消息</th>
                  <th className="pb-3">最后更新</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {daemonSet.status.conditions.map((condition) => (
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
                    <td className="py-3 text-slate-400 max-w-xs truncate">{condition.message || '-'}</td>
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
      )}
    </div>
  );
}

// Pods 标签页
function PodsTab({ pods, namespace }: { pods: Pod[]; namespace: string }) {
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
                    <span
                      className={clsx(
                        'badge',
                        pod.status.phase === 'Running' ? 'badge-success' : 'badge-warning'
                      )}
                    >
                      {pod.status.phase}
                    </span>
                  </td>
                  <td>{ready}/{total}</td>
                  <td>{restarts}</td>
                  <td className="text-slate-400 font-mono text-sm">{pod.status.podIP || '-'}</td>
                  <td className="text-slate-400">{pod.spec.nodeName || '-'}</td>
                  <td className="text-slate-400">
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
        <div className="text-center py-12 text-slate-400">暂无 Pods</div>
      )}
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
function EventsTab({ namespace, name }: { namespace: string; name: string }) {
  return (
    <div className="card p-6 text-center">
      <p className="text-slate-400">事件功能正在开发中...</p>
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
