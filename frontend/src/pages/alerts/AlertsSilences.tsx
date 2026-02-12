import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { silenceApi } from '../../api';
import { usePollingInterval } from '../../utils/polling';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import clsx from 'clsx';
import type { Silence } from '../../types/api';
import {
  BellSlashIcon,
  PlusIcon,
  TrashIcon,
  ArrowPathIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';

export default function AlertsSilences() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const queryClient = useQueryClient();
  const pollingInterval = usePollingInterval('standard');

  // 获取静默规则
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['silences'],
    queryFn: () => silenceApi.list(),
    refetchInterval: pollingInterval,
  });

  // 删除静默规则
  const deleteMutation = useMutation({
    mutationFn: (id: number) => silenceApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['silences'] });
    },
  });

  const silences = data?.items || [];

  if (error) {
    return (
      <div className="card p-8 text-center">
        <ExclamationCircleIcon className="w-12 h-12 mx-auto text-red-400 mb-4" />
        <p className="text-red-400">加载静默规则失败</p>
        <p className="text-text-muted text-sm mt-2">{(error as Error).message}</p>
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
      {/* 顶部操作栏 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">静默规则</h2>
          <p className="text-sm text-text-muted mt-1">
            创建规则以临时静默特定告警
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="btn btn-ghost btn-sm text-text-muted hover:text-white"
          >
            <ArrowPathIcon className={clsx('w-4 h-4', isFetching && 'animate-spin')} />
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary btn-sm"
          >
            <PlusIcon className="w-4 h-4 mr-1" />
            创建静默
          </button>
        </div>
      </div>

      {/* 静默规则列表 */}
      {isLoading ? (
        <div className="card p-8 text-center">
          <ArrowPathIcon className="w-8 h-8 mx-auto text-text-muted animate-spin mb-4" />
          <p className="text-text-muted">加载静默规则中...</p>
        </div>
      ) : silences.length === 0 ? (
        <div className="card p-12 text-center">
          <BellSlashIcon className="w-12 h-12 mx-auto text-text-muted mb-4" />
          <p className="text-text-secondary">暂无静默规则</p>
          <p className="text-text-muted text-sm mt-2">
            创建静默规则以临时屏蔽特定告警
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary mt-4"
          >
            <PlusIcon className="w-4 h-4 mr-1" />
            创建第一个静默规则
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {silences.map((silence) => (
            <SilenceCard
              key={silence.id}
              silence={silence}
              onDelete={() => deleteMutation.mutate(silence.id)}
              isDeleting={deleteMutation.isPending}
            />
          ))}
        </div>
      )}

      {/* 创建静默弹窗 */}
      {showCreateModal && (
        <CreateSilenceModal
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
}

// 静默规则卡片
function SilenceCard({
  silence,
  onDelete,
  isDeleting,
}: {
  silence: Silence;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const startsAt = new Date(silence.startsAt);
  const endsAt = new Date(silence.endsAt);

  const getStateConfig = (state: string) => {
    switch (state) {
      case 'active':
        return {
          label: '活跃',
          color: 'text-green-400',
          bgColor: 'bg-green-500/10',
          borderColor: 'border-green-500/30',
          icon: CheckCircleIcon,
        };
      case 'pending':
        return {
          label: '待生效',
          color: 'text-yellow-400',
          bgColor: 'bg-yellow-500/10',
          borderColor: 'border-yellow-500/30',
          icon: ClockIcon,
        };
      case 'expired':
        return {
          label: '已过期',
          color: 'text-text-muted',
          bgColor: 'bg-[color-mix(in_srgb,var(--color-border-hover)_10%,transparent)]',
          borderColor: 'border-[color-mix(in_srgb,var(--color-border-hover)_30%,transparent)]',
          icon: ExclamationCircleIcon,
        };
      default:
        return {
          label: state,
          color: 'text-text-muted',
          bgColor: 'bg-[color-mix(in_srgb,var(--color-border-hover)_10%,transparent)]',
          borderColor: 'border-[color-mix(in_srgb,var(--color-border-hover)_30%,transparent)]',
          icon: BellSlashIcon,
        };
    }
  };

  const stateConfig = getStateConfig(silence.state);
  const StateIcon = stateConfig.icon;

  return (
    <>
      <div className={clsx(
        'card p-4 border-l-4',
        stateConfig.borderColor
      )}>
        <div className="flex items-start gap-4">
          {/* 图标 */}
          <div className={clsx('p-2 rounded-lg', stateConfig.bgColor)}>
            <StateIcon className={clsx('w-5 h-5', stateConfig.color)} />
          </div>

          {/* 内容 */}
          <div className="flex-1 min-w-0">
            {/* 头部 */}
            <div className="flex items-center gap-2 mb-2">
              <span className={clsx('badge', stateConfig.color)}>
                {stateConfig.label}
              </span>
              <span className="text-xs text-text-muted">
                ID: {silence.silenceId.slice(0, 8)}
              </span>
            </div>

            {/* 匹配器 */}
            <div className="mb-2">
              <div className="flex flex-wrap gap-2">
                {silence.matchers.map((matcher, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 text-xs bg-surface-secondary border border-border rounded"
                  >
                    {matcher.name}
                    {matcher.isEqual ? ' = ' : ' != '}
                    {matcher.isRegex ? `~"${matcher.value}"` : `"${matcher.value}"`}
                  </span>
                ))}
              </div>
            </div>

            {/* 备注 */}
            {silence.comment && (
              <p className="text-sm text-text-muted mb-2">{silence.comment}</p>
            )}

            {/* 时间和创建者 */}
            <div className="flex items-center gap-4 text-xs text-text-muted">
              <span>
                {startsAt.toLocaleString('zh-CN')} - {endsAt.toLocaleString('zh-CN')}
              </span>
              <span>由 {silence.createdBy} 创建</span>
              {silence.state === 'active' && (
                <span className="text-green-400">
                  剩余 {formatDistanceToNow(endsAt, { locale: zhCN })}
                </span>
              )}
            </div>
          </div>

          {/* 删除按钮 */}
          <button
            onClick={() => setShowDeleteConfirm(true)}
            disabled={isDeleting}
            className="btn btn-ghost btn-sm text-red-400 hover:text-red-300"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 删除确认弹窗 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="card max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-white mb-4">删除静默规则</h3>
            <p className="text-text-muted mb-4">
              确定要删除这条静默规则吗？删除后将立即恢复告警通知。
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="btn btn-ghost flex-1"
                disabled={isDeleting}
              >
                取消
              </button>
              <button
                onClick={() => {
                  onDelete();
                  setShowDeleteConfirm(false);
                }}
                className="btn btn-error flex-1"
                disabled={isDeleting}
              >
                {isDeleting ? '删除中...' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// 创建静默弹窗
function CreateSilenceModal({ onClose }: { onClose: () => void }) {
  const [matchers, setMatchers] = useState<Array<{ name: string; value: string; isRegex: boolean; isEqual: boolean }>>([
    { name: '', value: '', isRegex: false, isEqual: true },
  ]);
  const [duration, setDuration] = useState('2h');
  const [comment, setComment] = useState('');
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data: {
      matchers: Array<{ name: string; value: string; isRegex: boolean; isEqual: boolean }>;
      startsAt: string;
      endsAt: string;
      comment: string;
    }) => silenceApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['silences'] });
      onClose();
    },
  });

  const addMatcher = () => {
    setMatchers([...matchers, { name: '', value: '', isRegex: false, isEqual: true }]);
  };

  const removeMatcher = (index: number) => {
    if (matchers.length > 1) {
      setMatchers(matchers.filter((_, i) => i !== index));
    }
  };

  const updateMatcher = (index: number, field: string, value: string | boolean) => {
    const newMatchers = [...matchers];
    newMatchers[index] = { ...newMatchers[index], [field]: value };
    setMatchers(newMatchers);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // 验证
    const validMatchers = matchers.filter(m => m.name && m.value);
    if (validMatchers.length === 0 || !comment.trim()) {
      return;
    }

    // 计算时间
    const now = new Date();
    const durationMs = parseDuration(duration);
    const endsAt = new Date(now.getTime() + durationMs);

    createMutation.mutate({
      matchers: validMatchers,
      startsAt: now.toISOString(),
      endsAt: endsAt.toISOString(),
      comment: comment.trim(),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="card max-w-2xl w-full p-6 my-8">
        <h3 className="text-lg font-semibold text-white mb-4">创建静默规则</h3>
        <form onSubmit={handleSubmit}>
          {/* 匹配器 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-text-muted mb-2">
              匹配器（至少一个）
            </label>
            {matchers.map((matcher, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <input
                  type="text"
                  placeholder="标签名（如 alertname）"
                  value={matcher.name}
                  onChange={(e) => updateMatcher(index, 'name', e.target.value)}
                  className="input flex-1"
                  required
                />
                <select
                  value={matcher.isEqual ? '=' : '!='}
                  onChange={(e) => updateMatcher(index, 'isEqual', e.target.value === '=')}
                  className="select w-20"
                >
                  <option value="=">=</option>
                  <option value="!=">!=</option>
                </select>
                <input
                  type="text"
                  placeholder="值"
                  value={matcher.value}
                  onChange={(e) => updateMatcher(index, 'value', e.target.value)}
                  className="input flex-1"
                  required
                />
                <label className="flex items-center gap-1 px-3">
                  <input
                    type="checkbox"
                    checked={matcher.isRegex}
                    onChange={(e) => updateMatcher(index, 'isRegex', e.target.checked)}
                    className="checkbox"
                  />
                  <span className="text-xs text-text-muted">正则</span>
                </label>
                {matchers.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeMatcher(index)}
                    className="btn btn-ghost btn-sm text-red-400"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addMatcher}
              className="btn btn-ghost btn-sm text-blue-400 mt-2"
            >
              <PlusIcon className="w-4 h-4 mr-1" />
              添加匹配器
            </button>
          </div>

          {/* 持续时间 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-text-muted mb-2">
              持续时间
            </label>
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="select w-full"
            >
              <option value="30m">30 分钟</option>
              <option value="1h">1 小时</option>
              <option value="2h">2 小时</option>
              <option value="4h">4 小时</option>
              <option value="8h">8 小时</option>
              <option value="24h">24 小时</option>
              <option value="7d">7 天</option>
            </select>
          </div>

          {/* 备注 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-text-muted mb-2">
              备注（必填）
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="请输入静默原因..."
              className="input w-full h-20 resize-none"
              required
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-ghost flex-1"
              disabled={createMutation.isPending}
            >
              取消
            </button>
            <button
              type="submit"
              className="btn btn-primary flex-1"
              disabled={createMutation.isPending || !comment.trim()}
            >
              {createMutation.isPending ? '创建中...' : '创建静默'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// 解析持续时间
function parseDuration(duration: string): number {
  const unit = duration.slice(-1);
  const value = parseInt(duration.slice(0, -1));

  switch (unit) {
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      return 2 * 60 * 60 * 1000; // 默认 2 小时
  }
}
