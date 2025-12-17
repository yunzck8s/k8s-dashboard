import { useMemo } from 'react';
import {
  CheckCircleIcon,
  ClockIcon,
  ArrowPathIcon,
  ListBulletIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import type { TodoItem } from '../../types/agent';

interface TodoListPanelProps {
  todos: TodoItem[];
  className?: string;
  collapsed?: boolean;
  onToggle?: () => void;
}

export function TodoListPanel({ todos, className, collapsed = false, onToggle }: TodoListPanelProps) {
  // 统计各状态数量
  const stats = useMemo(() => {
    const completed = todos.filter(t => t.status === 'completed').length;
    const inProgress = todos.filter(t => t.status === 'in_progress').length;
    const pending = todos.filter(t => t.status === 'pending').length;
    const total = todos.length;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { completed, inProgress, pending, total, progress };
  }, [todos]);

  if (todos.length === 0) {
    return null;
  }

  return (
    <div className={clsx(
      'bg-[#0f1629]/80 backdrop-blur-sm rounded-xl border border-[#00ffff]/20 overflow-hidden transition-all',
      className
    )}>
      {/* 头部 */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-[#00ffff]/10 cursor-pointer hover:bg-[#00ffff]/5 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00ffff] to-[#00ffff]/50 flex items-center justify-center">
            <ListBulletIcon className="w-5 h-5 text-[#0a0e27]" />
          </div>
          <div>
            <div className="text-sm font-bold text-[#00ffff] font-mono">任务规划</div>
            <div className="text-xs text-gray-500 font-mono">
              {stats.completed}/{stats.total} 已完成
            </div>
          </div>
        </div>

        {/* 进度条 */}
        <div className="flex items-center gap-3">
          <div className="w-24 h-2 bg-[#0a0e27] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#00ff9f] to-[#00ffff] transition-all duration-500"
              style={{ width: `${stats.progress}%` }}
            />
          </div>
          <span className="text-xs font-mono text-[#00ff9f]">{stats.progress}%</span>
        </div>
      </div>

      {/* 任务列表 */}
      {!collapsed && (
        <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
          {todos.map((todo, index) => (
            <TodoItemRow key={todo.id || index} todo={todo} index={index} />
          ))}
        </div>
      )}

      {/* 底部状态栏 */}
      {!collapsed && (
        <div className="flex items-center justify-between px-4 py-2 bg-[#0a0e27]/50 border-t border-[#00ffff]/10">
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="flex items-center gap-1 text-[#00ff9f]">
              <CheckCircleIcon className="w-4 h-4" />
              {stats.completed} 完成
            </span>
            <span className="flex items-center gap-1 text-[#ffaa00]">
              <ArrowPathIcon className="w-4 h-4 animate-spin" />
              {stats.inProgress} 进行中
            </span>
            <span className="flex items-center gap-1 text-gray-500">
              <ClockIcon className="w-4 h-4" />
              {stats.pending} 待处理
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// 单个任务项
function TodoItemRow({ todo, index }: { todo: TodoItem; index: number }) {
  const statusConfig: Record<string, {
    icon: typeof ClockIcon;
    color: string;
    bgColor: string;
    borderColor: string;
    label: string;
    animate?: boolean;
  }> = {
    pending: {
      icon: ClockIcon,
      color: 'text-gray-400',
      bgColor: 'bg-gray-700/30',
      borderColor: 'border-gray-600/30',
      label: '待处理',
    },
    in_progress: {
      icon: ArrowPathIcon,
      color: 'text-[#ffaa00]',
      bgColor: 'bg-[#ffaa00]/10',
      borderColor: 'border-[#ffaa00]/30',
      label: '进行中',
      animate: true,
    },
    completed: {
      icon: CheckCircleIcon,
      color: 'text-[#00ff9f]',
      bgColor: 'bg-[#00ff9f]/10',
      borderColor: 'border-[#00ff9f]/30',
      label: '已完成',
    },
  };

  const config = statusConfig[todo.status] || statusConfig.pending;
  const Icon = config.icon;

  return (
    <div className={clsx(
      'flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all',
      config.bgColor,
      config.borderColor,
      todo.status === 'in_progress' && 'shadow-lg shadow-[#ffaa00]/10'
    )}>
      {/* 序号 */}
      <div className={clsx(
        'w-6 h-6 rounded flex items-center justify-center text-xs font-bold font-mono',
        todo.status === 'completed' ? 'bg-[#00ff9f]/20 text-[#00ff9f]' : 'bg-gray-700/50 text-gray-500'
      )}>
        {index + 1}
      </div>

      {/* 内容 */}
      <div className="flex-1 min-w-0">
        <div className={clsx(
          'text-sm font-mono truncate',
          todo.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-200'
        )}>
          {todo.content}
        </div>
      </div>

      {/* 状态图标 */}
      <div className={clsx('flex items-center gap-1.5', config.color)}>
        <Icon className={clsx('w-4 h-4', config.animate && 'animate-spin')} />
        <span className="text-xs font-mono hidden sm:inline">{config.label}</span>
      </div>
    </div>
  );
}

export default TodoListPanel;
