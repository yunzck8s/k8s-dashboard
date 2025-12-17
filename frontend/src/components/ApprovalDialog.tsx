import { useState, Fragment, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import {
  ExclamationTriangleIcon,
  InformationCircleIcon,
  PencilSquareIcon,
  CheckIcon,
  XMarkIcon,
  ShieldExclamationIcon,
} from '@heroicons/react/24/outline';
import type { ApprovalRequest } from '../types/agent';

interface ApprovalDialogProps {
  request: ApprovalRequest | null;
  open: boolean;
  onApprove: (editedArgs?: Record<string, unknown>) => void;
  onReject: () => void;
}

const riskConfig = {
  low: {
    bg: 'bg-[#00ff9f]/10',
    border: 'border-[#00ff9f]/30',
    text: 'text-[#00ff9f]',
    label: '低风险',
  },
  medium: {
    bg: 'bg-[#ffaa00]/10',
    border: 'border-[#ffaa00]/30',
    text: 'text-[#ffaa00]',
    label: '中等风险',
  },
  high: {
    bg: 'bg-[#ff006e]/10',
    border: 'border-[#ff006e]/30',
    text: 'text-[#ff006e]',
    label: '高风险',
  },
};

export function ApprovalDialog({
  request,
  open,
  onApprove,
  onReject,
}: ApprovalDialogProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedArgs, setEditedArgs] = useState<Record<string, unknown>>({});
  const [editError, setEditError] = useState<string | null>(null);

  // 当 request 变化时重置状态
  useEffect(() => {
    if (request) {
      setEditedArgs(request.arguments || {});
      setIsEditing(false);
      setEditError(null);
    }
  }, [request]);

  if (!request) return null;

  const risk = riskConfig[request.riskLevel] || riskConfig.low;
  const allowEdit = request.allowedDecisions?.includes('edit') ?? true;

  const handleApprove = async () => {
    setIsProcessing(true);
    try {
      await onApprove(isEditing ? editedArgs : undefined);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    setIsProcessing(true);
    try {
      await onReject();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleArgChange = (key: string, value: string) => {
    try {
      // 尝试解析 JSON，否则保持字符串
      const parsedValue = value.startsWith('{') || value.startsWith('[')
        ? JSON.parse(value)
        : isNaN(Number(value)) ? value : Number(value);
      setEditedArgs(prev => ({ ...prev, [key]: parsedValue }));
      setEditError(null);
    } catch {
      setEditedArgs(prev => ({ ...prev, [key]: value }));
      setEditError(`参数 ${key} 格式错误`);
    }
  };

  return (
    <Transition show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={() => !isProcessing && onReject()}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-[#0f1629] border border-[#ff006e]/30 shadow-2xl transition-all">
                {/* 头部 */}
                <div className="flex items-center gap-3 px-6 py-4 border-b border-[#ff006e]/20 bg-[#ff006e]/5">
                  <div className="w-10 h-10 rounded-xl bg-[#ff006e]/20 flex items-center justify-center">
                    <ShieldExclamationIcon className="h-6 w-6 text-[#ff006e]" />
                  </div>
                  <div>
                    <Dialog.Title className="text-lg font-bold text-white font-mono">
                      操作审批
                    </Dialog.Title>
                    <p className="text-xs text-gray-400 font-mono">
                      AI Agent 请求执行以下操作
                    </p>
                  </div>
                  <button
                    onClick={() => !isProcessing && onReject()}
                    className="ml-auto p-2 rounded-lg hover:bg-gray-700/50 transition-colors"
                  >
                    <XMarkIcon className="w-5 h-5 text-gray-400" />
                  </button>
                </div>

                {/* 内容 */}
                <div className="p-6 space-y-4">
                  {/* 风险等级和工具名称 */}
                  <div className="flex items-center gap-4">
                    <span className={`px-3 py-1.5 text-xs font-bold font-mono rounded-lg border ${risk.bg} ${risk.border} ${risk.text}`}>
                      {risk.label}
                    </span>
                    <code className="text-sm font-mono text-white bg-[#0a0e27] px-3 py-1.5 rounded-lg border border-gray-700/50">
                      {request.toolName}
                    </code>
                  </div>

                  {/* 操作描述 */}
                  <div className="bg-[#0a0e27]/50 rounded-xl p-4 border border-gray-700/30">
                    <div className="text-xs font-mono text-gray-500 mb-2">操作描述</div>
                    <div className="text-sm text-gray-300 font-mono">
                      {request.description}
                    </div>
                  </div>

                  {/* 影响范围 */}
                  <div className="bg-[#00ffff]/5 border border-[#00ffff]/20 rounded-xl p-4 flex gap-3">
                    <InformationCircleIcon className="h-5 w-5 text-[#00ffff] flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-mono text-[#00ffff] mb-1">影响范围</div>
                      <div className="text-sm text-gray-300 font-mono">{request.impact}</div>
                    </div>
                  </div>

                  {/* 参数详情 */}
                  {Object.keys(request.arguments || {}).length > 0 && (
                    <div className="bg-[#0a0e27]/50 rounded-xl p-4 border border-gray-700/30">
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-xs font-mono text-gray-500">参数详情</div>
                        {allowEdit && (
                          <button
                            onClick={() => setIsEditing(!isEditing)}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono transition-all ${
                              isEditing
                                ? 'bg-[#00ff9f]/20 text-[#00ff9f] border border-[#00ff9f]/30'
                                : 'bg-gray-700/30 text-gray-400 hover:text-gray-300 border border-gray-600/30'
                            }`}
                          >
                            <PencilSquareIcon className="w-4 h-4" />
                            {isEditing ? '编辑中' : '编辑参数'}
                          </button>
                        )}
                      </div>

                      <div className="space-y-2">
                        {Object.entries(isEditing ? editedArgs : request.arguments).map(([key, value]) => (
                          <div key={key} className="flex items-center gap-3">
                            <span className="text-sm font-mono text-[#00ff9f] min-w-[120px]">{key}:</span>
                            {isEditing ? (
                              <input
                                type="text"
                                value={typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                onChange={(e) => handleArgChange(key, e.target.value)}
                                className="flex-1 px-3 py-1.5 bg-[#0a0e27] border border-[#00ff9f]/30 rounded-lg text-sm font-mono text-white focus:outline-none focus:border-[#00ff9f]"
                              />
                            ) : (
                              <span className="text-sm font-mono text-gray-300">
                                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>

                      {editError && (
                        <div className="mt-3 text-xs text-red-400 font-mono">{editError}</div>
                      )}
                    </div>
                  )}

                  {/* 高风险警告 */}
                  {request.riskLevel === 'high' && (
                    <div className="bg-[#ff006e]/10 border border-[#ff006e]/30 rounded-xl p-4 flex gap-3">
                      <ExclamationTriangleIcon className="h-5 w-5 text-[#ff006e] flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-mono text-[#ff006e] mb-1">警告</div>
                        <div className="text-sm text-gray-300 font-mono">
                          这是一个高风险操作，可能对集群造成重大影响，请谨慎操作！
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 底部按钮 */}
                <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-700/30 bg-[#0a0e27]/30">
                  <button
                    type="button"
                    onClick={handleReject}
                    disabled={isProcessing}
                    className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold font-mono text-gray-300 bg-gray-700/30 border border-gray-600/30 rounded-xl hover:bg-gray-700/50 hover:border-gray-500/50 disabled:opacity-50 transition-all"
                  >
                    <XMarkIcon className="w-4 h-4" />
                    拒绝
                  </button>
                  <button
                    type="button"
                    onClick={handleApprove}
                    disabled={isProcessing || !!editError}
                    className={`flex items-center gap-2 px-5 py-2.5 text-sm font-bold font-mono rounded-xl disabled:opacity-50 transition-all ${
                      request.riskLevel === 'high'
                        ? 'bg-[#ff006e] hover:bg-[#ff006e]/80 text-white'
                        : 'bg-[#00ff9f] hover:bg-[#00ff9f]/80 text-[#0a0e27]'
                    }`}
                  >
                    <CheckIcon className="w-4 h-4" />
                    {isProcessing ? '处理中...' : isEditing ? '使用修改后参数执行' : '批准执行'}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
