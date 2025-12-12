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

  const getTrendColor = () => {
    switch (trend) {
      case 'up':
        return 'text-red-400 bg-red-500/10 border-red-500/20';
      case 'down':
        return 'text-green-400 bg-green-500/10 border-green-500/20';
      default:
        return 'text-slate-400 bg-slate-500/10 border-slate-500/20';
    }
  };

  return (
    <div className={clsx('flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-sm', getTrendColor())}>
      {getTrendIcon()}
      <span className="font-medium">
        {label}: {value >= 0 ? '+' : ''}{value.toFixed(1)}%
      </span>
    </div>
  );
}
