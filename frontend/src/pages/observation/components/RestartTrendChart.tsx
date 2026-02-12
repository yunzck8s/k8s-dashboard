import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { RestartTrend } from '../../../api';
import ComparisonBadge from './ComparisonBadge';
import { chartPalette } from '../../../types/theme';

interface RestartTrendChartProps {
  title: string;
  data?: RestartTrend;
}

interface TooltipPayloadItem {
  value?: number;
}

interface RestartTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

function RestartTooltip({ active, payload, label }: RestartTooltipProps) {
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
      <p className="font-semibold text-[var(--color-text-primary)]">{payload[0].value} 次重启</p>
    </div>
  );
}

export default function RestartTrendChart({ title, data }: RestartTrendChartProps) {
  const chartData =
    data?.current?.map((point) => ({
      date: point.date,
      count: point.count,
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
                {data.comparison.currentAvg.toFixed(1)} 次/周期
              </p>
            </div>
          </div>
        )}
      </div>

      {chartData.length > 0 ? (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="restartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartPalette.qualitative[4]} stopOpacity={0.8} />
                  <stop offset="95%" stopColor={chartPalette.qualitative[4]} stopOpacity={0.3} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis
                dataKey="date"
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
                allowDecimals={false}
              />
              <Tooltip
                content={({ active, payload, label }) => (
                  <RestartTooltip
                    active={active}
                    payload={payload as TooltipPayloadItem[] | undefined}
                    label={label as string | undefined}
                  />
                )}
              />
              <Bar dataKey="count" fill="url(#restartGradient)" radius={[4, 4, 0, 0]} />
            </BarChart>
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
