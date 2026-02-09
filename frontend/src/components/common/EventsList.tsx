import { useQuery } from '@tanstack/react-query';
import { eventApi } from '../../api';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import clsx from 'clsx';
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
  const { data, isLoading } = useQuery({
    queryKey: ['events', namespace],
    queryFn: () =>
      namespace
        ? eventApi.list(namespace, { pageSize: 100 })
        : eventApi.listAll({ pageSize: 100 }),
    refetchInterval: 30000,
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
      <div className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>
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
            background: event.type === 'Warning' ? 'rgba(245, 158, 11, 0.1)' : 'var(--color-bg-tertiary)',
            border: `1px solid ${event.type === 'Warning' ? 'rgba(245, 158, 11, 0.2)' : 'var(--color-border)'}`,
          }}
        >
          {event.type === 'Warning' ? (
            <ExclamationTriangleIcon className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          ) : event.type === 'Normal' ? (
            <CheckCircleIcon className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
          ) : (
            <InformationCircleIcon className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                {event.reason}
              </p>
              <span className="text-xs flex-shrink-0" style={{ color: 'var(--color-text-muted)' }}>
                {event.lastTimestamp &&
                  formatDistanceToNow(new Date(event.lastTimestamp), {
                    addSuffix: true,
                    locale: zhCN,
                  })}
              </span>
            </div>
            <p className="text-sm mt-1 line-clamp-2" style={{ color: 'var(--color-text-secondary)' }}>
              {event.message}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
              {event.involvedObject.kind}/{event.involvedObject.name}
              {event.involvedObject.namespace && ` in ${event.involvedObject.namespace}`}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
