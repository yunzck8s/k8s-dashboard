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
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
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
      <div className="text-center py-8 text-slate-400">
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
          className={clsx(
            'flex items-start gap-3 p-3 rounded-lg',
            event.type === 'Warning'
              ? 'bg-yellow-500/10 border border-yellow-500/20'
              : 'bg-slate-700/50 border border-slate-600/50'
          )}
        >
          {event.type === 'Warning' ? (
            <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
          ) : event.type === 'Normal' ? (
            <CheckCircleIcon className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
          ) : (
            <InformationCircleIcon className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-white truncate">
                {event.reason}
              </p>
              <span className="text-xs text-slate-500 flex-shrink-0">
                {event.lastTimestamp &&
                  formatDistanceToNow(new Date(event.lastTimestamp), {
                    addSuffix: true,
                    locale: zhCN,
                  })}
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-1 line-clamp-2">
              {event.message}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {event.involvedObject.kind}/{event.involvedObject.name}
              {event.involvedObject.namespace && ` in ${event.involvedObject.namespace}`}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
