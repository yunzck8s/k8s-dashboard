import clsx from 'clsx';
import { ArrowTrendingUpIcon, ArrowTrendingDownIcon, MinusIcon } from '@heroicons/react/24/outline';

interface ComparisonBadgeProps {
  label: string;
  value: number;
  trend: 'up' | 'down' | 'stable';
}

export default function ComparisonBadge({ label, value, trend }: ComparisonBadgeProps) {
  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return <ArrowTrendingUpIcon className="w-4 h-4" />;
      case 'down':
        return <ArrowTrendingDownIcon className="w-4 h-4" />;
      default:
        return <MinusIcon className="w-4 h-4" />;
    }
  };

  const getTrendClass = () => {
    switch (trend) {
      case 'up':
        return 'text-[var(--color-error)] bg-[var(--sys-error-soft-bg)] border-[var(--sys-error-soft-border)]';
      case 'down':
        return 'text-[var(--color-success)] bg-[var(--sys-success-soft-bg)] border-[var(--sys-success-soft-border)]';
      default:
        return 'text-[var(--color-text-muted)] bg-[var(--color-bg-tertiary)] border-[var(--color-border)]';
    }
  };

  return (
    <div className={clsx('flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-sm', getTrendClass())}>
      {getTrendIcon()}
      <span className="font-medium">
        {label}: {value >= 0 ? '+' : ''}{value.toFixed(1)}%
      </span>
    </div>
  );
}
