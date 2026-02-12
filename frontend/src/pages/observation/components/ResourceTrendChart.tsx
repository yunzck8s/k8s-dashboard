import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ResourceTrend } from '../../../api';
import ComparisonBadge from './ComparisonBadge';
import { chartPalette } from '../../../types/theme';

interface ResourceTrendChartProps {
  title: string;
  data?: ResourceTrend;
  unit: string;
  color: string;
  gradientId: string;
}

interface TooltipPayloadItem {
  value?: number;
}

interface ResourceTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
  unit: string;
}

function ResourceTooltip({ active, payload, label, unit }: ResourceTooltipProps) {
  if (!active || !payload || payload.length === 0 || payload[0].value === undefined) {
    return null;
  }

  return (
    <div
      className="rounded-lg px-3 py-2 shadow-xl"
      style={{
        background: 'var(--color-bg-elevated)',
        border: '1px solid var(--color-border)',
      }}
    >
      <p className="text-xs mb-1 text-[var(--color-text-muted)]">{label}</p>
      <p className="font-semibold text-[var(--color-text-primary)]">
        {payload[0].value.toFixed(2)}
        {unit}
      </p>
    </div>
  );
}

export default function ResourceTrendChart({
  title,
  data,
  unit,
  color,
  gradientId,
}: ResourceTrendChartProps) {
  const strokeColor = color || chartPalette.qualitative[0];
  const chartData =
    data?.current?.map((point) => ({
      timestamp: point.timestamp,
      time: new Date(point.timestamp * 1000).toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      value: Number(point.value.toFixed(2)),
    })) ?? [];

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">{title}</h3>
        {data?.comparison && (
          <div className="flex items-center gap-4">
            <ComparisonBadge
              label="周环比"
              value={data.comparison.wow}
              trend={data.comparison.trend}
            />
            <div className="text-right">
              <p className="text-xs text-[var(--color-text-muted)]">当前平均</p>
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                {data.comparison.currentAvg.toFixed(2)}
                {unit}
              </p>
            </div>
          </div>
        )}
      </div>

      {chartData.length > 0 ? (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={strokeColor} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={strokeColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis
                dataKey="time"
                stroke="var(--color-text-muted)"
                tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="var(--color-text-muted)"
                tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value: number) => `${value}${unit}`}
              />
              <Tooltip
                content={({ active, payload, label }) => (
                  <ResourceTooltip
                    active={active}
                    payload={payload as TooltipPayloadItem[] | undefined}
                    label={label as string | undefined}
                    unit={unit}
                  />
                )}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={strokeColor}
                strokeWidth={2}
                fill={`url(#${gradientId})`}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-64 flex items-center justify-center text-[var(--color-text-muted)]">
          <p>暂无数据</p>
        </div>
      )}
    </div>
  );
}
