import { useQuery } from '@tanstack/react-query';
import { alertApi } from '../../api';
import { usePollingInterval } from '../../utils/polling';
import { queryKeys } from '../../api/queryKeys';
import { createVisibilityRefetchInterval } from '../../api/queryPolicy';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
  BellAlertIcon,
} from '@heroicons/react/24/outline';

interface AlertsListProps {
  limit?: number;
  showTitle?: boolean;
  severityFilter?: 'critical' | 'warning' | 'info' | null;
}

export default function AlertsList({ limit = 5, showTitle = true, severityFilter = null }: AlertsListProps) {
  const pollingInterval = usePollingInterval('standard');
  const refetchInterval = createVisibilityRefetchInterval(pollingInterval);
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.alerts,
    queryFn: () => alertApi.list(),
    refetchInterval,
  });

  // 获取严重级别图标和样式
  const getSeverityConfig = (severity: string) => {
    switch (severity) {
      case 'critical':
        return {
          icon: ExclamationCircleIcon,
          background: 'var(--sys-error-soft-bg)',
          border: 'var(--sys-error-soft-border)',
          iconColor: 'var(--color-error)',
          textColor: 'var(--sys-error-soft-text)',
          label: '严重',
        };
      case 'warning':
        return {
          icon: ExclamationTriangleIcon,
          background: 'var(--sys-warning-soft-bg)',
          border: 'var(--sys-warning-soft-border)',
          iconColor: 'var(--color-warning)',
          textColor: 'var(--sys-warning-soft-text)',
          label: '警告',
        };
      case 'info':
      default:
        return {
          icon: InformationCircleIcon,
          background: 'var(--sys-info-soft-bg)',
          border: 'var(--sys-info-soft-border)',
          iconColor: 'var(--color-info)',
          textColor: 'var(--sys-info-soft-text)',
          label: '信息',
        };
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div
          className="animate-spin rounded-full h-6 w-6 border-b-2"
          style={{ borderColor: 'var(--color-primary)' }}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-4 text-[var(--color-text-muted)]">
        加载告警失败
      </div>
    );
  }

  // 根据过滤条件筛选告警
  let filteredAlerts = data?.items ?? [];
  if (severityFilter) {
    filteredAlerts = filteredAlerts.filter((alert) => {
      const severity = alert.labels?.severity || 'info';
      // 处理没有 severity 或 severity 为 none 的情况
      if (severityFilter === 'warning' && (!severity || severity === 'none')) {
        return true;
      }
      return severity === severityFilter;
    });
  }
  const alerts = filteredAlerts.slice(0, limit);

  if (alerts.length === 0) {
    return (
      <div className="text-center py-8 text-[var(--color-text-muted)]">
        <BellAlertIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>{severityFilter ? `暂无${getSeverityConfig(severityFilter).label}告警` : '暂无活跃告警'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {showTitle && (
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-[var(--color-text-secondary)]">
            {severityFilter ? `${getSeverityConfig(severityFilter).label}告警` : '活跃告警'}
          </h4>
          <span className="text-xs text-[var(--color-text-muted)]">
            {filteredAlerts.length} 个告警
          </span>
        </div>
      )}
      {alerts.map((alert) => {
        const severity = alert.labels?.severity || 'info';
        const config = getSeverityConfig(severity);
        const Icon = config.icon;
        const alertName = alert.labels?.alertname || '未知告警';
        const namespace = alert.labels?.namespace;
        const pod = alert.labels?.pod;
        const description = alert.annotations?.description || alert.annotations?.summary || '';

        return (
          <div
            key={alert.fingerprint}
            className="p-3 rounded-lg border transition-all duration-150"
            style={{
              background: config.background,
              borderColor: config.border,
            }}
          >
            <div className="flex items-start gap-3">
              <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: config.iconColor }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm" style={{ color: config.textColor }}>
                    {alertName}
                  </span>
                  <span
                    className="px-1.5 py-0.5 text-xs rounded"
                    style={{
                      background: config.background,
                      color: config.textColor,
                    }}
                  >
                    {config.label}
                  </span>
                </div>
                {(namespace || pod) && (
                  <div className="text-xs mt-1 text-[var(--color-text-muted)]">
                    {namespace && <span>{namespace}</span>}
                    {namespace && pod && <span> / </span>}
                    {pod && <span>{pod}</span>}
                  </div>
                )}
                {description && (
                  <p className="text-xs mt-1 line-clamp-2 text-[var(--color-text-secondary)]">
                    {description}
                  </p>
                )}
                <div className="text-xs mt-2 text-[var(--color-text-muted)]">
                  开始于{' '}
                  {formatDistanceToNow(new Date(alert.startsAt), {
                    addSuffix: true,
                    locale: zhCN,
                  })}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
