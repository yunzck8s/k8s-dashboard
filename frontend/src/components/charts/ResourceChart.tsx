import { formatResourceUsage, getUsageColor, getUsageLevel } from '../../utils/format';
import clsx from 'clsx';

interface ResourceChartProps {
  used: number;
  total: number;
  unit: string;
  color?: string;
  title?: string;
  showLegend?: boolean;
  size?: 'sm' | 'md';
  onClick?: () => void;
  isSelected?: boolean;
}

export default function ResourceChart({
  used,
  total,
  unit,
  color,
  title,
  showLegend = true,
  size = 'md',
  onClick,
  isSelected,
}: ResourceChartProps) {
  const sizeConfig = size === 'sm'
    ? {
        diameter: 152,
        radius: 56,
        strokeWidth: 10,
        valueClassName: 'text-3xl',
        unitClassName: 'text-sm',
      }
    : {
        diameter: 180,
        radius: 70,
        strokeWidth: 12,
        valueClassName: 'text-4xl',
        unitClassName: 'text-lg',
      };
  const percentage = total > 0 ? Math.min((used / total) * 100, 100) : 0;
  const center = sizeConfig.diameter / 2;
  const circumference = 2 * Math.PI * sizeConfig.radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const chartColor = color || getUsageColor(percentage);
  const level = getUsageLevel(percentage);
  const formatted = formatResourceUsage(used, total, unit);

  const levelStyles = {
    low: {
      background: 'var(--sys-success-soft-bg)',
      border: 'var(--sys-success-soft-border)',
      ring: 'var(--sys-success-soft-border)',
    },
    medium: {
      background: 'var(--sys-info-soft-bg)',
      border: 'var(--sys-info-soft-border)',
      ring: 'var(--sys-info-soft-border)',
    },
    high: {
      background: 'var(--sys-warning-soft-bg)',
      border: 'var(--sys-warning-soft-border)',
      ring: 'var(--sys-warning-soft-border)',
    },
    critical: {
      background: 'var(--sys-error-soft-bg)',
      border: 'var(--sys-error-soft-border)',
      ring: 'var(--sys-error-soft-border)',
    },
  };

  const isClickable = !!onClick;
  const currentLevelStyle = levelStyles[level];

  const chartContent = (
    <>
      <div className="relative">
        <svg
          width={sizeConfig.diameter}
          height={sizeConfig.diameter}
          className="-rotate-90 transform"
        >
          {/* 背景圆环 */}
          <circle
            cx={center}
            cy={center}
            r={sizeConfig.radius}
            stroke="var(--color-border)"
            strokeWidth={sizeConfig.strokeWidth}
            fill="none"
          />
          {/* 进度圆环 */}
          <circle
            cx={center}
            cy={center}
            r={sizeConfig.radius}
            stroke={chartColor}
            strokeWidth={sizeConfig.strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-200 ease-out"
          />
        </svg>
        {/* 中心内容 */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`${sizeConfig.valueClassName} font-semibold`} style={{ color: chartColor }}>
            {percentage.toFixed(1)}%
          </span>
          {title && (
            <span className="text-xs mt-1 text-[var(--color-text-muted)]">
              {title}
            </span>
          )}
        </div>
      </div>

      {showLegend && (
        <div className="mt-4 text-center">
          <div className={`${sizeConfig.unitClassName} font-medium text-[var(--color-text-primary)]`}>
            {formatted.usedStr}{' '}
            <span className="text-[var(--color-text-muted)]">/</span>{' '}
            {formatted.totalStr}{' '}
            <span className="text-sm text-[var(--color-text-secondary)]">
              {formatted.unit}
            </span>
          </div>
          <div className="flex items-center justify-center gap-4 mt-2">
            <div className="flex items-center gap-1.5">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: chartColor }}
              />
              <span className="text-xs text-[var(--color-text-muted)]">
                已使用
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div
                className="w-3 h-3 rounded-full"
                style={{ background: 'var(--color-bg-tertiary)' }}
              />
              <span className="text-xs text-[var(--color-text-muted)]">
                剩余
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );

  if (isClickable) {
    return (
      <button
        onClick={onClick}
        className={clsx(
          'flex flex-col items-center rounded-xl border p-4 ring-2 ring-transparent transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-focus-ring',
          size === 'sm' ? 'min-h-[220px]' : 'min-h-[240px]'
        )}
        style={{
          background: isSelected ? currentLevelStyle.background : 'transparent',
          borderColor: isSelected ? currentLevelStyle.border : 'transparent',
          boxShadow: isSelected ? `0 0 0 2px ${currentLevelStyle.ring}` : 'none',
        }}
        aria-label={`${title || '资源利用率'}详情`}
      >
        {chartContent}
      </button>
    );
  }

  return (
    <div className="flex flex-col items-center">
      {chartContent}
    </div>
  );
}
