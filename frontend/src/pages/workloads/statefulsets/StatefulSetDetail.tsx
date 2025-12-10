import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { statefulSetApi, podApi } from '../../../api';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import clsx from 'clsx';
import type { StatefulSet, Pod } from '../../../types';
import {
  ArrowLeftIcon,
  TrashIcon,
  ClipboardDocumentIcon,
  PlusIcon,
  MinusIcon,
} from '@heroicons/react/24/outline';

type TabType = 'overview' | 'pods' | 'yaml' | 'events';

export default function StatefulSetDetail() {
  const { namespace, name } = useParams<{ namespace: string; name: string }>();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [showScaleModal, setShowScaleModal] = useState(false);
  const [newReplicas, setNewReplicas] = useState(0);
  const queryClient = useQueryClient();

  // 获取 StatefulSet 详情
  const { data: statefulSet, isLoading, error, refetch } = useQuery({
    queryKey: ['statefulset', namespace, name],
    queryFn: () => statefulSetApi.get(namespace!, name!),
    enabled: !!namespace && !!name,
  });

  // 获取 StatefulSet YAML
  const { data: yamlData } = useQuery({
    queryKey: ['statefulset-yaml', namespace, name],
    queryFn: () => statefulSetApi.getYaml(namespace!, name!),
    enabled: !!namespace && !!name && activeTab === 'yaml',
  });

  // 获取关联的 Pods（通过标签选择器过滤）
  const { data: podsData } = useQuery({
    queryKey: ['statefulset-pods', namespace, name],
    queryFn: async () => {
      const allPods = await podApi.list(namespace!);
      // 根据 StatefulSet 名称过滤 Pods
      const filteredPods = allPods.items.filter(pod =>
        pod.metadata.name.startsWith(name! + '-')
      );
      return { items: filteredPods };
    },
    enabled: !!namespace && !!name && activeTab === 'pods',
  });

  // 删除 StatefulSet
  const deleteMutation = useMutation({
    mutationFn: () => statefulSetApi.delete(namespace!, name!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['statefulsets'] });
      window.history.back();
    },
  });

  // 扩缩容
  const scaleMutation = useMutation({
    mutationFn: (replicas: number) =>
      statefulSetApi.scale(namespace!, name!, { replicas }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['statefulset', namespace, name] });
      setShowScaleModal(false);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (error || !statefulSet) {
    return (
      <div className="card p-6 text-center">
        <p className="text-red-400">加载失败：{(error as Error)?.message || 'StatefulSet 不存在'}</p>
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
    statefulSet.status.readyReplicas === statefulSet.status.replicas &&
    (statefulSet.status.replicas || 0) > 0;

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/workloads/statefulsets" className="btn btn-secondary p-2">
            <ArrowLeftIcon className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{name}</h1>
              <span className={clsx('badge', isHealthy ? 'badge-success' : 'badge-warning')}>
                {statefulSet.status.readyReplicas || 0}/{statefulSet.status.replicas || 0} Ready
              </span>
            </div>
            <p className="text-slate-400 mt-1">命名空间: {namespace}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setNewReplicas(statefulSet.spec.replicas || 0);
              setShowScaleModal(true);
            }}
            className="btn btn-secondary"
          >
            扩缩容
          </button>
          <button
            onClick={() => {
              if (confirm('确定要删除此 StatefulSet 吗？')) {
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
        {activeTab === 'overview' && <OverviewTab statefulSet={statefulSet} />}
        {activeTab === 'pods' && <PodsTab pods={podsData?.items || []} namespace={namespace!} />}
        {activeTab === 'yaml' && <YamlTab yaml={yamlData || ''} />}
        {activeTab === 'events' && <EventsTab namespace={namespace!} name={name!} />}
      </div>

      {/* 扩缩容模态框 */}
      {showScaleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="card p-6 w-96">
            <h3 className="text-lg font-semibold text-white mb-4">扩缩容</h3>
            <div className="flex items-center justify-center gap-4 mb-6">
              <button
                onClick={() => setNewReplicas(Math.max(0, newReplicas - 1))}
                className="btn btn-secondary p-2"
              >
                <MinusIcon className="w-5 h-5" />
              </button>
              <input
                type="number"
                value={newReplicas}
                onChange={(e) => setNewReplicas(parseInt(e.target.value) || 0)}
                className="input w-24 text-center text-2xl"
                min="0"
              />
              <button
                onClick={() => setNewReplicas(newReplicas + 1)}
                className="btn btn-secondary p-2"
              >
                <PlusIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowScaleModal(false)}
                className="btn btn-secondary flex-1"
              >
                取消
              </button>
              <button
                onClick={() => scaleMutation.mutate(newReplicas)}
                className="btn btn-primary flex-1"
                disabled={scaleMutation.isPending}
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 概览标签页
function OverviewTab({ statefulSet }: { statefulSet: StatefulSet }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 基本信息 */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">基本信息</h3>
        <dl className="space-y-3">
          <InfoRow label="名称" value={statefulSet.metadata.name} />
          <InfoRow label="命名空间" value={statefulSet.metadata.namespace} />
          <InfoRow label="UID" value={statefulSet.metadata.uid} mono />
          <InfoRow
            label="创建时间"
            value={formatDistanceToNow(new Date(statefulSet.metadata.creationTimestamp), {
              addSuffix: true,
              locale: zhCN,
            })}
          />
          <InfoRow label="副本数" value={`${statefulSet.spec.replicas || 0}`} />
          <InfoRow label="服务名称" value={statefulSet.spec.serviceName || '-'} />
          <InfoRow label="Pod 管理策略" value={statefulSet.spec.podManagementPolicy || 'OrderedReady'} />
          <InfoRow label="更新策略" value={statefulSet.spec.updateStrategy?.type || 'RollingUpdate'} />
        </dl>
      </div>

      {/* 状态 */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">状态</h3>
        <dl className="space-y-3">
          <InfoRow label="期望副本数" value={`${statefulSet.status.replicas || 0}`} />
          <InfoRow label="就绪副本数" value={`${statefulSet.status.readyReplicas || 0}`} />
          <InfoRow label="当前副本数" value={`${statefulSet.status.currentReplicas || 0}`} />
          <InfoRow label="更新副本数" value={`${statefulSet.status.updatedReplicas || 0}`} />
          <InfoRow label="当前修订版本" value={statefulSet.status.currentRevision || '-'} />
          <InfoRow label="更新修订版本" value={statefulSet.status.updateRevision || '-'} />
          <InfoRow label="观察代数" value={`${statefulSet.status.observedGeneration || 0}`} />
        </dl>
      </div>

      {/* 标签 */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">标签</h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(statefulSet.metadata.labels || {}).map(([key, value]) => (
            <span key={key} className="badge badge-default text-xs">
              {key}: {value}
            </span>
          ))}
          {!statefulSet.metadata.labels && <span className="text-slate-500">无标签</span>}
        </div>
      </div>

      {/* 选择器 */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">选择器</h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(statefulSet.spec.selector?.matchLabels || {}).map(([key, value]) => (
            <span key={key} className="badge badge-info text-xs">
              {key}: {value}
            </span>
          ))}
        </div>
      </div>

      {/* 容器模板 */}
      <div className="card p-6 lg:col-span-2">
        <h3 className="text-lg font-semibold text-white mb-4">容器模板</h3>
        <div className="space-y-4">
          {statefulSet.spec.template.spec.containers.map((container) => (
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

      {/* 持久卷声明模板 */}
      {statefulSet.spec.volumeClaimTemplates && statefulSet.spec.volumeClaimTemplates.length > 0 && (
        <div className="card p-6 lg:col-span-2">
          <h3 className="text-lg font-semibold text-white mb-4">持久卷声明模板</h3>
          <div className="space-y-4">
            {statefulSet.spec.volumeClaimTemplates.map((pvc, index) => (
              <div key={index} className="bg-slate-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium text-white">{pvc.metadata?.name || `pvc-${index}`}</span>
                </div>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <dt className="text-slate-400">存储类</dt>
                  <dd className="text-slate-200">{pvc.spec?.storageClassName || '-'}</dd>
                  <dt className="text-slate-400">访问模式</dt>
                  <dd className="text-slate-200">{pvc.spec?.accessModes?.join(', ') || '-'}</dd>
                  <dt className="text-slate-400">容量请求</dt>
                  <dd className="text-slate-200">{pvc.spec?.resources?.requests?.storage || '-'}</dd>
                </dl>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 条件状态 */}
      {statefulSet.status.conditions && statefulSet.status.conditions.length > 0 && (
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
                {statefulSet.status.conditions.map((condition) => (
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
