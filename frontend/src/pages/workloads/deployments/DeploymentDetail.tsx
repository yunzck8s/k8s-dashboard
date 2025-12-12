import { useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { deploymentApi } from '../../../api';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import clsx from 'clsx';
import type { Deployment, Pod } from '../../../types';
import UpdateStrategyEditor from '../../../components/workloads/UpdateStrategyEditor';
import RevisionHistory from '../../../components/workloads/RevisionHistory';
import ActionDropdown from '../../../components/common/ActionDropdown';
import EditImageModal from '../../../components/workloads/EditImageModal';
import SchedulingEditor from '../../../components/workloads/SchedulingEditor';
import YamlEditorModal from '../../../components/common/YamlEditorModal';
import {
  ArrowLeftIcon,
  TrashIcon,
  ArrowPathIcon,
  ClipboardDocumentIcon,
  PencilIcon,
  PlusIcon,
  MinusIcon,
  PauseIcon,
  PlayIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  PhotoIcon,
  ServerIcon,
  ArrowsPointingOutIcon,
  EllipsisVerticalIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline';

type TabType = 'overview' | 'pods' | 'yaml' | 'events';

export default function DeploymentDetail() {
  const { namespace, name } = useParams<{ namespace: string; name: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showScaleModal, setShowScaleModal] = useState(false);
  const [showRestartModal, setShowRestartModal] = useState(false);
  const [showEditImageModal, setShowEditImageModal] = useState(false);
  const [showSchedulingEditor, setShowSchedulingEditor] = useState(false);
  const [showYamlEditor, setShowYamlEditor] = useState(false);
  const [newReplicas, setNewReplicas] = useState(0);
  const queryClient = useQueryClient();

  // 从 URL 参数读取当前标签，默认为 'overview'
  const activeTab = (searchParams.get('tab') as TabType) || 'overview';

  // 设置标签并同步到 URL 参数
  const setActiveTab = (tab: TabType) => {
    setSearchParams({ tab });
  };

  // 获取 Deployment 详情
  const { data: deployment, isLoading, error, refetch } = useQuery({
    queryKey: ['deployment', namespace, name],
    queryFn: () => deploymentApi.get(namespace!, name!),
    enabled: !!namespace && !!name,
  });

  // 获取 Deployment YAML
  const { data: yamlData } = useQuery({
    queryKey: ['deployment-yaml', namespace, name],
    queryFn: () => deploymentApi.getYaml(namespace!, name!),
    enabled: !!namespace && !!name,
  });

  // 获取关联的 Pods
  const { data: podsData } = useQuery({
    queryKey: ['deployment-pods', namespace, name],
    queryFn: () => deploymentApi.getPods(namespace!, name!),
    enabled: !!namespace && !!name && activeTab === 'pods',
    refetchInterval: 5000, // 每5秒自动刷新一次，便于观察 Pod 状态变化
  });

  // 删除 Deployment
  const deleteMutation = useMutation({
    mutationFn: () => deploymentApi.delete(namespace!, name!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deployments'] });
      window.history.back();
    },
  });

  // 扩缩容
  const scaleMutation = useMutation({
    mutationFn: (replicas: number) =>
      deploymentApi.scale(namespace!, name!, { replicas }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deployment', namespace, name] });
      setShowScaleModal(false);
    },
  });

  // 重启
  const restartMutation = useMutation({
    mutationFn: () => deploymentApi.restart(namespace!, name!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deployment', namespace, name] });
      queryClient.invalidateQueries({ queryKey: ['deployment-pods', namespace, name] });
      setShowRestartModal(false);
      // 重启成功后自动切换到 pods 标签，让用户看到新的 pods
      setActiveTab('pods');
    },
  });

  // 暂停
  const pauseMutation = useMutation({
    mutationFn: () => deploymentApi.pause(namespace!, name!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deployment', namespace, name] });
    },
  });

  // 恢复
  const resumeMutation = useMutation({
    mutationFn: () => deploymentApi.resume(namespace!, name!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deployment', namespace, name] });
    },
  });

  // 修改镜像
  const updateImageMutation = useMutation({
    mutationFn: (containers: Array<{ name: string; image: string }>) =>
      deploymentApi.updateImage(namespace!, name!, containers),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deployment', namespace, name] });
      setShowEditImageModal(false);
    },
    onError: (error: Error) => {
      alert(`更新镜像失败: ${error.message}`);
    },
  });

  // 更新调度配置
  const updateSchedulingMutation = useMutation({
    mutationFn: (data: { nodeSelector?: Record<string, string>; tolerations?: Array<{ key?: string; operator?: string; value?: string; effect?: string }> }) =>
      deploymentApi.updateScheduling(namespace!, name!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deployment', namespace, name] });
      setShowSchedulingEditor(false);
    },
    onError: (error: Error) => {
      alert(`更新调度配置失败: ${error.message}`);
    },
  });

  const updateYamlMutation = useMutation({
    mutationFn: (yaml: string) => deploymentApi.updateYaml(namespace!, name!, yaml),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deployment', namespace, name] });
      queryClient.invalidateQueries({ queryKey: ['deployment-yaml', namespace, name] });
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

  if (error || !deployment) {
    return (
      <div className="card p-6 text-center">
        <p className="text-red-400">加载失败：{(error as Error)?.message || 'Deployment 不存在'}</p>
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
    deployment.status.readyReplicas === deployment.status.replicas &&
    deployment.status.replicas > 0;

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/workloads/deployments"
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
                {deployment.status.readyReplicas || 0}/{deployment.status.replicas || 0} Ready
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
                setNewReplicas(deployment.spec.replicas || 0);
                setShowScaleModal(true);
              }}
              className="group relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-300 hover:text-white transition-all duration-200 border-r border-slate-700/50 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600/0 via-blue-600/10 to-blue-600/0 opacity-0 group-hover:opacity-100 transition-opacity" />
              <ArrowsPointingOutIcon className="w-4 h-4 relative z-10 group-hover:scale-110 transition-transform" />
              <span className="relative z-10">扩缩容</span>
            </button>
            <button
              onClick={() => setShowRestartModal(true)}
              disabled={restartMutation.isPending}
              className="group relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-300 hover:text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-600/0 via-cyan-600/10 to-cyan-600/0 opacity-0 group-hover:opacity-100 transition-opacity" />
              <ArrowPathIcon className={clsx('w-4 h-4 relative z-10 group-hover:scale-110 transition-transform', restartMutation.isPending && 'animate-spin')} />
              <span className="relative z-10">重启</span>
            </button>
          </div>

          {/* 暂停/恢复按钮 */}
          {deployment.spec.paused ? (
            <button
              onClick={() => resumeMutation.mutate()}
              disabled={resumeMutation.isPending}
              className="group relative flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white rounded-lg text-sm font-semibold shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity" />
              <PlayIcon className="w-4 h-4 relative z-10" />
              <span className="relative z-10">恢复发布</span>
            </button>
          ) : (
            <button
              onClick={() => pauseMutation.mutate()}
              disabled={pauseMutation.isPending}
              className="group relative flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white rounded-lg text-sm font-semibold shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity" />
              <PauseIcon className="w-4 h-4 relative z-10" />
              <span className="relative z-10">暂停发布</span>
            </button>
          )}

          {/* 更多操作下拉菜单 */}
          <ActionDropdown
            trigger={
              <button className="group relative flex items-center gap-2 px-3 py-2.5 bg-slate-800/60 backdrop-blur-sm border border-slate-700/50 hover:border-slate-600 rounded-lg text-sm font-medium text-slate-300 hover:text-white shadow-lg transition-all duration-200 hover:scale-105 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-slate-600/0 via-slate-600/20 to-slate-600/0 opacity-0 group-hover:opacity-100 transition-opacity" />
                <Cog6ToothIcon className="w-4 h-4 relative z-10 group-hover:rotate-90 transition-transform duration-300" />
                <span className="relative z-10">配置</span>
                <EllipsisVerticalIcon className="w-4 h-4 relative z-10" />
              </button>
            }
            items={[
              {
                label: '修改镜像',
                icon: <PhotoIcon className="w-4 h-4" />,
                onClick: () => setShowEditImageModal(true),
              },
              {
                label: '调度配置',
                icon: <ServerIcon className="w-4 h-4" />,
                onClick: () => setShowSchedulingEditor(true),
              },
              { divider: true },
              {
                label: '删除 Deployment',
                icon: <TrashIcon className="w-4 h-4" />,
                onClick: () => {
                  if (confirm('确定要删除此 Deployment 吗？此操作不可恢复。')) {
                    deleteMutation.mutate();
                  }
                },
                danger: true,
              },
            ]}
          />
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
        {activeTab === 'overview' && <OverviewTab deployment={deployment} namespace={namespace!} name={name!} />}
        {activeTab === 'pods' && <PodsTab pods={podsData?.items || []} namespace={namespace!} />}
        {activeTab === 'yaml' && (
          <YamlTab
            yaml={yamlData || ''}
            onEditYaml={() => setShowYamlEditor(true)}
          />
        )}
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

      {/* 重启确认模态框 */}
      {showRestartModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="card p-6 w-[500px]">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <ExclamationTriangleIcon className="w-6 h-6 text-amber-500" />
              </div>
              <h3 className="text-lg font-semibold text-white">确认重启 Deployment</h3>
            </div>

            <div className="space-y-4 mb-6">
              <p className="text-slate-300">
                您即将重启 Deployment <span className="font-semibold text-white">{name}</span>，这将触发滚动重启所有 Pod。
              </p>

              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                <h4 className="text-sm font-medium text-slate-400 mb-3">当前状态</h4>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-slate-400">命名空间</dt>
                    <dd className="text-slate-200 font-medium">{namespace}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-400">期望副本数</dt>
                    <dd className="text-slate-200 font-medium">{deployment.spec.replicas || 0}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-400">就绪副本数</dt>
                    <dd className="text-slate-200 font-medium">
                      {deployment.status.readyReplicas || 0}/{deployment.status.replicas || 0}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-400">更新策略</dt>
                    <dd className="text-slate-200 font-medium">
                      {deployment.spec.strategy?.type || 'RollingUpdate'}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="flex items-start gap-2 text-sm text-amber-400 bg-amber-500/5 rounded-lg p-3 border border-amber-500/20">
                <InformationCircleIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium mb-1">重启过程说明：</p>
                  <ul className="list-disc list-inside space-y-1 text-amber-300/80">
                    <li>将为 Pod 模板添加重启时间戳注解</li>
                    <li>K8s 将按照更新策略滚动重启所有 Pod</li>
                    <li>在重启期间服务可能会出现短暂的中断</li>
                    <li>整个过程预计需要几秒到几分钟</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowRestartModal(false)}
                className="btn btn-secondary flex-1"
                disabled={restartMutation.isPending}
              >
                取消
              </button>
              <button
                onClick={() => restartMutation.mutate()}
                className="btn bg-amber-600 hover:bg-amber-500 text-white flex-1 disabled:opacity-50"
                disabled={restartMutation.isPending}
              >
                {restartMutation.isPending ? (
                  <>
                    <ArrowPathIcon className="w-4 h-4 animate-spin mr-2" />
                    重启中...
                  </>
                ) : (
                  <>
                    <ArrowPathIcon className="w-4 h-4 mr-2" />
                    确认重启
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 修改镜像模态框 */}
      <EditImageModal
        isOpen={showEditImageModal}
        onClose={() => setShowEditImageModal(false)}
        onSave={(containers) => updateImageMutation.mutate(containers)}
        containers={deployment.spec.template.spec.containers.map((c) => ({
          name: c.name,
          image: c.image,
        }))}
        isPending={updateImageMutation.isPending}
      />

      {/* 调度配置编辑器 */}
      <SchedulingEditor
        isOpen={showSchedulingEditor}
        onClose={() => setShowSchedulingEditor(false)}
        onSave={(data) => updateSchedulingMutation.mutate(data)}
        nodeSelector={deployment.spec.template.spec.nodeSelector}
        tolerations={deployment.spec.template.spec.tolerations}
        isPending={updateSchedulingMutation.isPending}
      />

      <YamlEditorModal
        isOpen={showYamlEditor}
        onClose={() => setShowYamlEditor(false)}
        onSave={(yaml) => updateYamlMutation.mutate(yaml)}
        initialYaml={yamlData || ''}
        resourceType="Deployment"
        title={`编辑 Deployment - ${name}`}
        isPending={updateYamlMutation.isPending}
      />
    </div>
  );
}

// 概览标签页
function OverviewTab({ deployment, namespace, name }: { deployment: Deployment; namespace: string; name: string }) {
  // 获取更新策略
  const currentStrategy = {
    type: (deployment.spec.strategy?.type || 'RollingUpdate') as 'RollingUpdate' | 'Recreate',
    maxUnavailable: deployment.spec.strategy?.rollingUpdate?.maxUnavailable?.toString() || '25%',
    maxSurge: deployment.spec.strategy?.rollingUpdate?.maxSurge?.toString() || '25%',
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 基本信息 */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">基本信息</h3>
        <dl className="space-y-3">
          <InfoRow label="名称" value={deployment.metadata.name} />
          <InfoRow label="命名空间" value={deployment.metadata.namespace || '-'} />
          <InfoRow label="UID" value={deployment.metadata.uid} mono />
          <InfoRow
            label="创建时间"
            value={formatDistanceToNow(new Date(deployment.metadata.creationTimestamp), {
              addSuffix: true,
              locale: zhCN,
            })}
          />
          <InfoRow label="副本数" value={`${deployment.spec.replicas || 0}`} />
          <InfoRow label="暂停状态" value={deployment.spec.paused ? '已暂停' : '运行中'} />
        </dl>
      </div>

      {/* 状态 */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">状态</h3>
        <dl className="space-y-3">
          <InfoRow label="期望副本数" value={`${deployment.status.replicas || 0}`} />
          <InfoRow label="就绪副本数" value={`${deployment.status.readyReplicas || 0}`} />
          <InfoRow label="可用副本数" value={`${deployment.status.availableReplicas || 0}`} />
          <InfoRow label="更新副本数" value={`${deployment.status.updatedReplicas || 0}`} />
          <InfoRow label="观察代数" value={`${deployment.status.observedGeneration || 0}`} />
        </dl>
      </div>

      {/* 更新策略编辑器 */}
      <div className="lg:col-span-2">
        <UpdateStrategyEditor
          namespace={namespace}
          name={name}
          resourceType="Deployment"
          currentStrategy={currentStrategy}
        />
      </div>

      {/* 修订历史 */}
      <div className="lg:col-span-2">
        <RevisionHistory
          namespace={namespace}
          name={name}
          resourceType="Deployment"
        />
      </div>

      {/* 标签 */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">标签</h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(deployment.metadata.labels || {}).map(([key, value]) => (
            <span key={key} className="badge badge-default text-xs">
              {key}: {value}
            </span>
          ))}
          {!deployment.metadata.labels && <span className="text-slate-500">无标签</span>}
        </div>
      </div>

      {/* 选择器 */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">选择器</h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(deployment.spec.selector?.matchLabels || {}).map(([key, value]) => (
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
          {deployment.spec.template.spec.containers.map((container) => (
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
              {deployment.status.conditions?.map((condition) => (
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
                    {condition.lastUpdateTime
                      ? formatDistanceToNow(new Date(condition.lastUpdateTime), {
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
function EventsTab({ namespace, name }: { namespace: string; name: string }) {
  const { data: eventsData, isLoading } = useQuery({
    queryKey: ['deployment-events', namespace, name],
    queryFn: () => deploymentApi.getEvents(namespace, name),
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
      </div>
    );
  }

  const events = eventsData?.items || [];

  if (events.length === 0) {
    return (
      <div className="card p-6 text-center">
        <p className="text-slate-400">暂无事件</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {events.map((event) => (
        <div
          key={event.metadata.uid}
          className={clsx(
            'flex items-start gap-3 p-4 rounded-lg border',
            event.type === 'Warning'
              ? 'bg-yellow-500/10 border-yellow-500/20'
              : 'bg-slate-700/50 border-slate-600/50'
          )}
        >
          {event.type === 'Warning' ? (
            <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
          ) : event.type === 'Normal' ? (
            <CheckCircleIcon className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
          ) : (
            <InformationCircleIcon className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-white">{event.reason}</p>
              <span className="text-xs text-slate-500 flex-shrink-0">
                {event.lastTimestamp &&
                  formatDistanceToNow(new Date(event.lastTimestamp), {
                    addSuffix: true,
                    locale: zhCN,
                  })}
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-1">{event.message}</p>
            <p className="text-xs text-slate-500 mt-1">
              {event.involvedObject.kind}/{event.involvedObject.name}
            </p>
          </div>
        </div>
      ))}
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
