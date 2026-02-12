import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { deploymentApi, statefulSetApi } from '../../api';
import { usePollingInterval } from '../../utils/polling';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import clsx from 'clsx';
import {
  ClockIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

type ResourceType = 'Deployment' | 'StatefulSet';

interface RevisionItem {
  revision: number;
  name: string;
  createdAt: string;
  current: boolean;
  replicas?: number;
  image?: string;
}

interface RevisionHistoryProps {
  namespace: string;
  name: string;
  resourceType: ResourceType;
  onRollbackSuccess?: () => void;
}

export default function RevisionHistory({
  namespace,
  name,
  resourceType,
  onRollbackSuccess,
}: RevisionHistoryProps) {
  const pollingInterval = usePollingInterval('standard');
  const [selectedRevision, setSelectedRevision] = useState<number | null>(null);
  const [showRollbackConfirm, setShowRollbackConfirm] = useState(false);
  const queryClient = useQueryClient();

  // 获取修订历史
  const { data: revisions, isLoading, error } = useQuery({
    queryKey: ['revisions', resourceType, namespace, name],
    queryFn: async () => {
      if (resourceType === 'Deployment') {
        const result = await deploymentApi.getRevisions(namespace, name);
        // 后端返回简化格式，直接映射
        return (result.items || []).map((item) => ({
          revision: parseInt(item.revision || '0', 10),
          name: item.name,
          createdAt: item.created,
          current: (item.replicas || 0) > 0,
          replicas: item.replicas,
          image: item.image,
        })) as RevisionItem[];
      } else {
        const result = await statefulSetApi.getRevisions(namespace, name);
        return result.items as RevisionItem[];
      }
    },
    refetchInterval: pollingInterval,
  });

  // Deployment 回滚
  const deploymentRollbackMutation = useMutation({
    mutationFn: (revision: number) =>
      deploymentApi.rollback(namespace, name, { revision }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deployment', namespace, name] });
      queryClient.invalidateQueries({ queryKey: ['revisions', 'Deployment', namespace, name] });
      setShowRollbackConfirm(false);
      setSelectedRevision(null);
      onRollbackSuccess?.();
    },
  });

  // StatefulSet 回滚
  const statefulSetRollbackMutation = useMutation({
    mutationFn: (revision: number) =>
      statefulSetApi.rollback(namespace, name, revision),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['statefulset', namespace, name] });
      queryClient.invalidateQueries({ queryKey: ['revisions', 'StatefulSet', namespace, name] });
      setShowRollbackConfirm(false);
      setSelectedRevision(null);
      onRollbackSuccess?.();
    },
  });

  const handleRollback = () => {
    if (selectedRevision === null) return;

    if (resourceType === 'Deployment') {
      deploymentRollbackMutation.mutate(selectedRevision);
    } else {
      statefulSetRollbackMutation.mutate(selectedRevision);
    }
  };

  const isPending =
    deploymentRollbackMutation.isPending || statefulSetRollbackMutation.isPending;
  const isError =
    deploymentRollbackMutation.isError || statefulSetRollbackMutation.isError;

  if (isLoading) {
    return (
      <div className="bg-[color-mix(in_srgb,var(--color-bg-secondary)_50%,transparent)] rounded-lg p-4 border border-border">
        <div className="flex items-center gap-2 mb-4">
          <ClockIcon className="w-5 h-5 text-blue-400" />
          <h3 className="text-white font-medium">修订历史</h3>
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[color-mix(in_srgb,var(--color-bg-secondary)_50%,transparent)] rounded-lg p-4 border border-border">
        <div className="flex items-center gap-2 mb-4">
          <ClockIcon className="w-5 h-5 text-blue-400" />
          <h3 className="text-white font-medium">修订历史</h3>
        </div>
        <div className="text-center py-4 text-red-400">
          <ExclamationTriangleIcon className="w-8 h-8 mx-auto mb-2" />
          <p>加载修订历史失败</p>
        </div>
      </div>
    );
  }

  const sortedRevisions = [...(revisions || [])].sort((a, b) => b.revision - a.revision);

  return (
    <div className="bg-[color-mix(in_srgb,var(--color-bg-secondary)_50%,transparent)] rounded-lg p-4 border border-border">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ClockIcon className="w-5 h-5 text-blue-400" />
          <h3 className="text-white font-medium">修订历史</h3>
          <span className="text-xs text-text-muted">
            ({sortedRevisions.length} 个版本)
          </span>
        </div>
      </div>

      {sortedRevisions.length === 0 ? (
        <div className="text-center py-8 text-text-muted">
          <ClockIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>暂无修订历史</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sortedRevisions.map((rev) => (
            <div
              key={rev.revision}
              className={clsx(
                'flex items-center justify-between p-3 rounded-lg border transition-colors',
                rev.current
                  ? 'bg-green-500/10 border-green-500/20'
                  : 'bg-[color-mix(in_srgb,var(--color-bg-tertiary)_50%,transparent)] border-[color-mix(in_srgb,var(--color-border-hover)_50%,transparent)] hover:bg-surface-tertiary'
              )}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="flex-shrink-0">
                  <span className={clsx(
                    'inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium',
                    rev.current
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-surface-tertiary text-text-secondary'
                  )}>
                    {rev.revision}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white font-medium truncate">
                      {rev.name}
                    </span>
                    {rev.current && (
                      <span className="flex items-center gap-1 text-xs text-green-400">
                        <CheckCircleIcon className="w-4 h-4" />
                        当前版本
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-text-muted mt-1">
                    <span>
                      {rev.createdAt ? formatDistanceToNow(new Date(rev.createdAt), {
                        addSuffix: true,
                        locale: zhCN,
                      }) : '时间未知'}
                    </span>
                    {rev.image && (
                      <span className="truncate max-w-[200px]" title={rev.image}>
                        镜像: {rev.image.split('/').pop()?.split(':').slice(0, 2).join(':')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {!rev.current && (
                <button
                  onClick={() => {
                    setSelectedRevision(rev.revision);
                    setShowRollbackConfirm(true);
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-surface-tertiary hover:bg-border-hover text-white rounded transition-colors ml-2"
                >
                  <ArrowPathIcon className="w-4 h-4" />
                  回滚
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 回滚确认对话框 */}
      {showRollbackConfirm && selectedRevision !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface-secondary rounded-lg p-6 max-w-md w-full mx-4 border border-border">
            <h3 className="text-lg font-medium text-white mb-4">确认回滚</h3>
            <p className="text-text-secondary mb-6">
              确定要将 <span className="text-white font-medium">{name}</span> 回滚到版本{' '}
              <span className="text-blue-400 font-medium">{selectedRevision}</span> 吗？
            </p>
            {isError && (
              <div className="mb-4 p-2 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-sm">
                回滚失败，请重试
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowRollbackConfirm(false);
                  setSelectedRevision(null);
                }}
                disabled={isPending}
                className="px-4 py-2 bg-surface-tertiary hover:bg-surface-tertiary text-white rounded transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleRollback}
                disabled={isPending}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    回滚中...
                  </>
                ) : (
                  <>
                    <ArrowPathIcon className="w-4 h-4" />
                    确认回滚
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
