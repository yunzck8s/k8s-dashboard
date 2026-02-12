import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { observationApi, type TimeRange } from '../../api';
import { usePollingInterval } from '../../utils/polling';
import AnomalySummary from './components/AnomalySummary';
import AnomalyPanel from './components/AnomalyPanel';
import ResourceTrendChart from './components/ResourceTrendChart';
import RestartTrendChart from './components/RestartTrendChart';
import TimeRangeSelector from './components/TimeRangeSelector';
import { ArrowPathIcon } from '@heroicons/react/24/outline';

export default function ClusterObservation() {
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const pollingInterval = usePollingInterval('standard');
  const slowPollingInterval = usePollingInterval('slow');

  // 获取异常状态汇总
  const { data: summary, refetch: refetchSummary, isLoading: summaryLoading } = useQuery({
    queryKey: ['observation-summary'],
    queryFn: () => observationApi.getSummary(),
    refetchInterval: pollingInterval,
  });

  // 获取 CPU 趋势
  const { data: cpuTrend } = useQuery({
    queryKey: ['observation-cpu-trend', timeRange],
    queryFn: () => observationApi.getResourceTrend('cpu', timeRange),
    refetchInterval: slowPollingInterval,
  });

  // 获取内存趋势
  const { data: memoryTrend } = useQuery({
    queryKey: ['observation-memory-trend', timeRange],
    queryFn: () => observationApi.getResourceTrend('memory', timeRange),
    refetchInterval: slowPollingInterval,
  });

  // 获取重启趋势
  const { data: restartTrend } = useQuery({
    queryKey: ['observation-restart-trend', timeRange],
    queryFn: () => observationApi.getRestartTrend(timeRange),
    refetchInterval: slowPollingInterval,
  });

  const handleRefresh = () => {
    refetchSummary();
  };

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-white via-indigo-100 to-purple-100 bg-clip-text text-transparent">
            集群状态观测
          </h1>
          <p className="text-slate-400 mt-2 text-sm font-medium">
            实时监控集群异常状态、资源使用趋势与告警信息
          </p>
        </div>
        <div className="flex items-center gap-4">
          <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
          <button
            onClick={handleRefresh}
            className="group relative px-5 py-2.5 bg-slate-800/60 backdrop-blur-sm hover:bg-slate-700/80 border border-slate-700/50 hover:border-indigo-500/50 rounded-lg text-sm font-semibold text-slate-300 hover:text-white shadow-lg hover:shadow-indigo-500/20 transition-all duration-300 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/0 via-indigo-600/10 to-indigo-600/0 opacity-0 group-hover:opacity-100 transition-opacity" />
            <span className="relative z-10 flex items-center gap-2">
              <ArrowPathIcon className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
              刷新
            </span>
          </button>
        </div>
      </div>

      {/* 异常状态概览 */}
      <AnomalySummary summary={summary} isLoading={summaryLoading} />

      {/* 异常详情面板 */}
      <AnomalyPanel />

      {/* 资源使用趋势 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ResourceTrendChart
          title="CPU 使用率趋势"
          data={cpuTrend}
          unit="%"
          color="#6366f1"
          gradientId="cpuGradient"
        />
        <ResourceTrendChart
          title="内存使用率趋势"
          data={memoryTrend}
          unit="%"
          color="#8b5cf6"
          gradientId="memoryGradient"
        />
      </div>

      {/* 重启趋势 */}
      <div className="grid grid-cols-1 gap-6">
        <RestartTrendChart title="Pod 重启趋势" data={restartTrend} />
      </div>
    </div>
  );
}
