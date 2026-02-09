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
    bg: 'rgba(59, 130, 246, 0.1)',
    border: 'rgba(59, 130, 246, 0.3)',
    iconBg: 'rgba(59, 130, 246, 0.15)',
    iconColor: '#60A5FA',
    text: '#60A5FA',
  },
  green: {
    bg: 'rgba(16, 185, 129, 0.1)',
    border: 'rgba(16, 185, 129, 0.3)',
    iconBg: 'rgba(16, 185, 129, 0.15)',
    iconColor: '#34D399',
    text: '#34D399',
  },
  purple: {
    bg: 'rgba(99, 102, 241, 0.1)',
    border: 'rgba(99, 102, 241, 0.3)',
    iconBg: 'rgba(99, 102, 241, 0.15)',
    iconColor: '#818CF8',
    text: '#818CF8',
  },
  orange: {
    bg: 'rgba(245, 158, 11, 0.1)',
    border: 'rgba(245, 158, 11, 0.3)',
    iconBg: 'rgba(245, 158, 11, 0.15)',
    iconColor: '#FBBF24',
    text: '#FBBF24',
  },
  red: {
    bg: 'rgba(239, 68, 68, 0.1)',
    border: 'rgba(239, 68, 68, 0.3)',
    iconBg: 'rgba(239, 68, 68, 0.15)',
    iconColor: '#F87171',
    text: '#F87171',
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
        <div className="flex-1">
          <p
            className="text-xs font-medium uppercase tracking-wider mb-2"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {title}
          </p>
          <p
            className="text-3xl font-semibold mb-1"
            style={{ color: styles.text }}
          >
            {value}
          </p>
          {subtitle && (
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {subtitle}
            </p>
          )}
        </div>
        <div
          className="p-3 rounded-lg"
          style={{
            background: styles.iconBg,
          }}
        >
          <Icon className="w-6 h-6" style={{ color: styles.iconColor }} />
        </div>
      </div>

      {trend && (
        <div className="mt-4 flex items-center gap-2">
          <div
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium"
            style={{
              background: trend === 'up' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              color: trend === 'up' ? '#34D399' : '#F87171',
            }}
          >
            <span>{trend === 'up' ? '↑' : '↓'}</span>
            <span>{trend === 'up' ? '正常' : '警告'}</span>
          </div>
        </div>
      )}
    </>
  );

  const baseClasses = clsx(
    'relative p-6 rounded-xl transition-all duration-200',
  );

  if (isClickable) {
    return (
      <button
        onClick={onClick}
        className={clsx(baseClasses, 'w-full text-left cursor-pointer')}
        style={{
          background: isSelected ? styles.bg : 'var(--color-bg-secondary)',
          border: `1px solid ${isSelected ? styles.border : 'var(--color-border)'}`,
        }}
      >
        {cardContent}
      </button>
    );
  }

  return (
    <div
      className={baseClasses}
      style={{
        background: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border)',
      }}
    >
      {cardContent}
    </div>
  );
}
