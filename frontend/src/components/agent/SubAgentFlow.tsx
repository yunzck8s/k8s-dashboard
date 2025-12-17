import { useMemo } from 'react';
import {
  CpuChipIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import type { SubAgentEvent } from '../../types/agent';

interface SubAgentFlowProps {
  events: SubAgentEvent[];
  className?: string;
}

// Agent 配置
const AGENT_CONFIG: Record<string, { name: string; color: string; icon: string }> = {
  'kubernetes-agent': {
    name: 'K8s Agent',
    color: '#00ff9f',
    icon: '☸️',
  },
  'prometheus-agent': {
    name: 'Prometheus Agent',
    color: '#ff6b6b',
    icon: '📊',
  },
  'cilium-agent': {
    name: 'Cilium Agent',
    color: '#00b8d4',
    icon: '🔗',
  },
  'master': {
    name: 'Master Agent',
    color: '#ff006e',
    icon: '🧠',
  },
};

export function SubAgentFlow({ events, className }: SubAgentFlowProps) {
  // 按 agent 分组事件
  const agentStates = useMemo(() => {
    const states: Record<string, { status: 'idle' | 'running' | 'completed' | 'error'; lastMessage?: string }> = {};

    events.forEach(event => {
      const agentName = event.agentName.toLowerCase();
      if (!states[agentName]) {
        states[agentName] = { status: 'idle' };
      }

      switch (event.eventType) {
        case 'start':
          states[agentName] = { status: 'running', lastMessage: event.content };
          break;
        case 'end':
          states[agentName] = { status: 'completed', lastMessage: event.content };
          break;
        case 'message':
          states[agentName].lastMessage = event.content;
          break;
      }
    });

    return states;
  }, [events]);

  // 获取活跃的 agents
  const activeAgents = useMemo(() => {
    return Object.entries(agentStates).filter(([, state]) => state.status !== 'idle');
  }, [agentStates]);

  if (activeAgents.length === 0) {
    return null;
  }

  return (
    <div className={clsx(
      'bg-[#0f1629]/80 backdrop-blur-sm rounded-xl border border-[#ff006e]/20 overflow-hidden',
      className
    )}>
      {/* 头部 */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#ff006e]/10">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#ff006e] to-[#ff006e]/50 flex items-center justify-center">
          <CpuChipIcon className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="text-sm font-bold text-[#ff006e] font-mono">Agent 协作</div>
          <div className="text-xs text-gray-500 font-mono">
            {activeAgents.filter(([, s]) => s.status === 'running').length} 个 Agent 运行中
          </div>
        </div>
      </div>

      {/* Agent 流程可视化 */}
      <div className="p-4">
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {/* Master Agent */}
          <AgentNode
            name="Master"
            icon="🧠"
            color="#ff006e"
            status="running"
          />

          {/* 连接线 */}
          {activeAgents.length > 0 && (
            <div className="flex items-center gap-1 text-[#ff006e]">
              <ArrowRightIcon className="w-5 h-5" />
            </div>
          )}

          {/* 子 Agents */}
          {activeAgents.map(([agentName, state], index) => {
            const config = AGENT_CONFIG[agentName] || {
              name: agentName,
              color: '#00ffff',
              icon: '🤖',
            };

            return (
              <div key={agentName} className="flex items-center gap-2">
                <AgentNode
                  name={config.name}
                  icon={config.icon}
                  color={config.color}
                  status={state.status}
                  message={state.lastMessage}
                />
                {index < activeAgents.length - 1 && (
                  <ArrowRightIcon className="w-4 h-4 text-gray-600" />
                )}
              </div>
            );
          })}
        </div>

        {/* 最新消息 */}
        {events.length > 0 && (
          <div className="mt-4 px-3 py-2 bg-[#0a0e27]/50 rounded-lg border border-gray-700/30">
            <div className="text-xs text-gray-500 font-mono mb-1">最新动态</div>
            <div className="text-sm text-gray-300 font-mono truncate">
              {events[events.length - 1].content}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Agent 节点组件
function AgentNode({
  name,
  icon,
  color,
  status,
  message,
}: {
  name: string;
  icon: string;
  color: string;
  status: 'idle' | 'running' | 'completed' | 'error';
  message?: string;
}) {
  const statusConfig = {
    idle: {
      Icon: null,
      animate: false,
      glow: false,
    },
    running: {
      Icon: ArrowPathIcon,
      animate: true,
      glow: true,
    },
    completed: {
      Icon: CheckCircleIcon,
      animate: false,
      glow: false,
    },
    error: {
      Icon: ExclamationCircleIcon,
      animate: false,
      glow: false,
    },
  };

  const config = statusConfig[status];

  return (
    <div className="relative group">
      <div
        className={clsx(
          'flex flex-col items-center gap-2 px-4 py-3 rounded-xl border transition-all',
          status === 'running' && 'shadow-lg',
          'hover:scale-105'
        )}
        style={{
          backgroundColor: `${color}10`,
          borderColor: `${color}40`,
          boxShadow: config.glow ? `0 0 20px ${color}30` : 'none',
        }}
      >
        {/* Agent 图标 */}
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center text-2xl"
          style={{ backgroundColor: `${color}20` }}
        >
          {icon}
        </div>

        {/* Agent 名称 */}
        <div className="text-xs font-bold font-mono" style={{ color }}>
          {name}
        </div>

        {/* 状态指示器 */}
        {config.Icon && (
          <div className={clsx('absolute -top-1 -right-1', status === 'error' && 'text-red-500')}>
            <config.Icon
              className={clsx('w-5 h-5', config.animate && 'animate-spin')}
              style={{ color: status === 'error' ? undefined : color }}
            />
          </div>
        )}

        {/* 运行中的动画光晕 */}
        {status === 'running' && (
          <div
            className="absolute inset-0 rounded-xl animate-pulse"
            style={{
              background: `radial-gradient(circle at center, ${color}20 0%, transparent 70%)`,
            }}
          />
        )}
      </div>

      {/* Tooltip */}
      {message && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-800 rounded-lg text-xs text-gray-300 font-mono whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 max-w-xs truncate">
          {message}
        </div>
      )}
    </div>
  );
}

export default SubAgentFlow;
