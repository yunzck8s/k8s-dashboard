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
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-slate-400 text-xs mb-1">{label}</p>
      <p className="text-white font-semibold">
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
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        {data?.comparison && (
          <div className="flex items-center gap-4">
            <ComparisonBadge
              label="周环比"
              value={data.comparison.wow}
              trend={data.comparison.trend}
            />
            <div className="text-right">
              <p className="text-xs text-slate-400">当前平均</p>
              <p className="text-sm font-semibold text-white">
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
                  <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis
                dataKey="time"
                stroke="#64748b"
                tick={{ fill: '#64748b', fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#64748b"
                tick={{ fill: '#64748b', fontSize: 12 }}
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
                stroke={color}
                strokeWidth={2}
                fill={`url(#${gradientId})`}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-64 flex items-center justify-center text-slate-400">
          <p>暂无数据</p>
        </div>
      )}
    </div>
  );
}
