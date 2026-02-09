import { formatResourceUsage, getUsageColor, getUsageLevel } from '../../utils/format';
import clsx from 'clsx';

interface ResourceChartProps {
  used: number;
  total: number;
  unit: string;
  color?: string;
  title?: string;
  showLegend?: boolean;
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
  onClick,
  isSelected,
}: ResourceChartProps) {
  const percentage = total > 0 ? Math.min((used / total) * 100, 100) : 0;
  const radius = 70;
  const strokeWidth = 12;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const chartColor = color || getUsageColor(percentage);
  const level = getUsageLevel(percentage);
  const formatted = formatResourceUsage(used, total, unit);

  const levelStyles = {
    low: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', ring: 'ring-emerald-500/30', border: 'border-emerald-500/30' },
    medium: { text: 'text-blue-400', bg: 'bg-blue-500/10', ring: 'ring-blue-500/30', border: 'border-blue-500/30' },
    high: { text: 'text-amber-400', bg: 'bg-amber-500/10', ring: 'ring-amber-500/30', border: 'border-amber-500/30' },
    critical: { text: 'text-red-400', bg: 'bg-red-500/10', ring: 'ring-red-500/30', border: 'border-red-500/30' },
  };

  const isClickable = !!onClick;
  const currentLevelStyle = levelStyles[level];

  const chartContent = (
    <>
      <div className="relative">
        <svg width="180" height="180" className="transform -rotate-90">
          {/* 背景圆环 */}
          <circle
            cx="90"
            cy="90"
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="none"
            className="text-slate-700/30"
          />
          {/* 进度圆环 */}
          <circle
            cx="90"
            cy="90"
            r={radius}
            stroke={chartColor}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-500 ease-out"
          />
        </svg>
        {/* 中心内容 */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-4xl font-semibold"
            style={{ color: chartColor }}
          >
            {percentage.toFixed(1)}%
          </span>
          {title && (
            <span className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
              {title}
            </span>
          )}
        </div>
      </div>

      {showLegend && (
        <div className="mt-4 text-center">
          <div className="text-lg font-medium" style={{ color: 'var(--color-text-primary)' }}>
            {formatted.usedStr}{' '}
            <span style={{ color: 'var(--color-text-muted)' }}>/</span>{' '}
            {formatted.totalStr}{' '}
            <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {formatted.unit}
            </span>
          </div>
          <div className="flex items-center justify-center gap-4 mt-2">
            <div className="flex items-center gap-1.5">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: chartColor }}
              />
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                已使用
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div
                className="w-3 h-3 rounded-full"
                style={{ background: 'var(--color-bg-tertiary)' }}
              />
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
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
          'flex flex-col items-center p-4 rounded-xl border transition-all duration-200',
          isSelected ? currentLevelStyle.bg : 'bg-transparent',
          isSelected ? currentLevelStyle.border : 'border-transparent',
          isSelected && 'ring-2',
          isSelected && currentLevelStyle.ring,
        )}
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
