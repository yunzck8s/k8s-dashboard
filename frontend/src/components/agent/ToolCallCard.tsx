import { useState, useEffect } from 'react';
import {
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  ClockIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import type { ToolCall } from '../../types/agent';

interface ToolCallCardProps {
  toolCall: ToolCall;
  result?: {
    success: boolean;
    result?: string;
    error?: string;
  };
  className?: string;
}

// 工具分类配置
const TOOL_CONFIG: Record<string, { category: string; color: string; riskLevel: string }> = {
  list_pods: { category: '查询', color: '#00ff9f', riskLevel: 'low' },
  get_pod: { category: '查询', color: '#00ff9f', riskLevel: 'low' },
  list_deployments: { category: '查询', color: '#00ff9f', riskLevel: 'low' },
  get_deployment: { category: '查询', color: '#00ff9f', riskLevel: 'low' },
  list_services: { category: '查询', color: '#00ff9f', riskLevel: 'low' },
  list_nodes: { category: '查询', color: '#00ff9f', riskLevel: 'low' },
  list_events: { category: '查询', color: '#00ff9f', riskLevel: 'low' },
  list_namespaces: { category: '查询', color: '#00ff9f', riskLevel: 'low' },
  get_pod_logs: { category: '诊断', color: '#00ffff', riskLevel: 'low' },
  describe_pod: { category: '诊断', color: '#00ffff', riskLevel: 'low' },
  check_pod_health: { category: '诊断', color: '#00ffff', riskLevel: 'low' },
  scale_deployment: { category: '操作', color: '#ff006e', riskLevel: 'medium' },
  restart_deployment: { category: '操作', color: '#ff006e', riskLevel: 'medium' },
  delete_pod: { category: '操作', color: '#ff006e', riskLevel: 'medium' },
};

export function ToolCallCard({ toolCall, result, className }: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);

  // 入场动画
  useEffect(() => {
    const timer = setTimeout(() => setAnimateIn(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const config = TOOL_CONFIG[toolCall.name] || {
    category: '其他',
    color: '#888888',
    riskLevel: 'low',
  };

  const isRunning = toolCall.status === 'running' || toolCall.status === 'pending';
  const isCompleted = toolCall.status === 'completed' || result;
  const isFailed = toolCall.status === 'failed' || (result && !result.success);
  const isHighRisk = config.riskLevel === 'medium' || config.riskLevel === 'high';

  // 格式化参数显示
  const formatArguments = (args: Record<string, any>) => {
    return Object.entries(args)
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
      .join(', ');
  };

  return (
    <div
      className={clsx(
        'rounded-xl border overflow-hidden transition-all duration-300',
        animateIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2',
        isRunning && 'shadow-lg',
        isFailed && 'border-red-500/30',
        !isFailed && 'border-gray-700/30',
        className
      )}
      style={{
        backgroundColor: isFailed ? 'rgba(239, 68, 68, 0.05)' : `${config.color}08`,
        boxShadow: isRunning ? `0 0 30px ${config.color}20` : undefined,
      }}
    >
      {/* 头部 */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {/* 状态图标 */}
        <div
          className={clsx(
            'w-10 h-10 rounded-lg flex items-center justify-center relative',
            isRunning && 'animate-pulse'
          )}
          style={{ backgroundColor: `${config.color}20` }}
        >
          {isRunning && (
            <ArrowPathIcon className="w-5 h-5 animate-spin" style={{ color: config.color }} />
          )}
          {isCompleted && !isFailed && (
            <CheckCircleIcon className="w-5 h-5 text-[#00ff9f]" />
          )}
          {isFailed && (
            <XCircleIcon className="w-5 h-5 text-red-500" />
          )}
          {!isRunning && !isCompleted && !isFailed && (
            <ClockIcon className="w-5 h-5 text-gray-400" />
          )}

          {/* 运行中的光晕 */}
          {isRunning && (
            <div
              className="absolute inset-0 rounded-lg animate-ping"
              style={{ backgroundColor: `${config.color}30` }}
            />
          )}
        </div>

        {/* 工具信息 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold font-mono text-white truncate">
              {toolCall.name}
            </span>
            <span
              className="text-xs px-2 py-0.5 rounded font-mono"
              style={{
                backgroundColor: `${config.color}20`,
                color: config.color,
              }}
            >
              {config.category}
            </span>
            {isHighRisk && (
              <ExclamationTriangleIcon className="w-4 h-4 text-[#ff006e]" />
            )}
          </div>
          <div className="text-xs text-gray-500 font-mono truncate mt-0.5">
            {formatArguments(toolCall.arguments)}
          </div>
        </div>

        {/* 状态标签 */}
        <div className="flex items-center gap-2">
          <StatusBadge status={toolCall.status} success={result?.success} />
          <button className="p-1 hover:bg-white/10 rounded transition-colors">
            {expanded ? (
              <ChevronUpIcon className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDownIcon className="w-4 h-4 text-gray-400" />
            )}
          </button>
        </div>
      </div>

      {/* 展开内容 */}
      {expanded && (
        <div className="px-4 py-3 border-t border-gray-700/30 bg-[#0a0e27]/50 space-y-3">
          {/* 参数详情 */}
          <div>
            <div className="text-xs text-gray-500 font-mono mb-1">参数</div>
            <pre className="text-xs text-gray-300 font-mono bg-black/30 rounded-lg p-3 overflow-x-auto">
              {JSON.stringify(toolCall.arguments, null, 2)}
            </pre>
          </div>

          {/* 执行结果 */}
          {result && (
            <div>
              <div className="text-xs text-gray-500 font-mono mb-1">结果</div>
              <pre
                className={clsx(
                  'text-xs font-mono rounded-lg p-3 overflow-x-auto max-h-48',
                  result.success ? 'text-[#00ff9f] bg-[#00ff9f]/5' : 'text-red-400 bg-red-500/5'
                )}
              >
                {result.success ? result.result : result.error}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* 进度条动画 */}
      {isRunning && (
        <div className="h-1 bg-[#0a0e27]">
          <div
            className="h-full animate-progress"
            style={{
              background: `linear-gradient(90deg, transparent, ${config.color}, transparent)`,
            }}
          />
        </div>
      )}

      {/* 自定义动画样式 */}
      <style>{`
        @keyframes progress {
          0% { transform: translateX(-100%); width: 50%; }
          100% { transform: translateX(200%); width: 50%; }
        }
        .animate-progress {
          animation: progress 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

// 状态徽章
function StatusBadge({ status, success }: { status: string; success?: boolean }) {
  const config = {
    pending: { text: '等待中', color: 'text-gray-400', bg: 'bg-gray-700/30' },
    running: { text: '执行中', color: 'text-[#ffaa00]', bg: 'bg-[#ffaa00]/10' },
    completed: { text: success !== false ? '成功' : '失败', color: success !== false ? 'text-[#00ff9f]' : 'text-red-400', bg: success !== false ? 'bg-[#00ff9f]/10' : 'bg-red-500/10' },
    failed: { text: '失败', color: 'text-red-400', bg: 'bg-red-500/10' },
  }[status] || { text: status, color: 'text-gray-400', bg: 'bg-gray-700/30' };

  return (
    <span className={clsx('text-xs px-2 py-1 rounded font-mono', config.color, config.bg)}>
      {config.text}
    </span>
  );
}

export default ToolCallCard;
