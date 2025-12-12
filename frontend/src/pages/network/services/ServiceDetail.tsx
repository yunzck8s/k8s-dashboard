import { useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { serviceApi } from '../../../api';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import clsx from 'clsx';
import type { Service } from '../../../types';
import YamlEditorModal from '../../../components/common/YamlEditorModal';
import {
  ArrowLeftIcon,
  TrashIcon,
  ArrowPathIcon,
  PencilIcon,
  ClipboardDocumentIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';

type TabType = 'overview' | 'yaml' | 'events';

export default function ServiceDetail() {
  const { namespace, name } = useParams<{ namespace: string; name: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showYamlEditor, setShowYamlEditor] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const queryClient = useQueryClient();

  const activeTab = (searchParams.get('tab') as TabType) || 'overview';
  const setActiveTab = (tab: TabType) => {
    setSearchParams({ tab });
  };

  const { data: service, isLoading, error, refetch } = useQuery({
    queryKey: ['service', namespace, name],
    queryFn: () => serviceApi.get(namespace!, name!),
    enabled: !!namespace && !!name,
  });

  const { data: yamlData } = useQuery({
    queryKey: ['service-yaml', namespace, name],
    queryFn: () => serviceApi.getYaml(namespace!, name!),
    enabled: !!namespace && !!name,
  });

  const deleteMutation = useMutation({
    mutationFn: () => serviceApi.delete(namespace!, name!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      window.history.back();
    },
  });

  const updateYamlMutation = useMutation({
    mutationFn: (yaml: string) => serviceApi.updateYaml(namespace!, name!, yaml),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service', namespace, name] });
      queryClient.invalidateQueries({ queryKey: ['service-yaml', namespace, name] });
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

  if (error || !service) {
    return (
      <div className="card p-6 text-center">
        <p className="text-red-400">加载失败：{(error as Error)?.message || 'Service 不存在'}</p>
        <button onClick={() => refetch()} className="btn btn-primary mt-4">
          重试
        </button>
      </div>
    );
  }

  const tabs: { id: TabType; label: string }[] = [
    { id: 'overview', label: '概览' },
    { id: 'yaml', label: 'YAML' },
    { id: 'events', label: '事件' },
  ];

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/network/services" className="btn btn-secondary p-2">
            <ArrowLeftIcon className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{name}</h1>
              <span className={clsx('badge', getTypeColor(service.spec.type || 'ClusterIP'))}>
                {service.spec.type || 'ClusterIP'}
              </span>
            </div>
            <p className="text-slate-400 mt-1">命名空间: {namespace}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowYamlEditor(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <PencilIcon className="w-4 h-4" />
            编辑 YAML
          </button>
          <button
            onClick={() => refetch()}
            className="p-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <ArrowPathIcon className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <TrashIcon className="w-4 h-4" />
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
        {activeTab === 'overview' && <OverviewTab service={service} />}
        {activeTab === 'yaml' && <YamlTab yaml={yamlData || ''} />}
        {activeTab === 'events' && <EventsTab namespace={namespace!} name={name!} />}
      </div>

      <YamlEditorModal
        isOpen={showYamlEditor}
        onClose={() => setShowYamlEditor(false)}
        onSave={(yaml) => updateYamlMutation.mutate(yaml)}
        initialYaml={yamlData || ''}
        resourceType="Service"
        title={`编辑 Service - ${name}`}
        isPending={updateYamlMutation.isPending}
      />

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="card p-6 w-[500px]">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-red-500/10">
                <ExclamationTriangleIcon className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-white">确认删除 Service</h3>
            </div>
            <div className="space-y-4 mb-6">
              <p className="text-slate-300">
                您即将删除 Service <span className="font-semibold text-white">{name}</span>。
              </p>
              <div className="flex items-start gap-2 text-sm text-red-400 bg-red-500/5 rounded-lg p-3 border border-red-500/20">
                <InformationCircleIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <p>此操作不可撤销！删除 Service 将影响依赖它的应用访问。</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="btn btn-secondary flex-1"
                disabled={deleteMutation.isPending}
              >
                取消
              </button>
              <button
                onClick={() => deleteMutation.mutate()}
                className="btn bg-red-600 hover:bg-red-500 text-white flex-1 disabled:opacity-50"
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? '删除中...' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getTypeColor(type: string) {
  switch (type) {
    case 'LoadBalancer':
      return 'badge-info';
    case 'NodePort':
      return 'badge-warning';
    case 'ClusterIP':
      return 'badge-success';
    default:
      return 'badge-default';
  }
}

function OverviewTab({ service }: { service: Service }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">基本信息</h3>
        <dl className="space-y-3">
          <InfoRow label="名称" value={service.metadata.name} />
          <InfoRow label="命名空间" value={service.metadata.namespace || '-'} />
          <InfoRow label="类型" value={service.spec.type || 'ClusterIP'} />
          <InfoRow label="Cluster IP" value={service.spec.clusterIP || '-'} mono />
          <InfoRow label="UID" value={service.metadata.uid} mono />
          <InfoRow
            label="创建时间"
            value={formatDistanceToNow(new Date(service.metadata.creationTimestamp), {
              addSuffix: true,
              locale: zhCN,
            })}
          />
        </dl>
      </div>

      <div className="card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">标签</h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(service.metadata.labels || {}).map(([key, value]) => (
            <span key={key} className="badge badge-default text-xs">
              {key}: {value}
            </span>
          ))}
          {!service.metadata.labels && <span className="text-slate-500">无标签</span>}
        </div>
      </div>

      <div className="card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">选择器 (Selector)</h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(service.spec.selector || {}).map(([key, value]) => (
            <span key={key} className="badge badge-primary text-xs">
              {key}: {value}
            </span>
          ))}
          {!service.spec.selector && <span className="text-slate-500">无选择器</span>}
        </div>
      </div>

      <div className="card p-6 lg:col-span-2">
        <h3 className="text-lg font-semibold text-white mb-4">
          端口映射 ({service.spec.ports?.length || 0} 个)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left pb-2 text-slate-400">名称</th>
                <th className="text-left pb-2 text-slate-400">协议</th>
                <th className="text-left pb-2 text-slate-400">端口</th>
                <th className="text-left pb-2 text-slate-400">目标端口</th>
                {(service.spec.type === 'NodePort' || service.spec.type === 'LoadBalancer') && (
                  <th className="text-left pb-2 text-slate-400">NodePort</th>
                )}
              </tr>
            </thead>
            <tbody>
              {service.spec.ports?.map((port, idx) => (
                <tr key={idx} className="border-b border-slate-800">
                  <td className="py-2 text-white">{port.name || '-'}</td>
                  <td className="py-2 text-slate-400">{port.protocol || 'TCP'}</td>
                  <td className="py-2 text-white font-mono">{port.port}</td>
                  <td className="py-2 text-white font-mono">{port.targetPort}</td>
                  {(service.spec.type === 'NodePort' || service.spec.type === 'LoadBalancer') && (
                    <td className="py-2 text-white font-mono">{port.nodePort || '-'}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function YamlTab({ yaml }: { yaml: string }) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => navigator.clipboard.writeText(yaml)} className="btn btn-secondary">
          <ClipboardDocumentIcon className="w-4 h-4 mr-2" />
          复制 YAML
        </button>
      </div>
      <div className="card p-4 bg-slate-900 max-h-[600px] overflow-y-auto">
        <pre className="text-sm text-slate-300 font-mono whitespace-pre-wrap break-words">{yaml || '加载中...'}</pre>
      </div>
    </div>
  );
}

function EventsTab({ namespace, name }: { namespace: string; name: string }) {
  return (
    <div className="card p-6 text-center">
      <p className="text-slate-400">暂无事件</p>
    </div>
  );
}

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className="text-slate-400">{label}</dt>
      <dd className={clsx('text-slate-200', mono && 'font-mono text-sm')}>{value}</dd>
    </div>
  );
}
