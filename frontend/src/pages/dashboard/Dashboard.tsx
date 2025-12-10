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
          <h1 className="text-2xl font-bold text-white">集群概览</h1>
          <p className="text-slate-400 mt-1">实时监控集群状态和资源使用情况</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-slate-400">
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
        <div className="card p-6 lg:col-span-1 flex flex-col items-center justify-center min-h-[180px]">
          {/* 气泡动画样式 */}
          <style>
            {`
              @keyframes health-bubble-pulse {
                0%, 100% {
                  r: var(--bubble-size);
                  opacity: var(--bubble-opacity);
                }
                50% {
                  r: calc(var(--bubble-size) * 1.4);
                  opacity: calc(var(--bubble-opacity) * 0.5);
                }
              }
              @keyframes health-glow {
                0%, 100% {
                  filter: drop-shadow(0 0 4px var(--glow-color));
                }
                50% {
                  filter: drop-shadow(0 0 10px var(--glow-color));
                }
              }
            `}
          </style>
          <div className="relative">
            <svg width="100" height="100" className="transform -rotate-90">
              <defs>
                <radialGradient id="health-bubble-gradient" cx="30%" cy="30%">
                  <stop offset="0%" stopColor="white" stopOpacity="0.9" />
                  <stop offset="100%" stopColor={healthScore >= 90 ? '#22c55e' : healthScore >= 70 ? '#3b82f6' : healthScore >= 50 ? '#f59e0b' : '#ef4444'} stopOpacity="0.3" />
                </radialGradient>
                <filter id="health-glow-filter" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="1.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <circle
                cx="50"
                cy="50"
                r="42"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                className="text-slate-700/50"
              />
              <circle
                cx="50"
                cy="50"
                r="42"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 42}
                strokeDashoffset={2 * Math.PI * 42 * (1 - healthScore / 100)}
                className="transition-all duration-700"
                style={{
                  stroke: healthScore >= 90 ? '#22c55e' : healthScore >= 70 ? '#3b82f6' : healthScore >= 50 ? '#f59e0b' : '#ef4444',
                  ['--glow-color' as string]: healthScore >= 90 ? '#22c55e80' : healthScore >= 70 ? '#3b82f680' : healthScore >= 50 ? '#f59e0b80' : '#ef444480',
                  animation: 'health-glow 2.5s ease-in-out infinite',
                }}
              />
              {/* 气泡效果 */}
              {healthScore > 5 && Array.from({ length: Math.min(Math.floor(healthScore / 15) + 2, 6) }, (_, i) => {
                const maxAngle = (healthScore / 100) * 360;
                const angle = ((maxAngle * (i + 0.5)) / (Math.min(Math.floor(healthScore / 15) + 2, 6))) - 90;
                const rad = (angle * Math.PI) / 180;
                const x = 50 + 42 * Math.cos(rad);
                const y = 50 + 42 * Math.sin(rad);
                const size = 1.5 + (i % 3) * 0.5;
                const delay = i * 0.4;
                const opacity = 0.5 + (i % 2) * 0.2;
                return (
                  <circle
                    key={i}
                    cx={x}
                    cy={y}
                    r={size}
                    fill="url(#health-bubble-gradient)"
                    filter="url(#health-glow-filter)"
                    style={{
                      ['--bubble-size' as string]: `${size}px`,
                      ['--bubble-opacity' as string]: opacity,
                      animation: `health-bubble-pulse ${2 + (i % 2)}s ease-in-out ${delay}s infinite`,
                    }}
                  />
                );
              })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={clsx('text-2xl font-bold', getHealthColor(healthScore))}>
                {healthScore}%
              </span>
            </div>
          </div>
          <div className="mt-2 text-center">
            <div className={clsx('text-base font-semibold', getHealthColor(healthScore))}>
              {getHealthText(healthScore)}
            </div>
            <div className="text-xs text-slate-500 mt-1">集群健康度</div>
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
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <ChartBarIcon className="w-5 h-5 text-slate-400" />
            资源使用情况
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="flex flex-col items-center">
            <h4 className="text-sm font-medium text-slate-400 mb-4">CPU</h4>
            <ResourceChart
              used={overview?.resources.cpu.used ?? 0}
              total={overview?.resources.cpu.total ?? 100}
              unit={overview?.resources.cpu.unit ?? 'cores'}
            />
          </div>
          <div className="flex flex-col items-center">
            <h4 className="text-sm font-medium text-slate-400 mb-4">内存</h4>
            <ResourceChart
              used={overview?.resources.memory.used ?? 0}
              total={overview?.resources.memory.total ?? 100}
              unit={overview?.resources.memory.unit ?? 'GB'}
            />
          </div>
          <div className="flex flex-col items-center">
            <h4 className="text-sm font-medium text-slate-400 mb-4">Pod 容量</h4>
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
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <BellAlertIcon className="w-5 h-5 text-slate-400" />
              告警概览
            </h3>
            <div className="flex items-center gap-2 text-sm">
              {alertFilter && (
                <button
                  onClick={() => setAlertFilter(null)}
                  className="px-2 py-1 rounded bg-slate-600/50 text-slate-300 hover:bg-slate-600 text-xs"
                >
                  清除筛选
                </button>
              )}
              {alertSummary && alertSummary.total > 0 && (
                <span className="px-2 py-1 rounded bg-red-500/20 text-red-400">
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
                'text-center p-3 rounded-lg border transition-all',
                alertFilter === 'critical'
                  ? 'bg-red-500/30 border-red-500/50 ring-2 ring-red-500/50'
                  : 'bg-red-500/10 border-red-500/20 hover:bg-red-500/20'
              )}
            >
              <p className="text-2xl font-bold text-red-400">{alertSummary?.critical ?? 0}</p>
              <p className="text-xs text-slate-400">严重</p>
            </button>
            <button
              onClick={() => setAlertFilter(alertFilter === 'warning' ? null : 'warning')}
              className={clsx(
                'text-center p-3 rounded-lg border transition-all',
                alertFilter === 'warning'
                  ? 'bg-amber-500/30 border-amber-500/50 ring-2 ring-amber-500/50'
                  : 'bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20'
              )}
            >
              <p className="text-2xl font-bold text-amber-400">{alertSummary?.warning ?? 0}</p>
              <p className="text-xs text-slate-400">警告</p>
            </button>
            <button
              onClick={() => setAlertFilter(alertFilter === 'info' ? null : 'info')}
              className={clsx(
                'text-center p-3 rounded-lg border transition-all',
                alertFilter === 'info'
                  ? 'bg-blue-500/30 border-blue-500/50 ring-2 ring-blue-500/50'
                  : 'bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/20'
              )}
            >
              <p className="text-2xl font-bold text-blue-400">{alertSummary?.info ?? 0}</p>
              <p className="text-xs text-slate-400">信息</p>
            </button>
          </div>
          {/* 告警列表 */}
          <AlertsList limit={4} showTitle={false} severityFilter={alertFilter} />
        </div>

        {/* 事件统计和最近事件 */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <ExclamationTriangleIcon className="w-5 h-5 text-slate-400" />
              事件概览
            </h3>
            {eventFilter && (
              <button
                onClick={() => setEventFilter(null)}
                className="px-2 py-1 rounded bg-slate-600/50 text-slate-300 hover:bg-slate-600 text-xs"
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
                'flex items-center gap-3 p-4 rounded-lg border transition-all text-left',
                eventFilter === 'Normal'
                  ? 'bg-green-500/30 border-green-500/50 ring-2 ring-green-500/50'
                  : 'bg-green-500/10 border-green-500/20 hover:bg-green-500/20'
              )}
            >
              <CheckCircleIcon className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold text-green-400">
                  {formatNumber(overview?.events.normal ?? 0, 0)}
                </p>
                <p className="text-xs text-slate-400">正常事件</p>
              </div>
            </button>
            <button
              onClick={() => setEventFilter(eventFilter === 'Warning' ? null : 'Warning')}
              className={clsx(
                'flex items-center gap-3 p-4 rounded-lg border transition-all text-left',
                eventFilter === 'Warning'
                  ? 'bg-yellow-500/30 border-yellow-500/50 ring-2 ring-yellow-500/50'
                  : 'bg-yellow-500/10 border-yellow-500/20 hover:bg-yellow-500/20'
              )}
            >
              <ExclamationTriangleIcon className="w-8 h-8 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold text-yellow-400">
                  {formatNumber(overview?.events.warning ?? 0, 0)}
                </p>
                <p className="text-xs text-slate-400">警告事件</p>
              </div>
            </button>
          </div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-slate-400">
              {eventFilter ? `${eventFilter === 'Normal' ? '正常' : '警告'}事件` : '最近事件'}
            </h4>
            <Link
              to="/events"
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              查看全部 →
            </Link>
          </div>
          <EventsList limit={4} typeFilter={eventFilter} />
        </div>
      </div>

      {/* 快捷导航 */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <FolderIcon className="w-5 h-5 text-slate-400" />
          快捷导航
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[
            { name: 'Pods', path: '/workloads/pods', icon: CubeIcon, color: 'blue' },
            { name: 'Deployments', path: '/workloads/deployments', icon: RectangleStackIcon, color: 'purple' },
            { name: 'Services', path: '/network/services', icon: GlobeAltIcon, color: 'orange' },
            { name: 'Nodes', path: '/nodes', icon: ServerIcon, color: 'green' },
            { name: 'ConfigMaps', path: '/config/configmaps', icon: FolderIcon, color: 'blue' },
            { name: 'Namespaces', path: '/namespaces', icon: FolderIcon, color: 'purple' },
          ].map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={clsx(
                'flex flex-col items-center gap-2 p-4 rounded-lg border transition-all',
                'bg-slate-800/50 border-slate-700/50 hover:bg-slate-700/50 hover:border-slate-600'
              )}
            >
              <item.icon className={clsx('w-8 h-8', `text-${item.color}-400`)} />
              <span className="text-sm text-slate-300">{item.name}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
