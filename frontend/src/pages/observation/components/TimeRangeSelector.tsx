import type { TimeRange } from '../../../api';
import clsx from 'clsx';

interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
}

const timeRanges: { value: TimeRange; label: string }[] = [
  { value: 'realtime', label: '实时' },
  { value: '1h', label: '1小时' },
  { value: '24h', label: '24小时' },
  { value: '7d', label: '7天' },
  { value: '30d', label: '30天' },
];

export default function TimeRangeSelector({ value, onChange }: TimeRangeSelectorProps) {
  return (
    <div className="flex items-center gap-1 bg-[color-mix(in_srgb,var(--color-bg-secondary)_60%,transparent)] backdrop-blur-sm rounded-lg p-1 border border-[color-mix(in_srgb,var(--color-border)_50%,transparent)]">
      {timeRanges.map((range) => (
        <button
          key={range.value}
          onClick={() => onChange(range.value)}
          className={clsx(
            'px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200',
            value === range.value
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25'
              : 'text-text-muted hover:text-white hover:bg-[color-mix(in_srgb,var(--color-bg-tertiary)_50%,transparent)]'
          )}
        >
          {range.label}
        </button>
      ))}
    </div>
  );
}
