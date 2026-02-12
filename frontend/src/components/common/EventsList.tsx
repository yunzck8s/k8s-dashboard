import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { eventApi } from '../../api';
import { usePollingInterval } from '../../utils/polling';
import { queryKeys } from '../../api/queryKeys';
import { createVisibilityRefetchInterval } from '../../api/queryPolicy';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline';

interface EventsListProps {
  namespace?: string;
  limit?: number;
  typeFilter?: 'Normal' | 'Warning' | null;
  density?: 'compact' | 'comfortable';
}

export default function EventsList({
  namespace,
  limit = 10,
  typeFilter = null,
  density = 'comfortable',
}: EventsListProps) {
  const pollingInterval = usePollingInterval('standard');
  const refetchInterval = createVisibilityRefetchInterval(pollingInterval);
  const namespaceKey = namespace ?? 'all';
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.events(namespaceKey),
    queryFn: () =>
      namespace
        ? eventApi.list(namespace, { pageSize: 100 })
        : eventApi.listAll({ pageSize: 100 }),
    refetchInterval,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div
          className="animate-spin rounded-full h-6 w-6 border-b-2"
          style={{ borderColor: 'var(--color-primary)' }}
        />
      </div>
    );
  }

  // 根据过滤条件筛选事件
  let filteredEvents = data?.items ?? [];
  if (typeFilter) {
    filteredEvents = filteredEvents.filter((event) => event.type === typeFilter);
  }
  const events = filteredEvents.slice(0, limit);

  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-[var(--color-text-muted)]">
        <CalendarIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>{typeFilter ? `暂无${typeFilter === 'Normal' ? '正常' : '警告'}事件` : '暂无事件'}</p>
      </div>
    );
  }
  const isCompact = density === 'compact';

  return (
    <div className={clsx(isCompact ? 'space-y-2.5' : 'space-y-3')}>
      {events.map((event) => (
        <div
          key={event.metadata.uid}
          className={clsx(
            'flex items-start gap-3 rounded-lg border transition-colors duration-150 ease-out',
            isCompact ? 'p-2.5' : 'p-3'
          )}
          style={{
            background: event.type === 'Warning' ? 'var(--sys-warning-soft-bg)' : 'var(--color-bg-tertiary)',
            borderColor: event.type === 'Warning' ? 'var(--sys-warning-soft-border)' : 'var(--color-border)',
          }}
        >
          {event.type === 'Warning' ? (
            <ExclamationTriangleIcon className={clsx('mt-0.5 flex-shrink-0 text-[var(--color-warning)]', isCompact ? 'h-4 w-4' : 'h-5 w-5')} />
          ) : event.type === 'Normal' ? (
            <CheckCircleIcon className={clsx('mt-0.5 flex-shrink-0 text-[var(--color-success)]', isCompact ? 'h-4 w-4' : 'h-5 w-5')} />
          ) : (
            <InformationCircleIcon className={clsx('mt-0.5 flex-shrink-0 text-[var(--color-info)]', isCompact ? 'h-4 w-4' : 'h-5 w-5')} />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className={clsx('truncate font-medium text-[var(--color-text-primary)]', isCompact ? 'text-xs' : 'text-sm')}>
                {event.reason}
              </p>
              <span className={clsx('flex-shrink-0 text-[var(--color-text-muted)]', isCompact ? 'text-[11px]' : 'text-xs')}>
                {event.lastTimestamp &&
                  formatDistanceToNow(new Date(event.lastTimestamp), {
                    addSuffix: true,
                    locale: zhCN,
                  })}
                </span>
            </div>
            <p className={clsx('mt-1 line-clamp-2 text-[var(--color-text-secondary)]', isCompact ? 'text-xs' : 'text-sm')}>
              {event.message}
            </p>
            <p className={clsx('mt-1 text-[var(--color-text-muted)]', isCompact ? 'text-[11px]' : 'text-xs')}>
              {event.involvedObject.kind}/{event.involvedObject.name}
              {event.involvedObject.namespace && ` in ${event.involvedObject.namespace}`}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
