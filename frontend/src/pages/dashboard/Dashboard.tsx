import { useMemo, useState, type ComponentType, type CSSProperties } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { overviewApi, alertApi } from '../../api';
import StatsCard from '../../components/common/StatsCard';
import ResourceChart from '../../components/charts/ResourceChart';
import EventsList from '../../components/common/EventsList';
import AlertsList from '../../components/common/AlertsList';
import { formatNumber } from '../../utils/format';
import { usePollingInterval } from '../../utils/polling';
import { queryKeys } from '../../api/queryKeys';
import { createVisibilityRefetchInterval } from '../../api/queryPolicy';
import {
  CubeIcon,
  ServerIcon,
  RectangleStackIcon,
  GlobeAltIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  ArrowPathIcon,
  ChartBarIcon,
  FolderIcon,
  BellAlertIcon,
} from '@heroicons/react/24/outline';

type AlertSeverityFilter = 'critical' | 'warning' | 'info' | null;
type EventTypeFilter = 'Normal' | 'Warning' | null;
type Tone = 'success' | 'warning' | 'error' | 'info';

interface ToneStyle {
  bg: string;
  border: string;
  text: string;
  baseText: string;
}

interface HealthConfig {
  label: string;
  ringColor: string;
  textColor: string;
  chip: ToneStyle;
}

interface QuickLink {
  name: string;
  path: string;
  icon: ComponentType<{ className?: string; style?: CSSProperties }>;
  iconColor: string;
}

const toneStyles: Record<Tone, ToneStyle> = {
  success: {
    bg: 'var(--sys-success-soft-bg)',
    border: 'var(--sys-success-soft-border)',
    text: 'var(--sys-success-soft-text)',
    baseText: 'var(--color-success)',
  },
  warning: {
    bg: 'var(--sys-warning-soft-bg)',
    border: 'var(--sys-warning-soft-border)',
    text: 'var(--sys-warning-soft-text)',
    baseText: 'var(--color-warning)',
  },
  error: {
    bg: 'var(--sys-error-soft-bg)',
    border: 'var(--sys-error-soft-border)',
    text: 'var(--sys-error-soft-text)',
    baseText: 'var(--color-error)',
  },
  info: {
    bg: 'var(--sys-info-soft-bg)',
    border: 'var(--sys-info-soft-border)',
    text: 'var(--sys-info-soft-text)',
    baseText: 'var(--color-info)',
  },
};

const quickLinks: QuickLink[] = [
  { name: 'Pods', path: '/workloads/pods', icon: CubeIcon, iconColor: 'var(--color-info)' },
  { name: 'Deployments', path: '/workloads/deployments', icon: RectangleStackIcon, iconColor: 'var(--color-primary)' },
  { name: 'Services', path: '/network/services', icon: GlobeAltIcon, iconColor: 'var(--color-warning)' },
  { name: 'Nodes', path: '/nodes', icon: ServerIcon, iconColor: 'var(--color-success)' },
  { name: 'ConfigMaps', path: '/config/configmaps', icon: FolderIcon, iconColor: 'var(--color-info)' },
  { name: 'Namespaces', path: '/namespaces', icon: FolderIcon, iconColor: 'var(--color-primary)' },
];

function getHealthConfig(score: number): HealthConfig {
  if (score >= 90) {
    return {
      label: '健康',
      ringColor: 'var(--color-success)',
      textColor: 'var(--color-success)',
      chip: toneStyles.success,
    };
  }
  if (score >= 70) {
    return {
      label: '良好',
      ringColor: 'var(--color-info)',
      textColor: 'var(--color-info)',
      chip: toneStyles.info,
    };
  }
  if (score >= 50) {
    return {
      label: '警告',
      ringColor: 'var(--color-warning)',
      textColor: 'var(--color-warning)',
      chip: toneStyles.warning,
    };
  }
  return {
    label: '异常',
    ringColor: 'var(--color-error)',
    textColor: 'var(--color-error)',
    chip: toneStyles.error,
  };
}

function StatFilterCard({
  count,
  label,
  tone,
  active,
  onClick,
}: {
  count: number;
  label: string;
  tone: Tone;
  active: boolean;
  onClick: () => void;
}) {
  const style = toneStyles[tone];

  return (
    <button
      onClick={onClick}
      className="rounded-lg border p-3 text-center transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      style={{
        background: style.bg,
        borderColor: style.border,
        boxShadow: active ? `0 0 0 2px ${style.border}` : 'none',
      }}
    >
      <p className="text-2xl font-semibold" style={{ color: style.baseText }}>
        {count}
      </p>
      <p className="text-xs text-[var(--color-text-muted)]">
        {label}
      </p>
    </button>
  );
}

function EventFilterCard({
  count,
  label,
  icon: Icon,
  tone,
  active,
  onClick,
}: {
  count: number;
  label: string;
  icon: ComponentType<{ className?: string; style?: CSSProperties }>;
  tone: Tone;
  active: boolean;
  onClick: () => void;
}) {
  const style = toneStyles[tone];

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 rounded-lg border p-4 text-left transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      style={{
        background: style.bg,
        borderColor: style.border,
        boxShadow: active ? `0 0 0 2px ${style.border}` : 'none',
      }}
    >
      <Icon className="h-8 w-8" style={{ color: style.baseText }} />
      <div>
        <p className="text-2xl font-semibold" style={{ color: style.baseText }}>
          {formatNumber(count, 0)}
        </p>
        <p className="text-xs text-[var(--color-text-muted)]">
          {label}
        </p>
      </div>
    </button>
  );
}

export default function Dashboard() {
  const pollingInterval = usePollingInterval('standard');
  const fastPollingInterval = usePollingInterval('fast');
  const fastRefetchInterval = createVisibilityRefetchInterval(fastPollingInterval);
  const standardRefetchInterval = createVisibilityRefetchInterval(pollingInterval);

  const [alertFilter, setAlertFilter] = useState<AlertSeverityFilter>(null);
  const [eventFilter, setEventFilter] = useState<EventTypeFilter>(null);

  const {
    data: overview,
    isLoading,
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
    refetchInterval: standardRefetchInterval,
  });

  const healthScore = useMemo(() => {
    if (!overview) return 0;
    const nodeHealth = overview.nodes.total > 0 ? (overview.nodes.ready / overview.nodes.total) * 100 : 0;
    const podHealth = overview.pods.total > 0 ? (overview.pods.ready / overview.pods.total) * 100 : 0;
    const deployHealth = overview.deployments.total > 0 ? (overview.deployments.ready / overview.deployments.total) * 100 : 0;
    return Math.round((nodeHealth + podHealth + deployHealth) / 3);
  }, [overview]);

  const healthConfig = useMemo(() => getHealthConfig(healthScore), [healthScore]);
  const healthCircumference = 2 * Math.PI * 42;
  const healthOffset = healthCircumference * (1 - healthScore / 100);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div
          className="h-8 w-8 animate-spin rounded-full border-b-2"
          style={{ borderColor: 'var(--color-primary)' }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[var(--color-text-primary)]">集群概览</h1>
          <p className="mt-1 text-[var(--color-text-secondary)]">实时监控集群状态和资源使用情况</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
            <ClockIcon className="h-4 w-4" />
            <span>
              更新于{' '}
              {new Date(dataUpdatedAt).toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </span>
          </div>
          <button onClick={() => refetch()} className="btn btn-secondary flex items-center gap-2">
            <ArrowPathIcon className="h-4 w-4" />
            刷新
          </button>
        </div>
      </div>

      {/* 集群健康度和核心指标 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="card lg:col-span-1 flex min-h-[180px] flex-col items-center justify-center p-6">
          <div className="relative">
            <svg width="100" height="100" className="-rotate-90 transform">
              <circle
                cx="50"
                cy="50"
                r="42"
                stroke="var(--color-border)"
                strokeWidth="8"
                fill="none"
              />
              <circle
                cx="50"
                cy="50"
                r="42"
                stroke={healthConfig.ringColor}
                strokeWidth="8"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={healthCircumference}
                strokeDashoffset={healthOffset}
                className="transition-all duration-500"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-semibold" style={{ color: healthConfig.textColor }}>
                {healthScore}%
              </span>
            </div>
          </div>
          <div className="mt-3 text-center">
            <div
              className="inline-flex rounded px-2 py-1 text-sm font-medium"
              style={{
                background: healthConfig.chip.bg,
                color: healthConfig.chip.text,
              }}
            >
              {healthConfig.label}
            </div>
            <div className="mt-1 text-xs text-[var(--color-text-muted)]">集群健康度</div>
          </div>
        </div>

        <div className="lg:col-span-4 grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatsCard
            title="节点"
            value={overview?.nodes.total ?? 0}
            subtitle={`${overview?.nodes.ready ?? 0} 就绪 / ${overview?.nodes.notReady ?? 0} 异常`}
            icon={ServerIcon}
            color="blue"
            trend={overview?.nodes.ready === overview?.nodes.total ? 'up' : 'down'}
          />
          <StatsCard
            title="Pods"
            value={overview?.pods.total ?? 0}
            subtitle={`${overview?.pods.ready ?? 0} 运行中`}
            icon={CubeIcon}
            color="green"
            trend={overview?.pods.ready === overview?.pods.total ? 'up' : undefined}
          />
          <StatsCard
            title="Deployments"
            value={overview?.deployments.total ?? 0}
            subtitle={`${overview?.deployments.ready ?? 0} 就绪`}
            icon={RectangleStackIcon}
            color="purple"
            trend={overview?.deployments.ready === overview?.deployments.total ? 'up' : 'down'}
          />
          <StatsCard
            title="Services"
            value={overview?.services.total ?? 0}
            subtitle={`${overview?.namespaces ?? 0} 命名空间`}
            icon={GlobeAltIcon}
            color="orange"
          />
        </div>
      </div>

      {/* 资源使用情况 */}
      <div className="card rounded-xl p-6">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-medium text-[var(--color-text-primary)]">
            <ChartBarIcon className="h-5 w-5 text-[var(--color-text-muted)]" />
            资源使用情况
          </h3>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col items-center">
            <h4 className="mb-2 text-sm font-medium text-[var(--color-text-secondary)]">CPU 使用率</h4>
            <p className="mb-3 text-xs text-[var(--color-text-muted)]">容器 CPU 占用</p>
            <ResourceChart
              used={overview?.resources.cpu.used ?? 0}
              total={overview?.resources.cpu.total ?? 100}
              unit={overview?.resources.cpu.unit ?? 'cores'}
            />
          </div>
          <div className="flex flex-col items-center">
            <h4 className="mb-2 text-sm font-medium text-[var(--color-text-secondary)]">容器内存</h4>
            <p className="mb-3 text-xs text-[var(--color-text-muted)]">K8s Working Set</p>
            <ResourceChart
              used={overview?.resources.memory.used ?? 0}
              total={overview?.resources.memory.total ?? 100}
              unit={overview?.resources.memory.unit ?? 'GB'}
            />
          </div>
          <div className="flex flex-col items-center">
            <h4 className="mb-2 text-sm font-medium text-[var(--color-text-secondary)]">节点内存</h4>
            <p className="mb-3 text-xs text-[var(--color-text-muted)]">OS 可用内存</p>
            <ResourceChart
              used={overview?.resources.nodeMemory?.used ?? 0}
              total={overview?.resources.nodeMemory?.total ?? 100}
              unit={overview?.resources.nodeMemory?.unit ?? 'GB'}
            />
          </div>
          <div className="flex flex-col items-center">
            <h4 className="mb-2 text-sm font-medium text-[var(--color-text-secondary)]">Pod 容量</h4>
            <p className="mb-3 text-xs text-[var(--color-text-muted)]">运行中的 Pod</p>
            <ResourceChart
              used={overview?.resources.pods.used ?? 0}
              total={overview?.resources.pods.total ?? 100}
              unit={overview?.resources.pods.unit ?? 'pods'}
            />
          </div>
        </div>
      </div>

      {/* 告警和事件 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card rounded-xl p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-lg font-medium text-[var(--color-text-primary)]">
              <BellAlertIcon className="h-5 w-5 text-[var(--color-text-muted)]" />
              告警概览
            </h3>
            <div className="flex items-center gap-2 text-sm">
              {alertFilter && (
                <button
                  onClick={() => setAlertFilter(null)}
                  className="rounded bg-[var(--color-bg-tertiary)] px-2 py-1 text-xs text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-elevated)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  清除筛选
                </button>
              )}
              {alertSummary && alertSummary.total > 0 && (
                <span
                  className="rounded px-2 py-1"
                  style={{
                    background: toneStyles.error.bg,
                    color: toneStyles.error.text,
                  }}
                >
                  {alertSummary.total} 个活跃告警
                </span>
              )}
            </div>
          </div>
          <div className="mb-4 grid grid-cols-3 gap-4">
            <StatFilterCard
              count={alertSummary?.critical ?? 0}
              label="严重"
              tone="error"
              active={alertFilter === 'critical'}
              onClick={() => setAlertFilter(alertFilter === 'critical' ? null : 'critical')}
            />
            <StatFilterCard
              count={alertSummary?.warning ?? 0}
              label="警告"
              tone="warning"
              active={alertFilter === 'warning'}
              onClick={() => setAlertFilter(alertFilter === 'warning' ? null : 'warning')}
            />
            <StatFilterCard
              count={alertSummary?.info ?? 0}
              label="信息"
              tone="info"
              active={alertFilter === 'info'}
              onClick={() => setAlertFilter(alertFilter === 'info' ? null : 'info')}
            />
          </div>
          <AlertsList limit={4} showTitle={false} severityFilter={alertFilter} />
        </div>

        <div className="card rounded-xl p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-lg font-medium text-[var(--color-text-primary)]">
              <ExclamationTriangleIcon className="h-5 w-5 text-[var(--color-text-muted)]" />
              事件概览
            </h3>
            {eventFilter && (
              <button
                onClick={() => setEventFilter(null)}
                className="rounded bg-[var(--color-bg-tertiary)] px-2 py-1 text-xs text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-elevated)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                清除筛选
              </button>
            )}
          </div>
          <div className="mb-4 grid grid-cols-2 gap-4">
            <EventFilterCard
              count={overview?.events.normal ?? 0}
              label="正常事件"
              icon={CheckCircleIcon}
              tone="success"
              active={eventFilter === 'Normal'}
              onClick={() => setEventFilter(eventFilter === 'Normal' ? null : 'Normal')}
            />
            <EventFilterCard
              count={overview?.events.warning ?? 0}
              label="警告事件"
              icon={ExclamationTriangleIcon}
              tone="warning"
              active={eventFilter === 'Warning'}
              onClick={() => setEventFilter(eventFilter === 'Warning' ? null : 'Warning')}
            />
          </div>
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-medium text-[var(--color-text-secondary)]">
              {eventFilter ? `${eventFilter === 'Normal' ? '正常' : '警告'}事件` : '最近事件'}
            </h4>
            <Link to="/events" className="text-sm text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]">
              查看全部 →
            </Link>
          </div>
          <EventsList limit={4} typeFilter={eventFilter} />
        </div>
      </div>

      {/* 快捷导航 */}
      <div className="card rounded-xl p-6">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-medium text-[var(--color-text-primary)]">
          <FolderIcon className="h-5 w-5 text-[var(--color-text-muted)]" />
          快捷导航
        </h3>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
          {quickLinks.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={clsx(
                'group flex min-h-[96px] flex-col items-center justify-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] p-4 transition-all duration-150',
                'hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-elevated)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
              )}
            >
              <item.icon className="h-8 w-8" style={{ color: item.iconColor }} />
              <span className="text-sm text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)]">
                {item.name}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
