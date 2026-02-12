import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { statefulSetApi } from '../../../api';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import clsx from 'clsx';
import type { StatefulSet, Pod, Event } from '../../../types';
import UpdateStrategyEditor from '../../../components/workloads/UpdateStrategyEditor';
import RevisionHistory from '../../../components/workloads/RevisionHistory';
import YamlEditorModal from '../../../components/common/YamlEditorModal';
import {
  ArrowLeftIcon,
  TrashIcon,
  ClipboardDocumentIcon,
  PlusIcon,
  MinusIcon,
  ArrowPathIcon,
  PencilIcon,
  ArrowsPointingOutIcon,
} from '@heroicons/react/24/outline';

type TabType = 'overview' | 'pods' | 'yaml' | 'events';

export default function StatefulSetDetail() {
  const { namespace, name } = useParams<{ namespace: string; name: string }>();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [showScaleModal, setShowScaleModal] = useState(false);
  const [newReplicas, setNewReplicas] = useState(0);
  const [showYamlEditor, setShowYamlEditor] = useState(false);
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
    enabled: !!namespace && !!name,
  });

  // 获取关联的 Pods（使用后端 API）
  const { data: podsData } = useQuery({
    queryKey: ['statefulset-pods', namespace, name],
    queryFn: () => statefulSetApi.getPods(namespace!, name!),
    enabled: !!namespace && !!name && activeTab === 'pods',
  });

  // 获取事件
  const { data: eventsData } = useQuery({
    queryKey: ['statefulset-events', namespace, name],
    queryFn: () => statefulSetApi.getEvents(namespace!, name!),
    enabled: !!namespace && !!name && activeTab === 'events',
  });

  // 删除 StatefulSet
  const deleteMutation = useMutation({
    mutationFn: () => statefulSetApi.delete(namespace!, name!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['statefulsets'] });
      window.history.back();
    },
  });

  // 重启 StatefulSet
  const restartMutation = useMutation({
    mutationFn: () => statefulSetApi.restart(namespace!, name!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['statefulset', namespace, name] });
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

  // 更新 YAML
  const updateYamlMutation = useMutation({
    mutationFn: (yaml: string) => statefulSetApi.updateYaml(namespace!, name!, yaml),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['statefulset', namespace, name] });
      queryClient.invalidateQueries({ queryKey: ['statefulset-yaml', namespace, name] });
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
          <Link
            to="/workloads/statefulsets"
            className="group p-2 bg-slate-800/60 backdrop-blur-sm hover:bg-slate-700/80 border border-slate-700/50 hover:border-slate-600 rounded-lg transition-all duration-200 hover:scale-105"
          >
            <ArrowLeftIcon className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">{name}</h1>
              <span className={clsx(
                'px-3 py-1 rounded-full text-xs font-semibold tracking-wide backdrop-blur-sm',
                isHealthy
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-lg shadow-emerald-500/10'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-lg shadow-amber-500/10'
              )}>
                {statefulSet.status.readyReplicas || 0}/{statefulSet.status.replicas || 0} Ready
              </span>
            </div>
            <p className="text-slate-400 mt-1.5 text-sm font-medium">命名空间: <span className="text-slate-300">{namespace}</span></p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* 主要操作按钮组 */}
          <div className="flex items-center bg-slate-800/60 backdrop-blur-sm rounded-lg border border-slate-700/50 shadow-xl overflow-hidden">
            <button
              onClick={() => {
                setNewReplicas(statefulSet.spec.replicas || 0);
                setShowScaleModal(true);
              }}
              className="group relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-300 hover:text-white transition-all duration-200 border-r border-slate-700/50 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600/0 via-blue-600/10 to-blue-600/0 opacity-0 group-hover:opacity-100 transition-opacity" />
              <ArrowsPointingOutIcon className="w-4 h-4 relative z-10 group-hover:scale-110 transition-transform" />
              <span className="relative z-10">扩缩容</span>
            </button>
            <button
              onClick={() => {
                if (confirm('确定要重启此 StatefulSet 吗？')) {
                  restartMutation.mutate();
                }
              }}
              disabled={restartMutation.isPending}
              className="group relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-300 hover:text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-600/0 via-cyan-600/10 to-cyan-600/0 opacity-0 group-hover:opacity-100 transition-opacity" />
              <ArrowPathIcon className={clsx('w-4 h-4 relative z-10 group-hover:scale-110 transition-transform', restartMutation.isPending && 'animate-spin')} />
              <span className="relative z-10">重启</span>
            </button>
          </div>

          {/* 删除按钮 */}
          <button
            onClick={() => {
              if (confirm('确定要删除此 StatefulSet 吗？')) {
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
        <div className="absolute inset-0 bg-gradient-to-r from-slate-800/30 via-slate-800/10 to-slate-800/30 rounded-xl blur-xl" />
        <nav className="relative flex gap-2 p-1.5 bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 rounded-xl shadow-2xl">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'relative px-6 py-2.5 text-sm font-semibold rounded-lg transition-all duration-300',
                activeTab === tab.id
                  ? 'text-white shadow-lg'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/30'
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
        {activeTab === 'overview' && <OverviewTab statefulSet={statefulSet} namespace={namespace!} name={name!} />}
        {activeTab === 'pods' && <PodsTab pods={podsData?.items || []} namespace={namespace!} />}
        {activeTab === 'yaml' && (
          <YamlTab
            yaml={yamlData || ''}
            onEditYaml={() => setShowYamlEditor(true)}
          />
        )}
        {activeTab === 'events' && <EventsTab events={eventsData?.items || []} />}
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

      <YamlEditorModal
        isOpen={showYamlEditor}
        onClose={() => setShowYamlEditor(false)}
        onSave={async (yaml) => {
          await updateYamlMutation.mutateAsync(yaml);
        }}
        initialYaml={yamlData || ''}
        resourceType="StatefulSet"
        title={`编辑 StatefulSet - ${name}`}
        isPending={updateYamlMutation.isPending}
      />
    </div>
  );
}

// 概览标签页
function OverviewTab({ statefulSet, namespace, name }: { statefulSet: StatefulSet; namespace: string; name: string }) {
  // 获取更新策略
  const currentStrategy = {
    type: (statefulSet.spec.updateStrategy?.type || 'RollingUpdate') as 'RollingUpdate' | 'OnDelete',
    partition: statefulSet.spec.updateStrategy?.rollingUpdate?.partition ?? 0,
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 基本信息 */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">基本信息</h3>
        <dl className="space-y-3">
          <InfoRow label="名称" value={statefulSet.metadata.name} />
          <InfoRow label="命名空间" value={statefulSet.metadata.namespace || '-'} />
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

      {/* 更新策略编辑器 */}
      <div className="lg:col-span-2">
        <UpdateStrategyEditor
          namespace={namespace}
          name={name}
          resourceType="StatefulSet"
          currentStrategy={currentStrategy}
        />
      </div>

      {/* 修订历史 */}
      <div className="lg:col-span-2">
        <RevisionHistory
          namespace={namespace}
          name={name}
          resourceType="StatefulSet"
        />
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
      <div className="absolute top-4 right-4 z-10 flex items-center gap-1 px-2 py-1.5 bg-slate-800/60 backdrop-blur-xl border border-slate-700/50 rounded-lg shadow-lg">
        {/* 复制按钮 */}
        <button
          onClick={copyYaml}
          className="group relative p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-700/50 rounded-md transition-all duration-200 hover:scale-105"
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
        <div className="w-px h-4 bg-slate-700/50" />

        {/* 编辑按钮 */}
        <button
          onClick={onEditYaml}
          className="group relative p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-700/50 rounded-md transition-all duration-200 hover:scale-105"
          title="编辑 YAML"
        >
          <PencilIcon className="w-4 h-4" />
        </button>
      </div>

      {/* YAML 代码块 */}
      <div className="card p-6 bg-slate-900 max-h-[600px] overflow-y-auto border border-slate-800/50">
        <pre className="text-sm text-slate-300 font-mono whitespace-pre-wrap break-words leading-relaxed">{yaml || '加载中...'}</pre>
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
