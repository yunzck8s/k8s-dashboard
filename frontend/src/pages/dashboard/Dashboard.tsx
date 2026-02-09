import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { overviewApi, alertApi } from '../../api';
import StatsCard from '../../components/common/StatsCard';
import ResourceChart from '../../components/charts/ResourceChart';
import EventsList from '../../components/common/EventsList';
import AlertsList from '../../components/common/AlertsList';
import { formatNumber } from '../../utils/format';
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
import clsx from 'clsx';

// 过滤类型定义
type AlertSeverityFilter = 'critical' | 'warning' | 'info' | null;
type EventTypeFilter = 'Normal' | 'Warning' | null;

export default function Dashboard() {
  // 过滤状态
  const [alertFilter, setAlertFilter] = useState<AlertSeverityFilter>(null);
  const [eventFilter, setEventFilter] = useState<EventTypeFilter>(null);

  const {
    data: overview,
    isLoading,
    refetch,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ['overview'],
    queryFn: overviewApi.getOverview,
    refetchInterval: 15000,
  });

  // 获取告警摘要
  const { data: alertSummary } = useQuery({
    queryKey: ['alertSummary'],
    queryFn: alertApi.getSummary,
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  // 计算集群健康度
  const healthScore = (() => {
    if (!overview) return 0;
    const nodeHealth = overview.nodes.total > 0 ? (overview.nodes.ready / overview.nodes.total) * 100 : 0;
    const podHealth = overview.pods.total > 0 ? (overview.pods.ready / overview.pods.total) * 100 : 0;
    const deployHealth = overview.deployments.total > 0 ? (overview.deployments.ready / overview.deployments.total) * 100 : 0;
    return Math.round((nodeHealth + podHealth + deployHealth) / 3);
  })();

  const getHealthColor = (score: number) => {
    if (score >= 90) return 'text-green-400';
    if (score >= 70) return 'text-blue-400';
    if (score >= 50) return 'text-amber-400';
    return 'text-red-400';
  };

  const getHealthText = (score: number) => {
    if (score >= 90) return '健康';
    if (score >= 70) return '良好';
    if (score >= 50) return '警告';
    return '异常';
  };

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            集群概览
          </h1>
          <p className="mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            实时监控集群状态和资源使用情况
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            <ClockIcon className="w-4 h-4" />
            <span>
              更新于{' '}
              {new Date(dataUpdatedAt).toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </span>
          </div>
          <button
            onClick={() => refetch()}
            className="btn btn-secondary flex items-center gap-2"
          >
            <ArrowPathIcon className="w-4 h-4" />
            刷新
          </button>
        </div>
      </div>

      {/* 集群健康度和核心指标 */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* 集群健康度 */}
        <div
          className="p-6 lg:col-span-1 flex flex-col items-center justify-center min-h-[180px] rounded-xl"
          style={{
            background: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
          }}
        >
          <div className="relative">
            <svg width="100" height="100" className="transform -rotate-90">
              <circle
                cx="50"
                cy="50"
                r="42"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                className="text-slate-700/30"
              />
              <circle
                cx="50"
                cy="50"
                r="42"
                stroke={healthScore >= 90 ? '#10B981' : healthScore >= 70 ? '#3B82F6' : healthScore >= 50 ? '#F59E0B' : '#EF4444'}
                strokeWidth="8"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 42}
                strokeDashoffset={2 * Math.PI * 42 * (1 - healthScore / 100)}
                className="transition-all duration-500"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={clsx('text-2xl font-semibold', getHealthColor(healthScore))}>
                {healthScore}%
              </span>
            </div>
          </div>
          <div className="mt-2 text-center">
            <div className={clsx('text-base font-medium', getHealthColor(healthScore))}>
              {getHealthText(healthScore)}
            </div>
            <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
              集群健康度
            </div>
          </div>
        </div>

        {/* 核心指标卡片 */}
        <div className="lg:col-span-4 grid grid-cols-2 md:grid-cols-4 gap-4">
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
      <div
        className="p-6 rounded-xl"
        style={{
          background: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
        }}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-medium flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
            <ChartBarIcon className="w-5 h-5" style={{ color: 'var(--color-text-muted)' }} />
            资源使用情况
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="flex flex-col items-center">
            <h4 className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>CPU 使用率</h4>
            <p className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>容器 CPU 占用</p>
            <ResourceChart
              used={overview?.resources.cpu.used ?? 0}
              total={overview?.resources.cpu.total ?? 100}
              unit={overview?.resources.cpu.unit ?? 'cores'}
            />
          </div>
          <div className="flex flex-col items-center">
            <h4 className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>容器内存</h4>
            <p className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>K8s Working Set</p>
            <ResourceChart
              used={overview?.resources.memory.used ?? 0}
              total={overview?.resources.memory.total ?? 100}
              unit={overview?.resources.memory.unit ?? 'GB'}
            />
          </div>
          <div className="flex flex-col items-center">
            <h4 className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>节点内存</h4>
            <p className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>OS 可用内存</p>
            <ResourceChart
              used={overview?.resources.nodeMemory?.used ?? 0}
              total={overview?.resources.nodeMemory?.total ?? 100}
              unit={overview?.resources.nodeMemory?.unit ?? 'GB'}
            />
          </div>
          <div className="flex flex-col items-center">
            <h4 className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>Pod 容量</h4>
            <p className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>运行中的 Pod</p>
            <ResourceChart
              used={overview?.resources.pods.used ?? 0}
              total={overview?.resources.pods.total ?? 100}
              unit={overview?.resources.pods.unit ?? 'pods'}
            />
          </div>
        </div>
      </div>

      {/* 告警和事件 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 告警概览 */}
        <div
          className="p-6 rounded-xl"
          style={{
            background: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
              <BellAlertIcon className="w-5 h-5" style={{ color: 'var(--color-text-muted)' }} />
              告警概览
            </h3>
            <div className="flex items-center gap-2 text-sm">
              {alertFilter && (
                <button
                  onClick={() => setAlertFilter(null)}
                  className="px-2 py-1 rounded text-xs transition-colors"
                  style={{
                    background: 'var(--color-bg-tertiary)',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  清除筛选
                </button>
              )}
              {alertSummary && alertSummary.total > 0 && (
                <span
                  className="px-2 py-1 rounded"
                  style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    color: '#F87171',
                  }}
                >
                  {alertSummary.total} 个活跃告警
                </span>
              )}
            </div>
          </div>
          {/* 告警统计 - 可点击筛选 */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <button
              onClick={() => setAlertFilter(alertFilter === 'critical' ? null : 'critical')}
              className={clsx(
                'text-center p-3 rounded-lg border transition-all duration-150',
                alertFilter === 'critical'
                  ? 'bg-red-500/20 border-red-500/40 ring-2 ring-red-500/30'
                  : 'bg-red-500/10 border-red-500/20'
              )}
            >
              <p className="text-2xl font-semibold text-red-400">{alertSummary?.critical ?? 0}</p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>严重</p>
            </button>
            <button
              onClick={() => setAlertFilter(alertFilter === 'warning' ? null : 'warning')}
              className={clsx(
                'text-center p-3 rounded-lg border transition-all duration-150',
                alertFilter === 'warning'
                  ? 'bg-amber-500/20 border-amber-500/40 ring-2 ring-amber-500/30'
                  : 'bg-amber-500/10 border-amber-500/20'
              )}
            >
              <p className="text-2xl font-semibold text-amber-400">{alertSummary?.warning ?? 0}</p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>警告</p>
            </button>
            <button
              onClick={() => setAlertFilter(alertFilter === 'info' ? null : 'info')}
              className={clsx(
                'text-center p-3 rounded-lg border transition-all duration-150',
                alertFilter === 'info'
                  ? 'bg-blue-500/20 border-blue-500/40 ring-2 ring-blue-500/30'
                  : 'bg-blue-500/10 border-blue-500/20'
              )}
            >
              <p className="text-2xl font-semibold text-blue-400">{alertSummary?.info ?? 0}</p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>信息</p>
            </button>
          </div>
          {/* 告警列表 */}
          <AlertsList limit={4} showTitle={false} severityFilter={alertFilter} />
        </div>

        {/* 事件统计和最近事件 */}
        <div
          className="p-6 rounded-xl"
          style={{
            background: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
              <ExclamationTriangleIcon className="w-5 h-5" style={{ color: 'var(--color-text-muted)' }} />
              事件概览
            </h3>
            {eventFilter && (
              <button
                onClick={() => setEventFilter(null)}
                className="px-2 py-1 rounded text-xs transition-colors"
                style={{
                  background: 'var(--color-bg-tertiary)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                清除筛选
              </button>
            )}
          </div>
          {/* 事件统计 - 可点击筛选 */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <button
              onClick={() => setEventFilter(eventFilter === 'Normal' ? null : 'Normal')}
              className={clsx(
                'flex items-center gap-3 p-4 rounded-lg border transition-all duration-150 text-left',
                eventFilter === 'Normal'
                  ? 'bg-emerald-500/20 border-emerald-500/40 ring-2 ring-emerald-500/30'
                  : 'bg-emerald-500/10 border-emerald-500/20'
              )}
            >
              <CheckCircleIcon className="w-8 h-8 text-emerald-500" />
              <div>
                <p className="text-2xl font-semibold text-emerald-400">
                  {formatNumber(overview?.events.normal ?? 0, 0)}
                </p>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>正常事件</p>
              </div>
            </button>
            <button
              onClick={() => setEventFilter(eventFilter === 'Warning' ? null : 'Warning')}
              className={clsx(
                'flex items-center gap-3 p-4 rounded-lg border transition-all duration-150 text-left',
                eventFilter === 'Warning'
                  ? 'bg-amber-500/20 border-amber-500/40 ring-2 ring-amber-500/30'
                  : 'bg-amber-500/10 border-amber-500/20'
              )}
            >
              <ExclamationTriangleIcon className="w-8 h-8 text-amber-500" />
              <div>
                <p className="text-2xl font-semibold text-amber-400">
                  {formatNumber(overview?.events.warning ?? 0, 0)}
                </p>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>警告事件</p>
              </div>
            </button>
          </div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              {eventFilter ? `${eventFilter === 'Normal' ? '正常' : '警告'}事件` : '最近事件'}
            </h4>
            <Link
              to="/events"
              className="text-sm transition-colors"
              style={{ color: 'var(--color-primary)' }}
            >
              查看全部 →
            </Link>
          </div>
          <EventsList limit={4} typeFilter={eventFilter} />
        </div>
      </div>

      {/* 快捷导航 */}
      <div
        className="p-6 rounded-xl"
        style={{
          background: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
        }}
      >
        <h3 className="text-lg font-medium mb-4 flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
          <FolderIcon className="w-5 h-5" style={{ color: 'var(--color-text-muted)' }} />
          快捷导航
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[
            { name: 'Pods', path: '/workloads/pods', icon: CubeIcon, color: '#60A5FA' },
            { name: 'Deployments', path: '/workloads/deployments', icon: RectangleStackIcon, color: '#818CF8' },
            { name: 'Services', path: '/network/services', icon: GlobeAltIcon, color: '#FBBF24' },
            { name: 'Nodes', path: '/nodes', icon: ServerIcon, color: '#34D399' },
            { name: 'ConfigMaps', path: '/config/configmaps', icon: FolderIcon, color: '#60A5FA' },
            { name: 'Namespaces', path: '/namespaces', icon: FolderIcon, color: '#818CF8' },
          ].map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className="flex flex-col items-center gap-2 p-4 rounded-lg border transition-all duration-150"
              style={{
                background: 'var(--color-bg-tertiary)',
                borderColor: 'var(--color-border)',
              }}
            >
              <item.icon className="w-8 h-8" style={{ color: item.color }} />
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{item.name}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
