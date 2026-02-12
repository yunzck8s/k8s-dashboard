import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { alertApi, namespaceApi } from '../../api';
import { usePollingInterval } from '../../utils/polling';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import clsx from 'clsx';
import type { Alert } from '../../types/api';
import {
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
  FunnelIcon,
  XMarkIcon,
  ArrowPathIcon,
  ChevronRightIcon,
  ArrowTopRightOnSquareIcon,
  CheckCircleIcon,
  BellSlashIcon,
} from '@heroicons/react/24/outline';

// 告警严重级别配置
const severityConfig = {
  critical: {
    label: '严重',
    icon: ExclamationCircleIcon,
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    textColor: 'text-red-400',
    badgeClass: 'badge-error',
  },
  warning: {
    label: '警告',
    icon: ExclamationTriangleIcon,
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30',
    textColor: 'text-yellow-400',
    badgeClass: 'badge-warning',
  },
  info: {
    label: '信息',
    icon: InformationCircleIcon,
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    textColor: 'text-blue-400',
    badgeClass: 'badge-info',
  },
};

// 获取告警严重级别配置
function getSeverityConfig(severity: string) {
  return severityConfig[severity as keyof typeof severityConfig] || severityConfig.info;
}

export default function AlertsActive() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const pollingInterval = usePollingInterval('standard');

  // 从 URL 读取过滤参数
  const filters = {
    severity: searchParams.get('severity') || '',
    namespace: searchParams.get('namespace') || '',
    alertname: searchParams.get('alertname') || '',
  };

  // 获取活跃告警
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['alerts', filters],
    queryFn: () => alertApi.list({
      ...filters,
      state: 'active',
    }),
    refetchInterval: pollingInterval,
  });

  // 获取命名空间列表（用于过滤器）
  const { data: namespacesData } = useQuery({
    queryKey: ['namespaces'],
    queryFn: () => namespaceApi.list(),
  });

  // 获取告警名称列表（用于过滤器）
  const { data: alertNamesData } = useQuery({
    queryKey: ['alert-names'],
    queryFn: () => alertApi.getNames(),
  });

  // 更新过滤器
  const updateFilter = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    setSearchParams(newParams);
  };

  // 清除所有过滤器
  const clearFilters = () => {
    const newParams = new URLSearchParams();
    newParams.set('tab', 'active');
    setSearchParams(newParams);
  };

  // 是否有活跃的过滤器
  const hasActiveFilters = filters.severity || filters.namespace || filters.alertname;

  const alerts = data?.items || [];
  const namespaces = namespacesData?.items?.map(ns => ns.metadata.name) || [];
  const alertNames = alertNamesData?.items || [];

  if (error) {
    return (
      <div className="card p-8 text-center">
        <ExclamationCircleIcon className="w-12 h-12 mx-auto text-red-400 mb-4" />
        <p className="text-red-400">加载告警失败</p>
        <p className="text-slate-500 text-sm mt-2">{(error as Error).message}</p>
        <button
          onClick={() => refetch()}
          className="btn btn-primary mt-4"
        >
          重试
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 过滤器栏 */}
      <div className="card p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-slate-400">
            <FunnelIcon className="w-4 h-4" />
            <span className="text-sm">过滤</span>
          </div>

          {/* 严重级别过滤 */}
          <select
            value={filters.severity}
            onChange={(e) => updateFilter('severity', e.target.value)}
            className="select select-sm bg-slate-800 border-slate-600 text-slate-300"
          >
            <option value="">全部级别</option>
            <option value="critical">严重</option>
            <option value="warning">警告</option>
            <option value="info">信息</option>
          </select>

          {/* 命名空间过滤 */}
          <select
            value={filters.namespace}
            onChange={(e) => updateFilter('namespace', e.target.value)}
            className="select select-sm bg-slate-800 border-slate-600 text-slate-300"
          >
            <option value="">全部命名空间</option>
            {namespaces.map((ns) => (
              <option key={ns} value={ns}>{ns}</option>
            ))}
          </select>

          {/* 告警名称过滤 */}
          <select
            value={filters.alertname}
            onChange={(e) => updateFilter('alertname', e.target.value)}
            className="select select-sm bg-slate-800 border-slate-600 text-slate-300"
          >
            <option value="">全部告警</option>
            {alertNames.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>

          {/* 清除过滤器 */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="btn btn-ghost btn-sm text-slate-400 hover:text-white"
            >
              <XMarkIcon className="w-4 h-4 mr-1" />
              清除
            </button>
          )}

          {/* 刷新按钮 */}
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="btn btn-ghost btn-sm text-slate-400 hover:text-white ml-auto"
          >
            <ArrowPathIcon className={clsx('w-4 h-4', isFetching && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* 告警列表 */}
      {isLoading ? (
        <div className="card p-8 text-center">
          <ArrowPathIcon className="w-8 h-8 mx-auto text-slate-400 animate-spin mb-4" />
          <p className="text-slate-400">加载告警中...</p>
        </div>
      ) : alerts.length === 0 ? (
        <div className="card p-12 text-center">
          <InformationCircleIcon className="w-12 h-12 mx-auto text-green-400 mb-4" />
          <p className="text-slate-300">暂无活跃告警</p>
          <p className="text-slate-500 text-sm mt-2">
            {hasActiveFilters ? '当前过滤条件下没有告警' : '集群运行正常'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <AlertCard
              key={alert.fingerprint}
              alert={alert}
              onClick={() => setSelectedAlert(alert)}
            />
          ))}
        </div>
      )}

      {/* 告警详情抽屉 */}
      {selectedAlert && (
        <AlertDetailDrawer
          alert={selectedAlert}
          onClose={() => setSelectedAlert(null)}
        />
      )}
    </div>
  );
}

// 告警卡片组件
function AlertCard({ alert, onClick }: { alert: Alert; onClick: () => void }) {
  const severity = alert.labels.severity || 'info';
  const config = getSeverityConfig(severity);
  const Icon = config.icon;

  const alertName = alert.labels.alertname || '未命名告警';
  const namespace = alert.labels.namespace;
  const summary = alert.annotations.summary || alert.annotations.description || '';
  const startedAt = new Date(alert.startsAt);

  return (
    <div
      onClick={onClick}
      className={clsx(
        'card p-4 cursor-pointer transition-all hover:scale-[1.01]',
        'border-l-4',
        config.borderColor,
        'hover:bg-slate-800/50'
      )}
    >
      <div className="flex items-start gap-4">
        {/* 图标 */}
        <div className={clsx('p-2 rounded-lg', config.bgColor)}>
          <Icon className={clsx('w-5 h-5', config.textColor)} />
        </div>

        {/* 内容 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium text-white truncate">{alertName}</h3>
            <span className={clsx('badge', config.badgeClass)}>
              {config.label}
            </span>
            {namespace && (
              <span className="badge badge-default">{namespace}</span>
            )}
          </div>

          {summary && (
            <p className="text-sm text-slate-400 line-clamp-2 mb-2">
              {summary}
            </p>
          )}

          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span>
              开始于 {formatDistanceToNow(startedAt, { addSuffix: true, locale: zhCN })}
            </span>
            {alert.status.silencedBy.length > 0 && (
              <span className="text-yellow-500">已静默</span>
            )}
          </div>
        </div>

        {/* 箭头 */}
        <ChevronRightIcon className="w-5 h-5 text-slate-500" />
      </div>
    </div>
  );
}

// 告警详情抽屉组件
function AlertDetailDrawer({ alert, onClose }: { alert: Alert; onClose: () => void }) {
  const [showAckModal, setShowAckModal] = useState(false);
  const [showSilenceModal, setShowSilenceModal] = useState(false);
  const queryClient = useQueryClient();

  const severity = alert.labels.severity || 'info';
  const config = getSeverityConfig(severity);
  const Icon = config.icon;

  const alertName = alert.labels.alertname || '未命名告警';
  const startedAt = new Date(alert.startsAt);

  // 查询确认状态
  const { data: ack } = useQuery({
    queryKey: ['alert-acknowledgement', alert.fingerprint],
    queryFn: () => alertApi.getAcknowledgement(alert.fingerprint),
  });

  // 确认告警
  const acknowledgeMutation = useMutation({
    mutationFn: (data: { comment: string }) =>
      alertApi.acknowledge(alert.fingerprint, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-acknowledgement', alert.fingerprint] });
      setShowAckModal(false);
    },
  });

  // 取消确认
  const unacknowledgeMutation = useMutation({
    mutationFn: () => alertApi.unacknowledge(alert.fingerprint),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-acknowledgement', alert.fingerprint] });
    },
  });

  return (
    <>
      {/* 遮罩层 */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* 抽屉 */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-lg bg-slate-900 border-l border-slate-700 z-50 overflow-y-auto">
        {/* 头部 */}
        <div className="sticky top-0 bg-slate-900 border-b border-slate-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className={clsx('p-2 rounded-lg', config.bgColor)}>
                <Icon className={clsx('w-5 h-5', config.textColor)} />
              </div>
              <div>
                <h2 className="font-semibold text-white">{alertName}</h2>
                <span className={clsx('badge', config.badgeClass)}>
                  {config.label}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="btn btn-ghost btn-sm"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-2">
            {ack ? (
              <button
                onClick={() => unacknowledgeMutation.mutate()}
                disabled={unacknowledgeMutation.isPending}
                className="btn btn-sm btn-outline text-yellow-400 border-yellow-500 hover:bg-yellow-500/10"
              >
                <XMarkIcon className="w-4 h-4" />
                取消确认
              </button>
            ) : (
              <button
                onClick={() => setShowAckModal(true)}
                className="btn btn-sm btn-primary"
              >
                <CheckCircleIcon className="w-4 h-4" />
                确认告警
              </button>
            )}
            <button
              onClick={() => setShowSilenceModal(true)}
              className="btn btn-sm btn-outline"
            >
              <BellSlashIcon className="w-4 h-4" />
              创建静默
            </button>
          </div>
        </div>

        {/* 内容 */}
        <div className="p-4 space-y-6">
          {/* 确认信息 */}
          {ack && (
            <div className="card bg-yellow-500/10 border border-yellow-500/30 p-3">
              <div className="flex items-start gap-2">
                <CheckCircleIcon className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-yellow-400">已确认</p>
                  <p className="text-xs text-slate-400 mt-1">
                    由 {ack.acknowledgedBy} 于 {new Date(ack.acknowledgedAt).toLocaleString('zh-CN')} 确认
                  </p>
                  {ack.comment && (
                    <p className="text-sm text-slate-300 mt-2">{ack.comment}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 摘要 */}
          {alert.annotations.summary && (
            <div>
              <h3 className="text-sm font-medium text-slate-400 mb-2">摘要</h3>
              <p className="text-white">{alert.annotations.summary}</p>
            </div>
          )}

          {/* 描述 */}
          {alert.annotations.description && (
            <div>
              <h3 className="text-sm font-medium text-slate-400 mb-2">描述</h3>
              <p className="text-white whitespace-pre-wrap">{alert.annotations.description}</p>
            </div>
          )}

          {/* 时间信息 */}
          <div>
            <h3 className="text-sm font-medium text-slate-400 mb-2">时间</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">开始时间</span>
                <span className="text-white">
                  {startedAt.toLocaleString('zh-CN')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">持续时间</span>
                <span className="text-white">
                  {formatDistanceToNow(startedAt, { locale: zhCN })}
                </span>
              </div>
            </div>
          </div>

          {/* 标签 */}
          <div>
            <h3 className="text-sm font-medium text-slate-400 mb-2">标签</h3>
            <div className="space-y-1">
              {Object.entries(alert.labels).map(([key, value]) => (
                <div key={key} className="flex items-start gap-2 text-sm">
                  <span className="text-slate-500 min-w-0 break-all">{key}:</span>
                  <span className="text-white min-w-0 break-all">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 状态 */}
          <div>
            <h3 className="text-sm font-medium text-slate-400 mb-2">状态</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">状态</span>
                <span className="text-white">{alert.status.state}</span>
              </div>
              {alert.status.silencedBy.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500">静默</span>
                  <span className="text-yellow-400">
                    {alert.status.silencedBy.join(', ')}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 来源链接 */}
          {alert.generatorURL && (
            <div>
              <h3 className="text-sm font-medium text-slate-400 mb-2">来源</h3>
              <a
                href={alert.generatorURL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300"
              >
                在 Prometheus 中查看
                <ArrowTopRightOnSquareIcon className="w-4 h-4" />
              </a>
            </div>
          )}
        </div>
      </div>

      {/* 确认弹窗 */}
      {showAckModal && (
        <AcknowledgeModal
          onClose={() => setShowAckModal(false)}
          onConfirm={(comment) => acknowledgeMutation.mutate({ comment })}
          isLoading={acknowledgeMutation.isPending}
        />
      )}

      {/* 创建静默弹窗 */}
      {showSilenceModal && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="card max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-white mb-4">创建静默规则</h3>
            <p className="text-slate-400 mb-4">
              静默规则功能正在开发中，请切换到"静默规则"标签页查看现有规则。
            </p>
            <button
              onClick={() => setShowSilenceModal(false)}
              className="btn btn-primary w-full"
            >
              知道了
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// 确认告警弹窗
function AcknowledgeModal({
  onClose,
  onConfirm,
  isLoading,
}: {
  onClose: () => void;
  onConfirm: (comment: string) => void;
  isLoading: boolean;
}) {
  const [comment, setComment] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (comment.trim()) {
      onConfirm(comment);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="card max-w-md w-full p-6">
        <h3 className="text-lg font-semibold text-white mb-4">确认告警</h3>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-400 mb-2">
              备注（必填）
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="请输入确认原因或处理说明..."
              className="input w-full h-24 resize-none"
              required
              autoFocus
            />
            <p className="text-xs text-slate-500 mt-1">
              确认后将标记此告警已知晓，但不会停止告警
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-ghost flex-1"
              disabled={isLoading}
            >
              取消
            </button>
            <button
              type="submit"
              className="btn btn-primary flex-1"
              disabled={isLoading || !comment.trim()}
            >
              {isLoading ? '确认中...' : '确认'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
