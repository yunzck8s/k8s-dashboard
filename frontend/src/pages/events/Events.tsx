import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { eventApi } from '../../api';
import { useAppStore } from '../../store';
import { usePollingInterval } from '../../utils/polling';
import { queryKeys } from '../../api/queryKeys';
import { createVisibilityRefetchInterval } from '../../api/queryPolicy';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import clsx from 'clsx';
import {
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import type { Event } from '../../types';

export default function Events() {
  const { currentNamespace } = useAppStore();
  const pollingInterval = usePollingInterval('fast');
  const refetchInterval = createVisibilityRefetchInterval(pollingInterval);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.events(currentNamespace),
    queryFn: () =>
      currentNamespace === 'all'
        ? eventApi.listAll()
        : eventApi.list(currentNamespace),
    refetchInterval,
  });

  const events = useMemo(() => data?.items ?? [], [data?.items]);

  // 按时间排序，最新的在前
  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => {
      const timeA = a.lastTimestamp || a.metadata.creationTimestamp;
      const timeB = b.lastTimestamp || b.metadata.creationTimestamp;
      return new Date(timeB).getTime() - new Date(timeA).getTime();
    });
  }, [events]);

  // 统计事件类型
  const { normalCount, warningCount } = useMemo(() => {
    return {
      normalCount: events.filter((event) => event.type === 'Normal').length,
      warningCount: events.filter((event) => event.type === 'Warning').length,
    };
  }, [events]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-6 text-center">
        <p className="text-red-400">加载失败：{(error as Error).message}</p>
        <button onClick={() => refetch()} className="btn btn-primary mt-4">
          重试
        </button>
      </div>
    );
  }

  // 获取事件时间
  const getEventTime = (event: Event) => {
    const time = event.lastTimestamp || event.metadata.creationTimestamp;
    return formatDistanceToNow(new Date(time), {
      addSuffix: true,
      locale: zhCN,
    });
  };

  // 获取对象引用
  const getInvolvedObject = (event: Event) => {
    const obj = event.involvedObject;
    if (!obj) return '-';
    return `${obj.kind}/${obj.name}`;
  };

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">事件</h1>
          <p className="text-slate-400 mt-1">
            共 {events.length} 个事件
            {currentNamespace !== 'all' && ` 在 ${currentNamespace} 命名空间`}
          </p>
        </div>
        <button onClick={() => refetch()} className="btn btn-secondary">
          刷新
        </button>
      </div>

      {/* 事件统计 */}
      <div className="grid grid-cols-2 gap-4 max-w-md">
        <div className="card p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-500/10">
            <InformationCircleIcon className="w-6 h-6 text-green-500" />
          </div>
          <div>
            <p className="text-2xl font-bold text-green-400">{normalCount}</p>
            <p className="text-sm text-slate-400">正常事件</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-yellow-500/10">
            <ExclamationTriangleIcon className="w-6 h-6 text-yellow-500" />
          </div>
          <div>
            <p className="text-2xl font-bold text-yellow-400">{warningCount}</p>
            <p className="text-sm text-slate-400">警告事件</p>
          </div>
        </div>
      </div>

      {/* 事件列表 */}
      <div className="card overflow-hidden">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>类型</th>
                <th>原因</th>
                <th>对象</th>
                {currentNamespace === 'all' && <th>命名空间</th>}
                <th>消息</th>
                <th>次数</th>
                <th>时间</th>
              </tr>
            </thead>
            <tbody>
              {sortedEvents.map((event) => (
                <tr key={event.metadata.uid}>
                  <td>
                    <span
                      className={clsx(
                        'badge',
                        event.type === 'Warning' ? 'badge-warning' : 'badge-success'
                      )}
                    >
                      {event.type}
                    </span>
                  </td>
                  <td className="font-medium text-slate-300">{event.reason || '-'}</td>
                  <td className="text-blue-400">{getInvolvedObject(event)}</td>
                  {currentNamespace === 'all' && (
                    <td>
                      <span className="badge badge-default">
                        {event.involvedObject?.namespace || '-'}
                      </span>
                    </td>
                  )}
                  <td className="text-slate-400 max-w-md">
                    <p className="truncate" title={event.message || ''}>
                      {event.message || '-'}
                    </p>
                  </td>
                  <td className="text-slate-400">{event.count || 1}</td>
                  <td className="text-slate-400 whitespace-nowrap">
                    {getEventTime(event)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {events.length === 0 && (
          <div className="text-center py-12 text-slate-400">没有找到事件</div>
        )}
      </div>
    </div>
  );
}
