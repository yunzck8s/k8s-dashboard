import { useState, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { ExclamationTriangleIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import type { ApprovalRequest } from '../types/agent';

interface ApprovalDialogProps {
  request: ApprovalRequest | null;
  open: boolean;
  onApprove: () => void;
  onReject: () => void;
}

const riskColors = {
  low: 'bg-green-100 text-green-800 border-green-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  high: 'bg-red-100 text-red-800 border-red-200',
};

const riskLabels = {
  low: '低风险',
  medium: '中等风险',
  high: '高风险',
};

export function ApprovalDialog({
  request,
  open,
  onApprove,
  onReject,
}: ApprovalDialogProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  if (!request) return null;

  const handleApprove = async () => {
    setIsProcessing(true);
    try {
      await onApprove();
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
          <div className="fixed inset-0 bg-black bg-opacity-25" />
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
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-lg bg-white p-6 shadow-xl transition-all">
                <div className="flex items-center gap-2 mb-4">
                  <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600" />
                  <Dialog.Title className="text-lg font-semibold text-gray-900">
                    操作审批
                  </Dialog.Title>
                </div>

                <p className="text-sm text-gray-600 mb-6">
                  AI Agent 请求执行以下操作，请仔细审查后决定是否批准。
                </p>

                <div className="space-y-4">
                  {/* 风险等级 */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">风险等级：</span>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full border ${riskColors[request.riskLevel]}`}>
                      {riskLabels[request.riskLevel]}
                    </span>
                  </div>

                  {/* 工具名称 */}
                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-1">工具名称</div>
                    <code className="text-sm bg-gray-100 px-3 py-2 rounded block">
                      {request.toolName}
                    </code>
                  </div>

                  {/* 操作描述 */}
                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-1">操作描述</div>
                    <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                      {request.description}
                    </div>
                  </div>

                  {/* 影响范围 */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-2">
                    <InformationCircleIcon className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-800">
                      <span className="font-medium">影响范围：</span>
                      {request.impact}
                    </div>
                  </div>

                  {/* 参数详情 */}
                  {Object.keys(request.arguments).length > 0 && (
                    <div>
                      <div className="text-sm font-medium text-gray-700 mb-2">参数详情</div>
                      <div className="bg-gray-50 p-3 rounded space-y-1">
                        {Object.entries(request.arguments).map(([key, value]) => (
                          <div key={key} className="text-sm">
                            <span className="font-medium text-gray-700">{key}:</span>{' '}
                            <span className="text-gray-600">
                              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 高风险警告 */}
                  {request.riskLevel === 'high' && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex gap-2">
                      <ExclamationTriangleIcon className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-red-800">
                        <span className="font-medium">警告：</span>
                        这是一个高风险操作，可能对集群造成重大影响，请谨慎操作！
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <button
                    type="button"
                    onClick={handleReject}
                    disabled={isProcessing}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                  >
                    拒绝
                  </button>
                  <button
                    type="button"
                    onClick={handleApprove}
                    disabled={isProcessing}
                    className={`px-4 py-2 text-sm font-medium text-white rounded-md disabled:opacity-50 ${
                      request.riskLevel === 'high'
                        ? 'bg-red-600 hover:bg-red-700'
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {isProcessing ? '处理中...' : '批准执行'}
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

