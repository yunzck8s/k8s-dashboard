import clsx from 'clsx';
import type { ComponentType, CSSProperties } from 'react';

interface StatsCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: ComponentType<{ className?: string; style?: CSSProperties }>;
  color: 'blue' | 'green' | 'purple' | 'orange' | 'red';
  variant?: 'executive' | 'standard';
  trend?: 'up' | 'down';
  onClick?: () => void;
  isSelected?: boolean;
}

const colorStyles = {
  blue: {
    bg: 'var(--sys-info-soft-bg)',
    border: 'var(--sys-info-soft-border)',
    iconBg: 'var(--sys-info-soft-bg)',
    iconColor: 'var(--color-info)',
    text: 'var(--color-info)',
  },
  green: {
    bg: 'var(--sys-success-soft-bg)',
    border: 'var(--sys-success-soft-border)',
    iconBg: 'var(--sys-success-soft-bg)',
    iconColor: 'var(--color-success)',
    text: 'var(--color-success)',
  },
  purple: {
    bg: 'var(--color-primary-light)',
    border: 'var(--color-border-hover)',
    iconBg: 'var(--color-primary-light)',
    iconColor: 'var(--color-primary)',
    text: 'var(--color-primary)',
  },
  orange: {
    bg: 'var(--sys-warning-soft-bg)',
    border: 'var(--sys-warning-soft-border)',
    iconBg: 'var(--sys-warning-soft-bg)',
    iconColor: 'var(--color-warning)',
    text: 'var(--color-warning)',
  },
  red: {
    bg: 'var(--sys-error-soft-bg)',
    border: 'var(--sys-error-soft-border)',
    iconBg: 'var(--sys-error-soft-bg)',
    iconColor: 'var(--color-error)',
    text: 'var(--color-error)',
  },
};

export default function StatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
  variant = 'standard',
  trend,
  onClick,
  isSelected,
}: StatsCardProps) {
  const styles = colorStyles[color];
  const isClickable = !!onClick;
  const isExecutive = variant === 'executive';

  const cardContent = (
    <>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p
            className={clsx(
              'mb-2 text-[var(--color-text-secondary)]',
              isExecutive
                ? 'text-sm font-medium'
                : 'text-xs font-medium uppercase tracking-wider'
            )}
          >
            {title}
          </p>
          <p
            className={clsx(
              'mb-1',
              isExecutive
                ? 'font-heading text-3xl font-semibold leading-9 tabular-nums'
                : 'kpi-number'
            )}
            style={{ color: styles.text }}
          >
            {value}
          </p>
          {subtitle && (
            <p className={clsx('text-[var(--color-text-muted)]', isExecutive ? 'text-sm' : 'text-xs')}>
              {subtitle}
            </p>
          )}
        </div>
        <div
          className={clsx('rounded-lg', isExecutive ? 'p-2.5' : 'p-3')}
          style={{
            background: styles.iconBg,
          }}
        >
          <Icon className={clsx(isExecutive ? 'h-5 w-5' : 'h-6 w-6')} style={{ color: styles.iconColor }} />
        </div>
      </div>

      {trend && (
        <div className="mt-4 flex items-center gap-2">
          <div
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium"
            style={{
              background: trend === 'up' ? 'var(--sys-success-soft-bg)' : 'var(--sys-error-soft-bg)',
              color: trend === 'up' ? 'var(--sys-success-soft-text)' : 'var(--sys-error-soft-text)',
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
    'relative rounded-xl transition-all duration-200 ease-out',
    isExecutive ? 'p-5' : 'p-6'
  );

  if (isClickable) {
    return (
      <button
        onClick={onClick}
        className={clsx(
          baseClasses,
          'w-full cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring'
        )}
        style={{
          background: isSelected ? styles.bg : 'var(--color-bg-secondary)',
          border: `1px solid ${isSelected ? styles.border : 'var(--color-border)'}`,
        }}
        aria-label={`${title} 详情`}
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
