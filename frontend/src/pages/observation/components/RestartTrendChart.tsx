import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { RestartTrend } from '../../../api';
import ComparisonBadge from './ComparisonBadge';

interface RestartTrendChartProps {
  title: string;
  data?: RestartTrend;
}

export default function RestartTrendChart({ title, data }: RestartTrendChartProps) {
  // 格式化图表数据
  const chartData = useMemo(() => {
    if (!data?.current) return [];

    return data.current.map((point) => ({
      date: point.date,
      count: point.count,
    }));
  }, [data]);

  // 自定义 Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 shadow-xl">
          <p className="text-slate-400 text-xs mb-1">{label}</p>
          <p className="text-white font-semibold">
            {payload[0].value} 次重启
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="card p-6">
      {/* 标题和同比环比 */}
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
                {data.comparison.currentAvg.toFixed(1)} 次/周期
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 图表 */}
      {chartData.length > 0 ? (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="restartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.3} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis
                dataKey="date"
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
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar
                dataKey="count"
                fill="url(#restartGradient)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
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
