import { useQuery } from '@tanstack/react-query';
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
}

export default function EventsList({ namespace, limit = 10, typeFilter = null }: EventsListProps) {
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

  return (
    <div className="space-y-3">
      {events.map((event) => (
        <div
          key={event.metadata.uid}
          className="flex items-start gap-3 p-3 rounded-lg transition-colors duration-150"
          style={{
            background: event.type === 'Warning' ? 'var(--sys-warning-soft-bg)' : 'var(--color-bg-tertiary)',
            border: `1px solid ${event.type === 'Warning' ? 'var(--sys-warning-soft-border)' : 'var(--color-border)'}`,
          }}
        >
          {event.type === 'Warning' ? (
            <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0 mt-0.5 text-[var(--color-warning)]" />
          ) : event.type === 'Normal' ? (
            <CheckCircleIcon className="w-5 h-5 flex-shrink-0 mt-0.5 text-[var(--color-success)]" />
          ) : (
            <InformationCircleIcon className="w-5 h-5 flex-shrink-0 mt-0.5 text-[var(--color-info)]" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium truncate text-[var(--color-text-primary)]">
                {event.reason}
              </p>
              <span className="text-xs flex-shrink-0 text-[var(--color-text-muted)]">
                {event.lastTimestamp &&
                  formatDistanceToNow(new Date(event.lastTimestamp), {
                    addSuffix: true,
                    locale: zhCN,
                  })}
              </span>
            </div>
            <p className="text-sm mt-1 line-clamp-2 text-[var(--color-text-secondary)]">
              {event.message}
            </p>
            <p className="text-xs mt-1 text-[var(--color-text-muted)]">
              {event.involvedObject.kind}/{event.involvedObject.name}
              {event.involvedObject.namespace && ` in ${event.involvedObject.namespace}`}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
