import { Link } from 'react-router-dom';
import {
  ArrowPathIcon,
  BellAlertIcon,
  ExclamationTriangleIcon,
  ServerIcon,
} from '@heroicons/react/24/outline';
import { formatNumber } from '../../../utils/format';
import type { ExecutiveSummaryProps } from '../types';

function getHealthTone(healthScore: number) {
  if (healthScore >= 90) {
    return {
      label: '健康',
      textClass: 'text-[var(--color-success)]',
      badgeClass:
        'border-[var(--sys-success-soft-border)] bg-[var(--sys-success-soft-bg)] text-[var(--sys-success-soft-text)]',
    };
  }
  if (healthScore >= 70) {
    return {
      label: '良好',
      textClass: 'text-[var(--color-info)]',
      badgeClass:
        'border-[var(--sys-info-soft-border)] bg-[var(--sys-info-soft-bg)] text-[var(--sys-info-soft-text)]',
    };
  }
  if (healthScore >= 50) {
    return {
      label: '警告',
      textClass: 'text-[var(--color-warning)]',
      badgeClass:
        'border-[var(--sys-warning-soft-border)] bg-[var(--sys-warning-soft-bg)] text-[var(--sys-warning-soft-text)]',
    };
  }
  return {
    label: '异常',
    textClass: 'text-[var(--color-error)]',
    badgeClass:
      'border-[var(--sys-error-soft-border)] bg-[var(--sys-error-soft-bg)] text-[var(--sys-error-soft-text)]',
  };
}

export default function ExecutiveSummary({
  overview,
  alertSummary,
  healthScore,
  updatedTimeLabel,
  onRefresh,
}: ExecutiveSummaryProps) {
  const healthTone = getHealthTone(healthScore);
  const activeAlerts = alertSummary?.total ?? 0;
  const unhealthyNodes = overview.nodes.notReady;
  const warningEvents = overview.events.warning;

  return (
    <section className="card rounded-xl p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
            Executive Summary
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-[var(--color-text-primary)]">
            集群决策总览
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            先看结论，再进入风险与运维细节。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-md border border-divider-strong bg-surface-neutral px-3 py-1 text-xs text-[var(--color-text-muted)]">
            更新于 {updatedTimeLabel}
          </span>
          <button
            type="button"
            onClick={onRefresh}
            className="btn btn-secondary inline-flex items-center gap-2"
            aria-label="刷新首页数据"
          >
            <ArrowPathIcon className="h-4 w-4" />
            刷新
          </button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-divider-strong bg-surface-emphasis p-4">
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
            当前健康分
          </p>
          <p className={`mt-2 text-3xl font-semibold ${healthTone.textClass}`}>{healthScore}%</p>
          <span className={`mt-2 inline-flex rounded-md border px-2 py-1 text-xs ${healthTone.badgeClass}`}>
            {healthTone.label}
          </span>
        </article>

        <Link
          to="/alerts"
          className="group rounded-xl border border-divider-strong bg-surface-neutral p-4 transition-colors duration-150 ease-out hover:border-[var(--color-border-hover)] hover:bg-surface-emphasis focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          aria-label="查看活跃告警详情"
        >
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
            活跃告警
          </p>
          <p className="mt-2 text-3xl font-semibold text-[var(--color-error)]">
            {formatNumber(activeAlerts, 0)}
          </p>
          <p className="mt-2 inline-flex items-center gap-1 text-xs text-[var(--color-text-secondary)]">
            <BellAlertIcon className="h-4 w-4" />
            进入告警中心
          </p>
        </Link>

        <Link
          to="/nodes"
          className="group rounded-xl border border-divider-strong bg-surface-neutral p-4 transition-colors duration-150 ease-out hover:border-[var(--color-border-hover)] hover:bg-surface-emphasis focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          aria-label="查看异常节点详情"
        >
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
            异常节点
          </p>
          <p className="mt-2 text-3xl font-semibold text-[var(--color-warning)]">
            {formatNumber(unhealthyNodes, 0)}
          </p>
          <p className="mt-2 inline-flex items-center gap-1 text-xs text-[var(--color-text-secondary)]">
            <ServerIcon className="h-4 w-4" />
            查看节点状态
          </p>
        </Link>

        <Link
          to="/events"
          className="group rounded-xl border border-divider-strong bg-surface-neutral p-4 transition-colors duration-150 ease-out hover:border-[var(--color-border-hover)] hover:bg-surface-emphasis focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          aria-label="查看警告事件详情"
        >
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
            警告事件
          </p>
          <p className="mt-2 text-3xl font-semibold text-[var(--color-warning)]">
            {formatNumber(warningEvents, 0)}
          </p>
          <p className="mt-2 inline-flex items-center gap-1 text-xs text-[var(--color-text-secondary)]">
            <ExclamationTriangleIcon className="h-4 w-4" />
            进入事件页
          </p>
        </Link>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Link
          to="/alerts"
          className="btn btn-primary inline-flex items-center gap-2"
          aria-label="进入告警中心"
        >
          <BellAlertIcon className="h-4 w-4" />
          进入告警中心
        </Link>
        <Link
          to="/observation"
          className="btn btn-secondary"
          aria-label="查看状态观测"
        >
          查看状态观测
        </Link>
      </div>
    </section>
  );
}
