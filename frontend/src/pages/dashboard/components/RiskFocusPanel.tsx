import { Link } from 'react-router-dom';
import {
  BellAlertIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import AlertsList from '../../../components/common/AlertsList';
import EventsList from '../../../components/common/EventsList';
import { formatNumber } from '../../../utils/format';
import type { AlertSeverityFilter, EventTypeFilter, RiskFocusPanelProps } from '../types';

interface AlertFilterOption {
  value: AlertSeverityFilter;
  label: string;
  count: number;
  activeClass: string;
}

interface EventFilterOption {
  value: EventTypeFilter;
  label: string;
  count: number;
  activeClass: string;
}

export default function RiskFocusPanel({
  overview,
  alertSummary,
  alertFilter,
  eventFilter,
  onAlertFilterChange,
  onEventFilterChange,
}: RiskFocusPanelProps) {
  const alertOptions: AlertFilterOption[] = [
    {
      value: 'critical',
      label: '严重',
      count: alertSummary?.critical ?? 0,
      activeClass:
        'border-[var(--sys-error-soft-border)] bg-[var(--sys-error-soft-bg)] text-[var(--sys-error-soft-text)]',
    },
    {
      value: 'warning',
      label: '警告',
      count: alertSummary?.warning ?? 0,
      activeClass:
        'border-[var(--sys-warning-soft-border)] bg-[var(--sys-warning-soft-bg)] text-[var(--sys-warning-soft-text)]',
    },
    {
      value: 'info',
      label: '信息',
      count: alertSummary?.info ?? 0,
      activeClass:
        'border-[var(--sys-info-soft-border)] bg-[var(--sys-info-soft-bg)] text-[var(--sys-info-soft-text)]',
    },
  ];

  const eventOptions: EventFilterOption[] = [
    {
      value: 'Warning',
      label: '警告事件',
      count: overview.events.warning,
      activeClass:
        'border-[var(--sys-warning-soft-border)] bg-[var(--sys-warning-soft-bg)] text-[var(--sys-warning-soft-text)]',
    },
    {
      value: 'Normal',
      label: '正常事件',
      count: overview.events.normal,
      activeClass:
        'border-[var(--sys-success-soft-border)] bg-[var(--sys-success-soft-bg)] text-[var(--sys-success-soft-text)]',
    },
  ];

  return (
    <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <article className="card rounded-xl border-divider-strong bg-surface-risk p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--color-text-primary)]">
              <BellAlertIcon className="h-5 w-5 text-[var(--color-error)]" />
              高优先告警
            </h2>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              总计 {formatNumber(alertSummary?.total ?? 0, 0)} 条活跃告警
            </p>
          </div>
          <Link
            to="/alerts"
            className="text-sm font-medium text-[var(--color-primary)] transition-colors duration-150 ease-out hover:text-[var(--color-primary-hover)]"
          >
            查看全部
          </Link>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-2">
          {alertOptions.map((option) => {
            const active = alertFilter === option.value;
            return (
              <button
                key={option.label}
                type="button"
                onClick={() => onAlertFilterChange(active ? null : option.value)}
                className={`min-h-[44px] rounded-lg border px-3 py-2 text-left text-xs transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
                  active
                    ? option.activeClass
                    : 'border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-hover)]'
                }`}
                aria-pressed={active}
                aria-label={`${option.label}告警筛选`}
              >
                <p className="text-[11px]">{option.label}</p>
                <p className="mt-1 text-base font-semibold">{formatNumber(option.count, 0)}</p>
              </button>
            );
          })}
        </div>

        <AlertsList limit={5} showTitle={false} severityFilter={alertFilter} density="compact" />
      </article>

      <article className="card rounded-xl border-divider-strong bg-surface-neutral p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--color-text-primary)]">
              <ExclamationTriangleIcon className="h-5 w-5 text-[var(--color-warning)]" />
              风险事件
            </h2>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              近实时事件流，便于快速排查异常。
            </p>
          </div>
          <Link
            to="/events"
            className="text-sm font-medium text-[var(--color-primary)] transition-colors duration-150 ease-out hover:text-[var(--color-primary-hover)]"
          >
            查看全部
          </Link>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2">
          {eventOptions.map((option) => {
            const active = eventFilter === option.value;
            return (
              <button
                key={option.label}
                type="button"
                onClick={() => onEventFilterChange(active ? null : option.value)}
                className={`min-h-[44px] rounded-lg border px-3 py-2 text-left text-xs transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
                  active
                    ? option.activeClass
                    : 'border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-hover)]'
                }`}
                aria-pressed={active}
                aria-label={`${option.label}筛选`}
              >
                <p className="text-[11px]">{option.label}</p>
                <p className="mt-1 text-base font-semibold">{formatNumber(option.count, 0)}</p>
              </button>
            );
          })}
        </div>

        <EventsList limit={5} typeFilter={eventFilter} density="compact" />
      </article>
    </section>
  );
}
