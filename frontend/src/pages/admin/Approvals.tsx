import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { approvalApi, type ApprovalRequest } from '../../api/auth';
import { useNotificationStore } from '../../store';
import { useAuthStore } from '../../store/auth';
import clsx from 'clsx';
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  FunnelIcon,
  ChatBubbleLeftIcon,
} from '@heroicons/react/24/outline';

// 状态标签
const statusConfig = {
  pending: {
    label: '待审批',
    color: 'bg-yellow-500/20 text-yellow-400',
    icon: ClockIcon,
  },
  approved: {
    label: '已批准',
    color: 'bg-green-500/20 text-green-400',
    icon: CheckCircleIcon,
  },
  rejected: {
    label: '已拒绝',
    color: 'bg-red-500/20 text-red-400',
    icon: XCircleIcon,
  },
};

// 操作类型映射
const actionLabels: Record<string, string> = {
  delete: '删除',
  scale: '扩缩容',
  restart: '重启',
  rollback: '回滚',
  drain: '驱逐节点',
};

// 资源类型映射
const resourceLabels: Record<string, string> = {
  deployment: 'Deployment',
  statefulset: 'StatefulSet',
  daemonset: 'DaemonSet',
  pod: 'Pod',
  node: 'Node',
  namespace: 'Namespace',
};

// 审批详情 Modal
function ApprovalDetailModal({
  approval,
  onClose,
  onApprove,
  onReject,
}: {
  approval: ApprovalRequest;
  onClose: () => void;
  onApprove: (comment: string) => Promise<void>;
  onReject: (comment: string) => Promise<void>;
}) {
  const [comment, setComment] = useState('');
  const [processing, setProcessing] = useState(false);
  const currentUser = useAuthStore((s) => s.user);

  const canReview =
    approval.status === 'pending' && currentUser?.role === 'admin';

  const handleApprove = async () => {
    setProcessing(true);
    await onApprove(comment);
    setProcessing(false);
  };

  const handleReject = async () => {
    setProcessing(true);
    await onReject(comment);
    setProcessing(false);
  };

  const StatusIcon = statusConfig[approval.status].icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-slate-800 rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">审批详情</h2>
          <span
            className={clsx(
              'px-2 py-1 rounded text-xs font-medium flex items-center gap-1',
              statusConfig[approval.status].color
            )}
          >
            <StatusIcon className="w-4 h-4" />
            {statusConfig[approval.status].label}
          </span>
        </div>

        <div className="p-4 space-y-4">
          {/* 请求信息 */}
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-slate-400">申请人</span>
              <span className="text-white">{approval.username}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">操作</span>
              <span className="text-white">
                {actionLabels[approval.action] || approval.action}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">资源类型</span>
              <span className="text-white">
                {resourceLabels[approval.resource] || approval.resource}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">资源名称</span>
              <span className="text-white font-mono">{approval.resourceName}</span>
            </div>
            {approval.namespace && (
              <div className="flex justify-between">
                <span className="text-slate-400">命名空间</span>
                <span className="text-white font-mono">{approval.namespace}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-400">申请时间</span>
              <span className="text-white">
                {new Date(approval.createdAt).toLocaleString()}
              </span>
            </div>
          </div>

          {/* 申请原因 */}
          {approval.reason && (
            <div>
              <label className="block text-slate-400 text-sm mb-1">申请原因</label>
              <div className="bg-slate-700 rounded-lg p-3 text-slate-200 text-sm">
                {approval.reason}
              </div>
            </div>
          )}

          {/* 审批结果（如果已处理） */}
          {approval.status !== 'pending' && (
            <div className="border-t border-slate-700 pt-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-400">审批人</span>
                <span className="text-white">{approval.reviewerName || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">审批时间</span>
                <span className="text-white">
                  {approval.reviewedAt
                    ? new Date(approval.reviewedAt).toLocaleString()
                    : '-'}
                </span>
              </div>
              {approval.reviewComment && (
                <div>
                  <label className="block text-slate-400 text-sm mb-1">审批意见</label>
                  <div className="bg-slate-700 rounded-lg p-3 text-slate-200 text-sm">
                    {approval.reviewComment}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 审批操作 */}
          {canReview && (
            <div className="border-t border-slate-700 pt-4">
              <label className="block text-slate-400 text-sm mb-2">审批意见</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="可选，填写审批意见..."
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white resize-none"
                rows={2}
              />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-4 border-t border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-300 hover:text-white"
          >
            关闭
          </button>
          {canReview && (
            <>
              <button
                onClick={handleReject}
                disabled={processing}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-600/50 text-white rounded-lg"
              >
                拒绝
              </button>
              <button
                onClick={handleApprove}
                disabled={processing}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 text-white rounded-lg"
              >
                批准
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Approvals() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const addNotification = useNotificationStore((s) => s.addNotification);

  const [statusFilter, setStatusFilter] = useState('');
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRequest | null>(
    null
  );

  // 获取审批列表
  const { data, isLoading } = useQuery({
    queryKey: ['approvals', { status: statusFilter }],
    queryFn: () => approvalApi.list({ status: statusFilter }),
  });

  // 获取待审批数量
  const { data: pendingData } = useQuery({
    queryKey: ['approvals', 'pending-count'],
    queryFn: () => approvalApi.getPendingCount(),
  });

  // 批准
  const approveMutation = useMutation({
    mutationFn: ({ id, comment }: { id: number; comment: string }) =>
      approvalApi.approve(id, comment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      addNotification({ type: 'success', title: '已批准' });
      setSelectedApproval(null);
    },
    onError: (err: Error) => {
      addNotification({ type: 'error', title: '操作失败', message: err.message });
    },
  });

  // 拒绝
  const rejectMutation = useMutation({
    mutationFn: ({ id, comment }: { id: number; comment: string }) =>
      approvalApi.reject(id, comment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      addNotification({ type: 'success', title: '已拒绝' });
      setSelectedApproval(null);
    },
    onError: (err: Error) => {
      addNotification({ type: 'error', title: '操作失败', message: err.message });
    },
  });

  return (
    <div className="space-y-6">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">审批管理</h1>
          <p className="text-slate-400 mt-1">
            审批危险操作请求
            {pendingData?.count ? (
              <span className="ml-2 px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-sm">
                {pendingData.count} 条待审批
              </span>
            ) : null}
          </p>
        </div>
      </div>

      {/* 筛选 */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-slate-400">
          <FunnelIcon className="w-5 h-5" />
          <span>状态：</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setStatusFilter('')}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-sm transition-colors',
              !statusFilter
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            )}
          >
            全部
          </button>
          {Object.entries(statusConfig).map(([key, config]) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-sm transition-colors',
                statusFilter === key
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              )}
            >
              {config.label}
            </button>
          ))}
        </div>
      </div>

      {/* 审批列表 */}
      <div className="bg-slate-800 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-slate-400">加载中...</div>
        ) : !data?.items?.length ? (
          <div className="p-8 text-center text-slate-400">暂无审批记录</div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-700/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">
                  申请人
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">
                  操作
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">
                  资源
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">
                  状态
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">
                  申请时间
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-slate-300">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {data.items.map((approval) => {
                const StatusIcon = statusConfig[approval.status].icon;
                return (
                  <tr key={approval.id} className="hover:bg-slate-700/30">
                    <td className="px-4 py-3 text-white">{approval.username}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-slate-700 rounded text-slate-200 text-sm">
                        {actionLabels[approval.action] || approval.action}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-white">
                        {resourceLabels[approval.resource] || approval.resource}
                      </div>
                      <div className="text-slate-400 text-sm font-mono">
                        {approval.namespace && `${approval.namespace}/`}
                        {approval.resourceName}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={clsx(
                          'inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium',
                          statusConfig[approval.status].color
                        )}
                      >
                        <StatusIcon className="w-4 h-4" />
                        {statusConfig[approval.status].label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-sm">
                      {new Date(approval.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedApproval(approval)}
                          className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg"
                          title="查看详情"
                        >
                          <ChatBubbleLeftIcon className="w-4 h-4" />
                        </button>
                        {approval.status === 'pending' &&
                          currentUser?.role === 'admin' && (
                            <>
                              <button
                                onClick={() =>
                                  approveMutation.mutate({
                                    id: approval.id,
                                    comment: '',
                                  })
                                }
                                className="p-2 text-green-400 hover:bg-green-500/20 rounded-lg"
                                title="批准"
                              >
                                <CheckCircleIcon className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() =>
                                  rejectMutation.mutate({
                                    id: approval.id,
                                    comment: '',
                                  })
                                }
                                className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg"
                                title="拒绝"
                              >
                                <XCircleIcon className="w-4 h-4" />
                              </button>
                            </>
                          )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 详情 Modal */}
      {selectedApproval && (
        <ApprovalDetailModal
          approval={selectedApproval}
          onClose={() => setSelectedApproval(null)}
          onApprove={async (comment) => {
            await approveMutation.mutateAsync({
              id: selectedApproval.id,
              comment,
            });
          }}
          onReject={async (comment) => {
            await rejectMutation.mutateAsync({
              id: selectedApproval.id,
              comment,
            });
          }}
        />
      )}
    </div>
  );
}
