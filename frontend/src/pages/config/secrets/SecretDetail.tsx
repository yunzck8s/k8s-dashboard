import { useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { secretApi } from '../../../api';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import clsx from 'clsx';
import type { Secret } from '../../../types';
import YamlEditorModal from '../../../components/common/YamlEditorModal';
import {
  ArrowLeftIcon,
  TrashIcon,
  ArrowPathIcon,
  PencilIcon,
  ClipboardDocumentIcon,
  EyeIcon,
  EyeSlashIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';

type TabType = 'overview' | 'yaml' | 'events';

export default function SecretDetail() {
  const { namespace, name } = useParams<{ namespace: string; name: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showYamlEditor, setShowYamlEditor] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  // 从 URL 参数读取当前标签，默认为 'overview'
  const activeTab = (searchParams.get('tab') as TabType) || 'overview';

  // 设置标签并同步到 URL 参数
  const setActiveTab = (tab: TabType) => {
    setSearchParams({ tab });
  };

  // 获取 Secret 详情
  const { data: secret, isLoading, error, refetch } = useQuery({
    queryKey: ['secret', namespace, name],
    queryFn: () => secretApi.get(namespace!, name!),
    enabled: !!namespace && !!name,
  });

  // 获取 Secret YAML（移除 activeTab 限制，以便在任何标签页都能编辑）
  const { data: yamlData, refetch: refetchYaml } = useQuery({
    queryKey: ['secret-yaml', namespace, name],
    queryFn: () => secretApi.getYaml(namespace!, name!),
    enabled: !!namespace && !!name,
  });

  // 删除 Secret
  const deleteMutation = useMutation({
    mutationFn: () => secretApi.delete(namespace!, name!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['secrets'] });
      window.history.back();
    },
  });

  // 更新 YAML
  const updateYamlMutation = useMutation({
    mutationFn: (yaml: string) => secretApi.updateYaml(namespace!, name!, yaml),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['secret', namespace, name] });
      queryClient.invalidateQueries({ queryKey: ['secret-yaml', namespace, name] });
      setShowYamlEditor(false);
    },
    onError: (error: Error) => {
      alert(`更新失败: ${error.message}`);
    },
  });

  // 切换显示/隐藏 Secret 值
  const toggleReveal = (key: string) => {
    setRevealedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Base64 解码
  const decodeBase64 = (str: string): string => {
    try {
      return atob(str);
    } catch {
      return str;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
      </div>
    );
  }

  if (error || !secret) {
    return (
      <div className="card p-6 text-center">
        <p className="text-red-400">加载失败：{(error as Error)?.message || 'Secret 不存在'}</p>
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
          <Link to="/config/secrets" className="btn btn-secondary p-2">
            <ArrowLeftIcon className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{name}</h1>
              <span className="badge badge-purple">{secret.type || 'Opaque'}</span>
            </div>
            <p className="text-slate-400 mt-1">命名空间: {namespace}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* 编辑 YAML 按钮 */}
          <button
            onClick={() => setShowYamlEditor(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <PencilIcon className="w-4 h-4" />
            编辑 YAML
          </button>

          {/* 刷新按钮 */}
          <button
            onClick={() => refetch()}
            className="p-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <ArrowPathIcon className="w-5 h-5" />
          </button>

          {/* 删除按钮 */}
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
                  ? 'border-purple-500 text-purple-400'
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
        {activeTab === 'overview' && (
          <OverviewTab
            secret={secret}
            revealedKeys={revealedKeys}
            toggleReveal={toggleReveal}
            decodeBase64={decodeBase64}
          />
        )}
        {activeTab === 'yaml' && <YamlTab yaml={yamlData || ''} />}
        {activeTab === 'events' && <EventsTab namespace={namespace!} name={name!} />}
      </div>

      {/* YAML 编辑器模态框 */}
      <YamlEditorModal
        isOpen={showYamlEditor}
        onClose={() => setShowYamlEditor(false)}
        onSave={(yaml) => updateYamlMutation.mutate(yaml)}
        initialYaml={yamlData || ''}
        resourceType="Secret"
        title={`编辑 Secret - ${name}`}
        isPending={updateYamlMutation.isPending}
      />

      {/* 删除确认模态框 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="card p-6 w-[500px]">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-red-500/10">
                <ExclamationTriangleIcon className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-white">确认删除 Secret</h3>
            </div>

            <div className="space-y-4 mb-6">
              <p className="text-slate-300">
                您即将删除 Secret <span className="font-semibold text-white">{name}</span>。
              </p>

              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                <h4 className="text-sm font-medium text-slate-400 mb-3">资源信息</h4>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-slate-400">命名空间</dt>
                    <dd className="text-slate-200 font-medium">{namespace}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-400">类型</dt>
                    <dd className="text-slate-200 font-medium">{secret.type || 'Opaque'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-400">数据项数量</dt>
                    <dd className="text-slate-200 font-medium">
                      {Object.keys(secret.data || {}).length} 个
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="flex items-start gap-2 text-sm text-red-400 bg-red-500/5 rounded-lg p-3 border border-red-500/20">
                <InformationCircleIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <p>此操作不可撤销，删除 Secret 可能影响依赖它的应用！</p>
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

// 概览标签页
function OverviewTab({
  secret,
  revealedKeys,
  toggleReveal,
  decodeBase64,
}: {
  secret: Secret;
  revealedKeys: Set<string>;
  toggleReveal: (key: string) => void;
  decodeBase64: (str: string) => string;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 基本信息 */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">基本信息</h3>
        <dl className="space-y-3">
          <InfoRow label="名称" value={secret.metadata.name} />
          <InfoRow label="命名空间" value={secret.metadata.namespace || '-'} />
          <InfoRow label="类型" value={secret.type || 'Opaque'} />
          <InfoRow label="UID" value={secret.metadata.uid} mono />
          <InfoRow
            label="创建时间"
            value={formatDistanceToNow(new Date(secret.metadata.creationTimestamp), {
              addSuffix: true,
              locale: zhCN,
            })}
          />
        </dl>
      </div>

      {/* 标签 */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">标签</h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(secret.metadata.labels || {}).map(([key, value]) => (
            <span key={key} className="badge badge-default text-xs">
              {key}: {value}
            </span>
          ))}
          {!secret.metadata.labels && <span className="text-slate-500">无标签</span>}
        </div>
      </div>

      {/* 注解 */}
      <div className="card p-6 lg:col-span-2">
        <h3 className="text-lg font-semibold text-white mb-4">注解</h3>
        <div className="space-y-2">
          {Object.entries(secret.metadata.annotations || {}).map(([key, value]) => (
            <div key={key} className="flex items-start gap-2 text-sm">
              <span className="text-slate-400 flex-shrink-0">{key}:</span>
              <span className="text-slate-300 break-all">{value}</span>
            </div>
          ))}
          {!secret.metadata.annotations && <span className="text-slate-500">无注解</span>}
        </div>
      </div>

      {/* Data 内容 */}
      <div className="card p-6 lg:col-span-2">
        <h3 className="text-lg font-semibold text-white mb-4">
          数据 ({Object.keys(secret.data || {}).length} 项)
        </h3>
        <div className="space-y-4">
          {Object.entries(secret.data || {}).map(([key, value]) => {
            const isRevealed = revealedKeys.has(key);
            const decodedValue = decodeBase64(value);
            return (
              <div key={key} className="bg-slate-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-white">{key}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleReveal(key)}
                      className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
                    >
                      {isRevealed ? (
                        <>
                          <EyeSlashIcon className="w-4 h-4" />
                          隐藏
                        </>
                      ) : (
                        <>
                          <EyeIcon className="w-4 h-4" />
                          显示
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => navigator.clipboard.writeText(decodedValue)}
                      className="text-xs text-blue-400 hover:text-blue-300"
                    >
                      复制
                    </button>
                  </div>
                </div>
                <pre className="text-sm text-slate-300 font-mono bg-slate-900 rounded p-3 overflow-x-auto max-h-64">
                  {isRevealed ? decodedValue : '••••••••'}
                </pre>
              </div>
            );
          })}
          {!secret.data && <span className="text-slate-500">无数据</span>}
        </div>
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
      <div className="card p-4 bg-slate-900 max-h-[600px] overflow-y-auto">
        <pre className="text-sm text-slate-300 font-mono whitespace-pre-wrap break-words">{yaml || '加载中...'}</pre>
      </div>
    </div>
  );
}

// 事件标签页
function EventsTab({ namespace, name }: { namespace: string; name: string }) {
  return (
    <div className="card p-6 text-center">
      <p className="text-slate-400">暂无事件</p>
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
