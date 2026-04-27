import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowPathIcon,
  BellAlertIcon,
  ChartBarIcon,
  CubeTransparentIcon,
  ExclamationTriangleIcon,
  ServerStackIcon,
} from '@heroicons/react/24/outline';
import {
  overviewApi,
  alertApi,
  statefulSetApi,
  daemonSetApi,
  jobApi,
  eventApi,
} from '../../api';
import { usePollingInterval } from '../../utils/polling';
import { queryKeys } from '../../api/queryKeys';
import { createVisibilityRefetchInterval } from '../../api/queryPolicy';
import type { AlertSummary, ClusterOverview, UsageMetric } from '../../types/api';
import type { DaemonSet, Event, Job, StatefulSet } from '../../types/kubernetes';

type TrendPoint = {
  time: string;
  cpu: number;
  memory: number;
  pods: number;
  warnings: number;
};

type WorkloadRow = {
  label: string;
  total: number;
  ready: number;
  accent: string;
};

const MAX_TREND_POINTS = 24;

function metricPercent(metric?: UsageMetric): number | null {
  if (!metric || metric.total <= 0) return null;
  return Math.max(0, Math.min(100, (metric.used / metric.total) * 100));
}

function formatPercent(value: number | null): string {
  if (value === null || Number.isNaN(value)) return '不可用';
  return `${Math.round(value)}%`;
}

function formatMetric(metric?: UsageMetric, digits = 1): string {
  if (!metric || metric.total <= 0) return '指标不可用';
  return `${metric.used.toFixed(digits)} / ${metric.total.toFixed(digits)} ${metric.unit}`;
}

function getEventTime(event: Event): number {
  return new Date(
    event.eventTime ?? event.lastTimestamp ?? event.firstTimestamp ?? event.metadata.creationTimestamp
  ).getTime();
}

function isStatefulSetReady(item: StatefulSet): boolean {
  return (item.status.readyReplicas ?? 0) >= item.spec.replicas;
}

function isDaemonSetReady(item: DaemonSet): boolean {
  return item.status.numberReady >= item.status.desiredNumberScheduled;
}

function isJobReady(item: Job): boolean {
  return (item.status.failed ?? 0) === 0 && ((item.status.succeeded ?? 0) > 0 || (item.status.active ?? 0) > 0);
}

function useMountAnimation(delayMs = 80) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), delayMs);
    return () => clearTimeout(t);
  }, [delayMs]);
  return mounted;
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ data, color = '#38bdf8' }: { data: number[]; color?: string }) {
  const points = data.filter((v) => Number.isFinite(v));
  if (points.length < 2) {
    return <div className="h-9 rounded-md border border-dashed border-slate-700/70 bg-slate-950/40" />;
  }
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const path = points
    .map((v, i) => {
      const x = (i / (points.length - 1)) * 100;
      const y = 34 - ((v - min) / range) * 28;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
  return (
    <svg viewBox="0 0 100 40" className="h-9 w-full overflow-visible" role="img" aria-label="趋势线">
      <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <path d={`${path} L100,40 L0,40 Z`} fill={color} opacity="0.12" />
    </svg>
  );
}

// ─── MultiLineTrendChart ───────────────────────────────────────────────────────

function MultiLineTrendChart({
  series,
}: {
  series: { label: string; data: number[]; color: string }[];
}) {
  const hasData = series.some((s) => s.data.filter(Number.isFinite).length >= 2);

  if (!hasData) {
    return (
      <div className="flex h-36 items-center justify-center rounded-md border border-dashed border-slate-700/70 bg-slate-950/40 text-xs text-slate-500">
        等待采样中...
      </div>
    );
  }

  const W = 200;
  const H = 56;
  const PAD = 3;

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-36 w-full overflow-visible"
        preserveAspectRatio="none"
        role="img"
        aria-label="资源趋势图"
      >
        {[0.25, 0.5, 0.75].map((pct) => (
          <line
            key={pct}
            x1="0"
            y1={(H * (1 - pct)).toFixed(2)}
            x2={W}
            y2={(H * (1 - pct)).toFixed(2)}
            stroke="rgba(148,163,184,0.08)"
            strokeWidth="0.5"
          />
        ))}
        {series.map(({ label, data, color }) => {
          const pts = data.filter(Number.isFinite);
          if (pts.length < 2) return null;
          const min = Math.min(...pts);
          const max = Math.max(...pts);
          const range = max - min || 1;
          const path = pts
            .map((v, i) => {
              const x = (i / (pts.length - 1)) * W;
              const y = H - PAD - ((v - min) / range) * (H - PAD * 2);
              return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
            })
            .join(' ');
          return (
            <g key={label}>
              <path d={`${path} L${W},${H} L0,${H} Z`} fill={color} opacity="0.07" />
              <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </g>
          );
        })}
      </svg>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
        {series.map(({ label, data, color }) => {
          const latest = [...data].reverse().find(Number.isFinite);
          return (
            <div key={label} className="flex items-center gap-2">
              <div className="h-0.5 w-4 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-xs text-slate-400">{label}</span>
              <span className="font-mono text-xs text-slate-200">{latest !== undefined ? latest.toFixed(0) : '--'}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── ScoreRing ────────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const targetOffset = circumference - (score / 100) * circumference;
  const animated = useMountAnimation(120);

  return (
    <div className="relative grid h-28 w-28 place-items-center">
      <svg viewBox="0 0 96 96" className="h-28 w-28 -rotate-90">
        <circle cx="48" cy="48" r={radius} fill="none" stroke="rgba(30,41,59,.95)" strokeWidth="10" />
        <circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          stroke="url(#health-gradient)"
          strokeDasharray={circumference}
          strokeDashoffset={animated ? targetOffset : circumference}
          strokeLinecap="round"
          strokeWidth="10"
          style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(0.4, 0, 0.2, 1)' }}
        />
        <defs>
          <linearGradient id="health-gradient" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#38bdf8" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute text-center">
        <div className="font-mono text-3xl font-semibold text-white">{score}</div>
        <div className="text-[10px] uppercase tracking-wider text-slate-400">/100</div>
      </div>
    </div>
  );
}

// ─── MetricCard ───────────────────────────────────────────────────────────────

function MetricCard({
  title,
  value,
  subline,
  color,
  trend,
}: {
  title: string;
  value: string;
  subline: string;
  color: string;
  trend: number[];
}) {
  return (
    <div
      className="group cursor-default rounded-lg border border-slate-700/80 bg-slate-900/70 p-4 shadow-[0_0_28px_rgba(15,23,42,.35)] transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-600/70 hover:shadow-[0_8px_32px_rgba(15,23,42,.55)]"
    >
      <div className="text-xs text-slate-400 transition-colors duration-200 group-hover:text-slate-300">{title}</div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div>
          <div className="font-mono text-2xl font-semibold text-white">{value}</div>
          <div className="mt-1 text-xs text-slate-500">{subline}</div>
        </div>
        <div className="w-24">
          <Sparkline data={trend} color={color} />
        </div>
      </div>
    </div>
  );
}

// ─── ResourceBar ──────────────────────────────────────────────────────────────

function ResourceBar({
  label,
  metric,
  color,
  unavailable = false,
}: {
  label: string;
  metric?: UsageMetric;
  color: string;
  unavailable?: boolean;
}) {
  const percent = metricPercent(metric);
  const displayPercent = unavailable ? null : percent;
  const mounted = useMountAnimation(120);

  return (
    <div className="group cursor-default rounded-lg border border-slate-700/70 bg-slate-950/40 px-4 py-3 transition-all duration-200 hover:border-slate-600/60 hover:bg-slate-900/50">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-slate-400 transition-colors duration-150 group-hover:text-slate-300">{label}</span>
        <span className="font-mono text-slate-200">{unavailable ? '指标不可用' : formatMetric(metric)}</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full"
          style={{
            width: `${mounted ? (displayPercent ?? 0) : 0}%`,
            backgroundColor: color,
            transition: 'width 0.9s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: mounted && (displayPercent ?? 0) > 0 ? `0 0 8px ${color}60` : 'none',
          }}
        />
      </div>
      <div className="mt-2 font-mono text-sm text-white">{formatPercent(displayPercent)}</div>
    </div>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────

function Panel({
  title,
  action,
  children,
  className = '',
}: {
  title: string;
  action?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-slate-700/80 bg-slate-900/65 p-4 transition-colors duration-200 hover:border-slate-700/60 ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
        {action ? <span className="text-xs text-cyan-300">{action}</span> : null}
      </div>
      {children}
    </section>
  );
}

// ─── DashboardSkeleton ────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <div className="h-12 rounded-xl skeleton" />
      <div className="h-52 rounded-xl skeleton" />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="h-24 rounded-xl skeleton" />
        <div className="h-24 rounded-xl skeleton" />
        <div className="h-24 rounded-xl skeleton" />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="h-64 rounded-xl skeleton" />
        <div className="h-64 rounded-xl skeleton" />
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const pollingInterval = usePollingInterval('standard');
  const fastPollingInterval = usePollingInterval('fast');
  const fastRefetchInterval = createVisibilityRefetchInterval(fastPollingInterval);
  const standardRefetchInterval = createVisibilityRefetchInterval(pollingInterval);
  const [trend, setTrend] = useState<TrendPoint[]>([]);

  const {
    data: overview,
    isLoading,
    isRefetching,
    refetch,
    dataUpdatedAt,
  } = useQuery({
    queryKey: queryKeys.overview,
    queryFn: overviewApi.getOverview,
    refetchInterval: fastRefetchInterval,
  });

  const { data: alertSummary } = useQuery({
    queryKey: queryKeys.alertSummary,
    queryFn: alertApi.getSummary,
    refetchInterval: (query) => {
      const data = query.state.data as AlertSummary | undefined;
      if (data?.enabled === false) return false;
      return standardRefetchInterval();
    },
    retry: false,
  });

  const { data: statefulSets } = useQuery({
    queryKey: ['statefulsets', 'dashboard'],
    queryFn: () => statefulSetApi.listAll({ pageSize: 1000 }),
    refetchInterval: standardRefetchInterval,
  });
  const { data: daemonSets } = useQuery({
    queryKey: ['daemonsets', 'dashboard'],
    queryFn: () => daemonSetApi.listAll({ pageSize: 1000 }),
    refetchInterval: standardRefetchInterval,
  });
  const { data: jobs } = useQuery({
    queryKey: ['jobs', 'dashboard'],
    queryFn: () => jobApi.listAll({ pageSize: 1000 }),
    refetchInterval: standardRefetchInterval,
  });
  const { data: events } = useQuery({
    queryKey: ['events', 'dashboard'],
    queryFn: () => eventApi.listAll({ pageSize: 20 }),
    refetchInterval: standardRefetchInterval,
  });

  useEffect(() => {
    if (!overview) return;
    const timer = window.setTimeout(() => {
      setTrend((current) => {
        const nextPoint: TrendPoint = {
          time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
          cpu: metricPercent(overview.resources.cpu) ?? 0,
          memory: metricPercent(overview.resources.memory) ?? 0,
          pods: metricPercent(overview.resources.pods) ?? 0,
          warnings: overview.events.warning,
        };
        const last = current[current.length - 1];
        if (
          last &&
          last.cpu === nextPoint.cpu &&
          last.memory === nextPoint.memory &&
          last.pods === nextPoint.pods &&
          last.warnings === nextPoint.warnings
        ) {
          return current;
        }
        const updated = current.length === 0 ? [nextPoint, nextPoint] : [...current, nextPoint];
        return updated.slice(-MAX_TREND_POINTS);
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [overview, dataUpdatedAt]);

  const healthScore = useMemo(() => calculateHealthScore(overview), [overview]);

  const trendSeries = useMemo(
    () => ({
      cpu: trend.map((p) => p.cpu),
      memory: trend.map((p) => p.memory),
      pods: trend.map((p) => p.pods),
      warnings: trend.map((p) => p.warnings),
    }),
    [trend]
  );

  const latestEvents = useMemo(
    () => [...(events?.items ?? [])].sort((a, b) => getEventTime(b) - getEventTime(a)).slice(0, 5),
    [events?.items]
  );

  const workloadRows = useMemo<WorkloadRow[]>(() => {
    const statefulSetItems = statefulSets?.items ?? [];
    const daemonSetItems = daemonSets?.items ?? [];
    const jobItems = jobs?.items ?? [];
    return [
      { label: 'Pods', total: overview?.pods.total ?? 0, ready: overview?.pods.ready ?? 0, accent: '#38bdf8' },
      { label: 'Deployments', total: overview?.deployments.total ?? 0, ready: overview?.deployments.ready ?? 0, accent: '#a78bfa' },
      { label: 'StatefulSets', total: statefulSetItems.length, ready: statefulSetItems.filter(isStatefulSetReady).length, accent: '#60a5fa' },
      { label: 'DaemonSets', total: daemonSetItems.length, ready: daemonSetItems.filter(isDaemonSetReady).length, accent: '#34d399' },
      { label: 'Jobs', total: jobItems.length, ready: jobItems.filter(isJobReady).length, accent: '#fbbf24' },
    ];
  }, [overview, statefulSets?.items, daemonSets?.items, jobs?.items]);

  const updatedTimeLabel = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '--:--:--';

  if (isLoading || !overview) {
    return <DashboardSkeleton />;
  }

  const alertEnabled = alertSummary?.enabled !== false;
  const metricsUnavailable =
    overview.nodes.total > 0 && overview.resources.cpu.used === 0 && overview.resources.memory.used === 0;

  return (
    <div className="min-h-full space-y-4 text-slate-100">

      {/* 状态栏 */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-700/80 bg-slate-950/70 px-4 py-3 shadow-[0_0_40px_rgba(14,165,233,.08)] lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/20 text-blue-200 ring-1 ring-blue-400/30">
            <CubeTransparentIcon className="h-5 w-5" />
          </div>
          <div>
            <div className="text-base font-semibold">集群总览</div>
            <div className="text-xs text-slate-500">
              {metricsUnavailable ? 'Metrics Server 不可用' : 'Metrics Server 已接入'} · 同步于 {updatedTimeLabel}
            </div>
          </div>
          {/* 呼吸脉冲 live indicator */}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-xs text-emerald-200">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            集群连接正常
          </span>
        </div>
        <button
          type="button"
          onClick={() => { void refetch(); }}
          className="btn btn-secondary h-9 self-start lg:self-auto"
          aria-label="刷新首页数据"
        >
          <ArrowPathIcon className={`h-4 w-4 transition-transform duration-500 ${isRefetching ? 'animate-spin' : ''}`} />
          <span>刷新数据</span>
        </button>
      </div>

      {/* 健康评分 */}
      <Panel title="集群健康评分" className="overflow-hidden">
        <div className="grid gap-4 xl:grid-cols-[140px_1fr]">
          <div className="flex items-center justify-center">
            <ScoreRing score={healthScore} />
          </div>
          <div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                title="在线节点"
                value={`${overview.nodes.ready}/${overview.nodes.total}`}
                subline={`${overview.nodes.notReady} 个异常`}
                color="#22c55e"
                trend={trendSeries.cpu}
              />
              <MetricCard
                title="运行中 Pod"
                value={`${overview.pods.ready}`}
                subline={`总计 ${overview.pods.total}`}
                color="#38bdf8"
                trend={trendSeries.pods}
              />
              <MetricCard
                title="部署就绪"
                value={`${overview.deployments.ready}/${overview.deployments.total}`}
                subline={`${overview.deployments.notReady} 个未就绪`}
                color="#a78bfa"
                trend={trendSeries.memory}
              />
              <MetricCard
                title="事件告警"
                value={`${overview.events.warning}`}
                subline={`事件总数 ${overview.events.total}`}
                color="#f97316"
                trend={trendSeries.warnings}
              />
            </div>
            {/* 节点摘要行 */}
            <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-950/40 px-4 py-2.5 text-xs transition-colors duration-150 hover:bg-slate-900/50">
              <div className="flex items-center gap-2 text-slate-400">
                <ServerStackIcon className="h-3.5 w-3.5" />
                节点健康
              </div>
              <div className="flex items-center gap-3">
                <span className={`font-mono ${overview.nodes.notReady > 0 ? 'text-rose-300' : 'text-emerald-300'}`}>
                  {overview.nodes.ready}/{overview.nodes.total} Ready
                </span>
                {overview.nodes.notReady > 0 && (
                  <span className="rounded-full bg-rose-400/10 px-2 py-0.5 text-rose-300">
                    {overview.nodes.notReady} 异常
                  </span>
                )}
                <Link to="/nodes" className="text-cyan-400 transition-colors hover:text-cyan-300">
                  查看节点 →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </Panel>

      {/* 资源使用 */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <ResourceBar label="CPU 使用率" metric={overview.resources.cpu} color="#3b82f6" unavailable={metricsUnavailable} />
        <ResourceBar label="内存使用率" metric={overview.resources.memory} color="#a855f7" unavailable={metricsUnavailable} />
        <ResourceBar label="Pod 容量" metric={overview.resources.pods} color="#84cc16" />
      </div>

      {/* 趋势 + 工作负载 */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[3fr_2fr]">
        <Panel title="资源趋势（当前会话）" action={trend.length < 2 ? '等待采样' : `${trend.length} 个快照`}>
          <MultiLineTrendChart
            series={[
              { label: 'CPU %', data: trendSeries.cpu, color: '#3b82f6' },
              { label: 'Memory %', data: trendSeries.memory, color: '#a855f7' },
              { label: 'Pod Cap %', data: trendSeries.pods, color: '#84cc16' },
              { label: 'Warnings', data: trendSeries.warnings, color: '#f97316' },
            ]}
          />
        </Panel>

        <Panel title="工作负载概览">
          <div className="space-y-1">
            {workloadRows.map((row, index) => (
              <WorkloadProgress key={row.label} row={row} index={index} />
            ))}
          </div>
        </Panel>
      </div>

      {/* 告警 + 事件 */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_2fr]">
        <Panel title="告警中心" action={alertEnabled ? 'Alertmanager' : '未启用'}>
          {alertEnabled ? (
            <div className="grid grid-cols-2 gap-3">
              <AlertTile label="总告警" value={alertSummary?.total ?? 0} color="text-slate-100" glowColor="rgba(148,163,184,.15)" />
              <AlertTile label="严重" value={alertSummary?.critical ?? 0} color="text-rose-300" glowColor="rgba(251,113,133,.2)" />
              <AlertTile label="警告" value={alertSummary?.warning ?? 0} color="text-amber-300" glowColor="rgba(251,191,36,.2)" />
              <AlertTile label="信息" value={alertSummary?.info ?? 0} color="text-cyan-300" glowColor="rgba(34,211,238,.2)" />
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-700 bg-slate-950/35 p-5 text-center">
              <BellAlertIcon className="mx-auto h-8 w-8 text-slate-500" />
              <div className="mt-3 text-sm font-medium text-slate-200">告警未启用</div>
              <div className="mt-1 text-xs text-slate-500">ALERTMANAGER_ENABLED=false</div>
            </div>
          )}
        </Panel>

        <Panel title="最近事件" action={`${overview.events.warning} Warning`}>
          <div className="space-y-2">
            {latestEvents.map((event) => (
              <div
                key={event.metadata.uid}
                className="cursor-default rounded-lg bg-slate-950/45 px-3 py-2 transition-all duration-150 hover:bg-slate-800/60 hover:shadow-[inset_0_0_0_1px_rgba(148,163,184,0.08)]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] ${
                      event.type === 'Warning'
                        ? 'bg-amber-400/10 text-amber-200'
                        : 'bg-emerald-400/10 text-emerald-200'
                    }`}
                  >
                    {event.type ?? 'Normal'}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {new Date(getEventTime(event)).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="mt-2 truncate text-sm text-slate-100">{event.reason ?? event.action ?? 'Event'}</div>
                <div className="mt-1 line-clamp-2 text-xs text-slate-500">{event.message ?? event.involvedObject.name}</div>
              </div>
            ))}
            {latestEvents.length === 0 ? <EmptyState text="暂无事件" /> : null}
          </div>
        </Panel>
      </div>
    </div>
  );
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function calculateHealthScore(overview?: ClusterOverview): number {
  if (!overview) return 0;
  const nodeHealth = overview.nodes.total > 0 ? (overview.nodes.ready / overview.nodes.total) * 100 : 100;
  const podHealth = overview.pods.total > 0 ? (overview.pods.ready / overview.pods.total) * 100 : 100;
  const deployHealth =
    overview.deployments.total > 0 ? (overview.deployments.ready / overview.deployments.total) * 100 : 100;
  const eventPenalty =
    overview.events.total > 0 ? Math.min(20, (overview.events.warning / overview.events.total) * 40) : 0;
  return Math.max(0, Math.min(100, Math.round((nodeHealth + podHealth + deployHealth) / 3 - eventPenalty)));
}

function WorkloadProgress({ row, index = 0 }: { row: WorkloadRow; index?: number }) {
  const mounted = useMountAnimation(100 + index * 60);
  const percent = row.total > 0 ? (row.ready / row.total) * 100 : 0;

  return (
    <div className="-mx-2 grid cursor-default grid-cols-[112px_1fr_60px] items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors duration-150 hover:bg-slate-800/40">
      <div className="text-slate-300">{row.label}</div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full"
          style={{
            width: `${mounted ? percent : 0}%`,
            backgroundColor: row.accent,
            transition: `width 0.8s cubic-bezier(0.4, 0, 0.2, 1) ${index * 0.05}s`,
          }}
        />
      </div>
      <div className="text-right font-mono text-xs text-slate-400">
        {row.ready}/{row.total}
      </div>
    </div>
  );
}

function AlertTile({
  label,
  value,
  color,
  glowColor,
}: {
  label: string;
  value: number;
  color: string;
  glowColor: string;
}) {
  return (
    <div
      className="group cursor-default rounded-lg border border-slate-700/70 bg-slate-950/45 p-3 transition-all duration-200 hover:scale-[1.03] hover:border-slate-600/60"
      style={{ '--glow': glowColor } as React.CSSProperties}
    >
      <div className="flex items-center gap-2 text-xs text-slate-500 transition-colors duration-150 group-hover:text-slate-400">
        <ExclamationTriangleIcon className="h-4 w-4" />
        {label}
      </div>
      <div
        className={`mt-2 font-mono text-2xl font-semibold transition-all duration-200 group-hover:drop-shadow-[0_0_8px_var(--glow)] ${color}`}
      >
        {value}
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-700 bg-slate-950/35 px-3 py-6 text-center text-sm text-slate-500">
      <ChartBarIcon className="mx-auto mb-2 h-6 w-6 text-slate-600" />
      {text}
    </div>
  );
}
