import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deploymentApi, statefulSetApi, daemonSetApi } from '../../api';
import clsx from 'clsx';
import {
  Cog6ToothIcon,
  CheckIcon,
  XMarkIcon,
  PencilSquareIcon,
} from '@heroicons/react/24/outline';

// 资源类型
type ResourceType = 'Deployment' | 'StatefulSet' | 'DaemonSet';

// 滚动更新策略类型
interface DeploymentStrategy {
  type: 'RollingUpdate' | 'Recreate';
  maxUnavailable?: string;
  maxSurge?: string;
}

interface StatefulSetStrategy {
  type: 'RollingUpdate' | 'OnDelete';
  partition?: number;
}

interface DaemonSetStrategy {
  type: 'RollingUpdate' | 'OnDelete';
  maxUnavailable?: string;
  maxSurge?: string;
}

type StrategyType = DeploymentStrategy | StatefulSetStrategy | DaemonSetStrategy;

interface UpdateStrategyEditorProps {
  namespace: string;
  name: string;
  resourceType: ResourceType;
  currentStrategy: StrategyType;
  onSuccess?: () => void;
}

export default function UpdateStrategyEditor({
  namespace,
  name,
  resourceType,
  currentStrategy,
  onSuccess,
}: UpdateStrategyEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [strategy, setStrategy] = useState<StrategyType>(currentStrategy);
  const queryClient = useQueryClient();

  useEffect(() => {
    setStrategy(currentStrategy);
  }, [currentStrategy]);

  // Deployment 更新策略
  const deploymentMutation = useMutation({
    mutationFn: (data: DeploymentStrategy) =>
      deploymentApi.updateStrategy(namespace, name, {
        type: data.type,
        maxUnavailable: data.maxUnavailable,
        maxSurge: data.maxSurge,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deployment', namespace, name] });
      setIsEditing(false);
      onSuccess?.();
    },
  });

  // StatefulSet 更新策略
  const statefulSetMutation = useMutation({
    mutationFn: (data: StatefulSetStrategy) =>
      statefulSetApi.updateStrategy(namespace, name, {
        type: data.type,
        partition: data.partition,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['statefulset', namespace, name] });
      setIsEditing(false);
      onSuccess?.();
    },
  });

  // DaemonSet 更新策略
  const daemonSetMutation = useMutation({
    mutationFn: (data: DaemonSetStrategy) =>
      daemonSetApi.updateStrategy(namespace, name, {
        type: data.type,
        maxUnavailable: data.maxUnavailable,
        maxSurge: data.maxSurge,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daemonset', namespace, name] });
      setIsEditing(false);
      onSuccess?.();
    },
  });

  const handleSave = () => {
    switch (resourceType) {
      case 'Deployment':
        deploymentMutation.mutate(strategy as DeploymentStrategy);
        break;
      case 'StatefulSet':
        statefulSetMutation.mutate(strategy as StatefulSetStrategy);
        break;
      case 'DaemonSet':
        daemonSetMutation.mutate(strategy as DaemonSetStrategy);
        break;
    }
  };

  const handleCancel = () => {
    setStrategy(currentStrategy);
    setIsEditing(false);
  };

  const isPending =
    deploymentMutation.isPending ||
    statefulSetMutation.isPending ||
    daemonSetMutation.isPending;

  // 获取策略类型选项
  const getTypeOptions = () => {
    switch (resourceType) {
      case 'Deployment':
        return ['RollingUpdate', 'Recreate'];
      case 'StatefulSet':
      case 'DaemonSet':
        return ['RollingUpdate', 'OnDelete'];
    }
  };

  // 渲染只读视图
  const renderReadOnlyView = () => {
    const deploymentStrategy = strategy as DeploymentStrategy;
    const statefulSetStrategy = strategy as StatefulSetStrategy;
    const daemonSetStrategy = strategy as DaemonSetStrategy;

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-text-muted">类型:</span>
          <span className={clsx(
            'px-2 py-0.5 rounded text-xs font-medium',
            strategy.type === 'RollingUpdate' ? 'bg-blue-500/20 text-blue-400' :
            strategy.type === 'Recreate' ? 'bg-orange-500/20 text-orange-400' :
            'bg-[color-mix(in_srgb,var(--color-border-hover)_20%,transparent)] text-text-muted'
          )}>
            {strategy.type}
          </span>
        </div>

        {resourceType === 'Deployment' && deploymentStrategy.type === 'RollingUpdate' && (
          <>
            <div className="flex items-center gap-2">
              <span className="text-text-muted">最大不可用:</span>
              <span className="text-white">{deploymentStrategy.maxUnavailable || '25%'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-text-muted">最大超额:</span>
              <span className="text-white">{deploymentStrategy.maxSurge || '25%'}</span>
            </div>
          </>
        )}

        {resourceType === 'StatefulSet' && statefulSetStrategy.type === 'RollingUpdate' && (
          <div className="flex items-center gap-2">
            <span className="text-text-muted">分区:</span>
            <span className="text-white">{statefulSetStrategy.partition ?? 0}</span>
          </div>
        )}

        {resourceType === 'DaemonSet' && daemonSetStrategy.type === 'RollingUpdate' && (
          <>
            <div className="flex items-center gap-2">
              <span className="text-text-muted">最大不可用:</span>
              <span className="text-white">{daemonSetStrategy.maxUnavailable || '1'}</span>
            </div>
            {daemonSetStrategy.maxSurge && (
              <div className="flex items-center gap-2">
                <span className="text-text-muted">最大超额:</span>
                <span className="text-white">{daemonSetStrategy.maxSurge}</span>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  // 渲染编辑视图
  const renderEditView = () => {
    const deploymentStrategy = strategy as DeploymentStrategy;
    const statefulSetStrategy = strategy as StatefulSetStrategy;
    const daemonSetStrategy = strategy as DaemonSetStrategy;

    return (
      <div className="space-y-4">
        {/* 策略类型 */}
        <div>
          <label className="block text-sm text-text-muted mb-1">更新策略类型</label>
          <select
            className="w-full bg-surface-tertiary border border-border-hover rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={strategy.type}
            onChange={(e) => setStrategy({ ...strategy, type: e.target.value as 'RollingUpdate' | 'Recreate' | 'OnDelete' })}
          >
            {getTypeOptions().map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        {/* Deployment RollingUpdate 参数 */}
        {resourceType === 'Deployment' && strategy.type === 'RollingUpdate' && (
          <>
            <div>
              <label className="block text-sm text-text-muted mb-1">
                最大不可用 (maxUnavailable)
              </label>
              <input
                type="text"
                className="w-full bg-surface-tertiary border border-border-hover rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="例如: 25% 或 1"
                value={deploymentStrategy.maxUnavailable || ''}
                onChange={(e) =>
                  setStrategy({ ...strategy, maxUnavailable: e.target.value } as DeploymentStrategy)
                }
              />
              <p className="text-xs text-text-muted mt-1">
                更新期间最多可以有多少 Pod 不可用，可以是数字或百分比
              </p>
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-1">
                最大超额 (maxSurge)
              </label>
              <input
                type="text"
                className="w-full bg-surface-tertiary border border-border-hover rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="例如: 25% 或 1"
                value={deploymentStrategy.maxSurge || ''}
                onChange={(e) =>
                  setStrategy({ ...strategy, maxSurge: e.target.value } as DeploymentStrategy)
                }
              />
              <p className="text-xs text-text-muted mt-1">
                更新期间最多可以创建多少额外 Pod，可以是数字或百分比
              </p>
            </div>
          </>
        )}

        {/* StatefulSet RollingUpdate 参数 */}
        {resourceType === 'StatefulSet' && strategy.type === 'RollingUpdate' && (
          <div>
            <label className="block text-sm text-text-muted mb-1">
              分区 (partition)
            </label>
            <input
              type="number"
              className="w-full bg-surface-tertiary border border-border-hover rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="0"
              value={statefulSetStrategy.partition ?? 0}
              onChange={(e) =>
                setStrategy({ ...strategy, partition: parseInt(e.target.value, 10) } as StatefulSetStrategy)
              }
            />
            <p className="text-xs text-text-muted mt-1">
              序号大于等于 partition 的 Pod 才会被更新
            </p>
          </div>
        )}

        {/* DaemonSet RollingUpdate 参数 */}
        {resourceType === 'DaemonSet' && strategy.type === 'RollingUpdate' && (
          <>
            <div>
              <label className="block text-sm text-text-muted mb-1">
                最大不可用 (maxUnavailable)
              </label>
              <input
                type="text"
                className="w-full bg-surface-tertiary border border-border-hover rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="例如: 1 或 10%"
                value={daemonSetStrategy.maxUnavailable || ''}
                onChange={(e) =>
                  setStrategy({ ...strategy, maxUnavailable: e.target.value } as DaemonSetStrategy)
                }
              />
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-1">
                最大超额 (maxSurge)
              </label>
              <input
                type="text"
                className="w-full bg-surface-tertiary border border-border-hover rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="例如: 0 或 10%"
                value={daemonSetStrategy.maxSurge || ''}
                onChange={(e) =>
                  setStrategy({ ...strategy, maxSurge: e.target.value } as DaemonSetStrategy)
                }
              />
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="bg-[color-mix(in_srgb,var(--color-bg-secondary)_50%,transparent)] rounded-lg p-4 border border-border">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Cog6ToothIcon className="w-5 h-5 text-blue-400" />
          <h3 className="text-white font-medium">更新策略</h3>
        </div>
        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-surface-tertiary hover:bg-surface-tertiary text-white rounded transition-colors"
          >
            <PencilSquareIcon className="w-4 h-4" />
            编辑
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={handleCancel}
              disabled={isPending}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-surface-tertiary hover:bg-surface-tertiary text-white rounded transition-colors disabled:opacity-50"
            >
              <XMarkIcon className="w-4 h-4" />
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={isPending}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors disabled:opacity-50"
            >
              {isPending ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              ) : (
                <CheckIcon className="w-4 h-4" />
              )}
              保存
            </button>
          </div>
        )}
      </div>

      {isEditing ? renderEditView() : renderReadOnlyView()}

      {(deploymentMutation.isError || statefulSetMutation.isError || daemonSetMutation.isError) && (
        <div className="mt-3 p-2 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-sm">
          保存失败，请重试
        </div>
      )}
    </div>
  );
}
