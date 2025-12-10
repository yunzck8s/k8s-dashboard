import clsx from 'clsx';

interface StatsCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  color: 'blue' | 'green' | 'purple' | 'orange' | 'red';
  trend?: 'up' | 'down';
  onClick?: () => void;
  isSelected?: boolean;
}

const colorStyles = {
  blue: {
    bg: 'bg-blue-500/10',
    bgSelected: 'bg-blue-500/20',
    border: 'border-blue-500/20',
    borderSelected: 'border-blue-500/50',
    ring: 'ring-blue-500/50',
    icon: 'text-blue-500',
    value: 'text-blue-400',
  },
  green: {
    bg: 'bg-green-500/10',
    bgSelected: 'bg-green-500/20',
    border: 'border-green-500/20',
    borderSelected: 'border-green-500/50',
    ring: 'ring-green-500/50',
    icon: 'text-green-500',
    value: 'text-green-400',
  },
  purple: {
    bg: 'bg-purple-500/10',
    bgSelected: 'bg-purple-500/20',
    border: 'border-purple-500/20',
    borderSelected: 'border-purple-500/50',
    ring: 'ring-purple-500/50',
    icon: 'text-purple-500',
    value: 'text-purple-400',
  },
  orange: {
    bg: 'bg-orange-500/10',
    bgSelected: 'bg-orange-500/20',
    border: 'border-orange-500/20',
    borderSelected: 'border-orange-500/50',
    ring: 'ring-orange-500/50',
    icon: 'text-orange-500',
    value: 'text-orange-400',
  },
  red: {
    bg: 'bg-red-500/10',
    bgSelected: 'bg-red-500/20',
    border: 'border-red-500/20',
    borderSelected: 'border-red-500/50',
    ring: 'ring-red-500/50',
    icon: 'text-red-500',
    value: 'text-red-400',
  },
};

export default function StatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
  trend,
  onClick,
  isSelected,
}: StatsCardProps) {
  const styles = colorStyles[color];
  const isClickable = !!onClick;

  const cardContent = (
    <>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-400">{title}</p>
          <p className={clsx('text-3xl font-bold mt-2', styles.value)}>{value}</p>
          {subtitle && (
            <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
          )}
        </div>
        <div className={clsx('p-3 rounded-lg', styles.bg)}>
          <Icon className={clsx('w-6 h-6', styles.icon)} />
        </div>
      </div>
      {trend && (
        <div className="mt-4 flex items-center gap-1">
          <span
            className={clsx(
              'text-sm font-medium',
              trend === 'up' ? 'text-green-400' : 'text-red-400'
            )}
          >
            {trend === 'up' ? '↑' : '↓'}
          </span>
          <span className="text-sm text-slate-400">
            {trend === 'up' ? '状态正常' : '需要关注'}
          </span>
        </div>
      )}
    </>
  );

  if (isClickable) {
    return (
      <button
        onClick={onClick}
        className={clsx(
          'card p-6 border text-left transition-all w-full',
          isSelected ? styles.bgSelected : styles.bg,
          isSelected ? styles.borderSelected : styles.border,
          isSelected && 'ring-2',
          isSelected && styles.ring,
          'hover:scale-[1.02] hover:shadow-lg'
        )}
      >
        {cardContent}
      </button>
    );
  }

  return (
    <div className={clsx(
      'card p-6 border transition-all',
      styles.bg,
      styles.border,
      'hover:scale-[1.02] hover:shadow-lg hover:border-slate-600'
    )}>
      {cardContent}
    </div>
  );
}
