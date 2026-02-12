import { useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ingressApi } from '../../../api';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import clsx from 'clsx';
import type { Ingress } from '../../../types';
import YamlEditorModal from '../../../components/common/YamlEditorModal';
import {
  ArrowLeftIcon,
  TrashIcon,
  ArrowPathIcon,
  PencilIcon,
  ClipboardDocumentIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';

type TabType = 'overview' | 'yaml' | 'events';

export default function IngressDetail() {
  const { namespace, name } = useParams<{ namespace: string; name: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showYamlEditor, setShowYamlEditor] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const queryClient = useQueryClient();

  const activeTab = (searchParams.get('tab') as TabType) || 'overview';
  const setActiveTab = (tab: TabType) => {
    setSearchParams({ tab });
  };

  const { data: ingress, isLoading, error, refetch } = useQuery({
    queryKey: ['ingress', namespace, name],
    queryFn: () => ingressApi.get(namespace!, name!),
    enabled: !!namespace && !!name,
  });

  const { data: yamlData } = useQuery({
    queryKey: ['ingress-yaml', namespace, name],
    queryFn: () => ingressApi.getYaml(namespace!, name!),
    enabled: !!namespace && !!name,
  });

  const deleteMutation = useMutation({
    mutationFn: () => ingressApi.delete(namespace!, name!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingresses'] });
      window.history.back();
    },
  });

  const updateYamlMutation = useMutation({
    mutationFn: (yaml: string) => ingressApi.updateYaml(namespace!, name!, yaml),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingress', namespace, name] });
      queryClient.invalidateQueries({ queryKey: ['ingress-yaml', namespace, name] });
      setShowYamlEditor(false);
    },
    onError: (error: Error) => {
      alert(`更新失败: ${error.message}`);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500" />
      </div>
    );
  }

  if (error || !ingress) {
    return (
      <div className="card p-6 text-center">
        <p className="text-red-400">加载失败：{(error as Error)?.message || 'Ingress 不存在'}</p>
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

  const hasTLS = (ingress.spec.tls?.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/network/ingresses" className="btn btn-secondary p-2">
            <ArrowLeftIcon className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{name}</h1>
              {hasTLS ? (
                <span className="badge badge-success flex items-center gap-1">
                  <CheckCircleIcon className="w-3 h-3" />
                  HTTPS
                </span>
              ) : (
                <span className="badge badge-default flex items-center gap-1">
                  <XCircleIcon className="w-3 h-3" />
                  HTTP
                </span>
              )}
            </div>
            <p className="text-text-muted mt-1">命名空间: {namespace}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowYamlEditor(true)}
            className="flex items-center gap-2 px-4 py-2 bg-surface-secondary border border-border rounded-lg text-sm font-medium text-text-secondary hover:text-white hover:bg-surface-tertiary transition-colors"
          >
            <PencilIcon className="w-4 h-4" />
            编辑 YAML
          </button>
          <button
            onClick={() => refetch()}
            className="p-2 bg-surface-secondary border border-border rounded-lg text-text-secondary hover:text-white hover:bg-surface-tertiary transition-colors"
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
      <div className="border-b border-border">
        <nav className="flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
                activeTab === tab.id
                  ? 'border-green-500 text-green-400'
                  : 'border-transparent text-text-muted hover:text-text-secondary'
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* 标签页内容 */}
      <div>
        {activeTab === 'overview' && <OverviewTab ingress={ingress} />}
        {activeTab === 'yaml' && <YamlTab yaml={yamlData || ''} />}
        {activeTab === 'events' && <EventsTab />}
      </div>

      <YamlEditorModal
        isOpen={showYamlEditor}
        onClose={() => setShowYamlEditor(false)}
        onSave={async (yaml) => {
          await updateYamlMutation.mutateAsync(yaml);
        }}
        initialYaml={yamlData || ''}
        resourceType="Ingress"
        title={`编辑 Ingress - ${name}`}
        isPending={updateYamlMutation.isPending}
      />

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="card p-6 w-[500px]">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-red-500/10">
                <ExclamationTriangleIcon className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-white">确认删除 Ingress</h3>
            </div>
            <div className="space-y-4 mb-6">
              <p className="text-text-secondary">
                您即将删除 Ingress <span className="font-semibold text-white">{name}</span>。
              </p>
              <div className="flex items-start gap-2 text-sm text-red-400 bg-red-500/5 rounded-lg p-3 border border-red-500/20">
                <InformationCircleIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <p>此操作不可撤销！删除 Ingress 将导致外部无法访问相关服务。</p>
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

function OverviewTab({ ingress }: { ingress: Ingress }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">基本信息</h3>
        <dl className="space-y-3">
          <InfoRow label="名称" value={ingress.metadata.name} />
          <InfoRow label="命名空间" value={ingress.metadata.namespace || '-'} />
          <InfoRow label="Ingress Class" value={ingress.spec.ingressClassName || '-'} />
          <InfoRow label="UID" value={ingress.metadata.uid} mono />
          <InfoRow
            label="创建时间"
            value={formatDistanceToNow(new Date(ingress.metadata.creationTimestamp), {
              addSuffix: true,
              locale: zhCN,
            })}
          />
        </dl>
      </div>

      <div className="card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">标签</h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(ingress.metadata.labels || {}).map(([key, value]) => (
            <span key={key} className="badge badge-default text-xs">
              {key}: {value}
            </span>
          ))}
          {!ingress.metadata.labels && <span className="text-text-muted">无标签</span>}
        </div>
      </div>

      <div className="card p-6 lg:col-span-2">
        <h3 className="text-lg font-semibold text-white mb-4">
          路由规则 ({ingress.spec.rules?.length || 0} 个)
        </h3>
        <div className="space-y-4">
          {ingress.spec.rules?.map((rule, idx) => (
            <div key={idx} className="bg-[color-mix(in_srgb,var(--color-bg-secondary)_50%,transparent)] rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-white">Host:</span>
                  <a
                    href={`${(ingress.spec.tls?.length ?? 0) > 0 ? 'https' : 'http'}://${rule.host}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 text-green-400 hover:text-green-300"
                  >
                    {rule.host || '*'}
                  </a>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left pb-2 text-text-muted">路径</th>
                      <th className="text-left pb-2 text-text-muted">路径类型</th>
                      <th className="text-left pb-2 text-text-muted">Service</th>
                      <th className="text-left pb-2 text-text-muted">Port</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rule.http?.paths?.map((path, pathIdx) => (
                      <tr key={pathIdx} className="border-b border-border">
                        <td className="py-2 text-white font-mono">{path.path || '/'}</td>
                        <td className="py-2 text-text-muted">{path.pathType}</td>
                        <td className="py-2 text-white">{path.backend.service?.name}</td>
                        <td className="py-2 text-white font-mono">
                          {path.backend.service?.port?.number || path.backend.service?.port?.name}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          {!ingress.spec.rules && <span className="text-text-muted">无路由规则</span>}
        </div>
      </div>

      {ingress.spec.tls && ingress.spec.tls.length > 0 && (
        <div className="card p-6 lg:col-span-2">
          <h3 className="text-lg font-semibold text-white mb-4">TLS 配置</h3>
          <div className="space-y-3">
            {ingress.spec.tls.map((tls, idx) => (
              <div key={idx} className="bg-[color-mix(in_srgb,var(--color-bg-secondary)_50%,transparent)] rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-white">Secret: {tls.secretName}</span>
                  <span className="badge badge-success text-xs">HTTPS</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {tls.hosts?.map((host) => (
                    <span key={host} className="badge badge-default text-xs">
                      {host}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
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
      <div className="card p-4 bg-surface-tertiary max-h-[600px] overflow-y-auto">
        <pre className="text-sm text-text-secondary font-mono whitespace-pre-wrap break-words">{yaml || '加载中...'}</pre>
      </div>
    </div>
  );
}

function EventsTab() {
  return (
    <div className="card p-6 text-center">
      <p className="text-text-muted">暂无事件</p>
    </div>
  );
}

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className="text-text-muted">{label}</dt>
      <dd className={clsx('text-text-secondary', mono && 'font-mono text-sm')}>{value}</dd>
    </div>
  );
}
