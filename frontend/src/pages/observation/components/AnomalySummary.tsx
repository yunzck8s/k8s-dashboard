import type { ObservationSummary } from '../../../api';
import clsx from 'clsx';
import {
  ExclamationTriangleIcon,
  ServerIcon,
  CpuChipIcon,
  BellAlertIcon,
} from '@heroicons/react/24/outline';

interface AnomalySummaryProps {
  summary?: ObservationSummary;
  isLoading: boolean;
}

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  borderColor: string;
  isLoading: boolean;
}

function StatCard({ title, value, icon: Icon, color, bgColor, borderColor, isLoading }: StatCardProps) {
  return (
    <div
      className={clsx(
        'relative overflow-hidden rounded-xl border p-6 transition-all duration-300 hover:scale-[1.02]',
        borderColor,
        bgColor
      )}
    >
      {/* 背景装饰 */}
      <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-10" style={{ backgroundColor: color }} />

      <div className="relative flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-text-muted mb-1">{title}</p>
          {isLoading ? (
            <div className="h-9 w-16 bg-surface-tertiary animate-pulse rounded" />
          ) : (
            <p className={clsx('text-3xl font-bold', value > 0 ? color : 'text-text-secondary')}>
              {value}
            </p>
          )}
        </div>
        <div
          className={clsx(
            'p-3 rounded-xl',
            value > 0 ? bgColor : 'bg-[color-mix(in_srgb,var(--color-bg-tertiary)_50%,transparent)]'
          )}
        >
          <Icon className={clsx('w-6 h-6', value > 0 ? color : 'text-text-muted')} />
        </div>
      </div>

      {/* 状态指示器 */}
      {value > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-1" style={{ backgroundColor: color }} />
      )}
    </div>
  );
}

export default function AnomalySummary({ summary, isLoading }: AnomalySummaryProps) {
  const stats = [
    {
      title: 'Pod 异常',
      value: summary?.podAnomalyCount ?? 0,
      icon: ExclamationTriangleIcon,
      color: 'text-red-400',
      bgColor: 'bg-red-500/10',
      borderColor: 'border-red-500/20 hover:border-red-500/40',
    },
    {
      title: '节点异常',
      value: summary?.nodeAnomalyCount ?? 0,
      icon: ServerIcon,
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/10',
      borderColor: 'border-orange-500/20 hover:border-orange-500/40',
    },
    {
      title: '资源超限',
      value: summary?.resourceExcessCount ?? 0,
      icon: CpuChipIcon,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/10',
      borderColor: 'border-yellow-500/20 hover:border-yellow-500/40',
    },
    {
      title: '活跃告警',
      value: summary?.activeAlertCount ?? 0,
      icon: BellAlertIcon,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
      borderColor: 'border-purple-500/20 hover:border-purple-500/40',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <StatCard
          key={stat.title}
          {...stat}
          isLoading={isLoading}
        />
      ))}
    </div>
  );
}
