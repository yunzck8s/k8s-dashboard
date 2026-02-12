import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { overviewApi, alertApi } from '../../api';
import { usePollingInterval } from '../../utils/polling';
import { queryKeys } from '../../api/queryKeys';
import { createVisibilityRefetchInterval } from '../../api/queryPolicy';
import ExecutiveSummary from './components/ExecutiveSummary';
import RiskFocusPanel from './components/RiskFocusPanel';
import OpsDetailGrid from './components/OpsDetailGrid';
import type { AlertSeverityFilter, EventTypeFilter } from './types';

export default function Dashboard() {
  const pollingInterval = usePollingInterval('standard');
  const fastPollingInterval = usePollingInterval('fast');
  const fastRefetchInterval = createVisibilityRefetchInterval(fastPollingInterval);
  const standardRefetchInterval = createVisibilityRefetchInterval(pollingInterval);

  const [alertFilter, setAlertFilter] = useState<AlertSeverityFilter>(null);
  const [eventFilter, setEventFilter] = useState<EventTypeFilter>(null);

  const {
    data: overview,
    isLoading,
    refetch,
    dataUpdatedAt,
  } = useQuery({
    queryKey: queryKeys.overview,
    queryFn: overviewApi.getOverview,
    refetchInterval: fastRefetchInterval,
  });

  const { data: alertSummary } = useQuery({
    queryKey: queryKeys.alertSummary,
    queryFn: alertApi.getSummary,
    refetchInterval: standardRefetchInterval,
  });

  const healthScore = useMemo(() => {
    if (!overview) return 0;
    const nodeHealth = overview.nodes.total > 0 ? (overview.nodes.ready / overview.nodes.total) * 100 : 0;
    const podHealth = overview.pods.total > 0 ? (overview.pods.ready / overview.pods.total) * 100 : 0;
    const deployHealth =
      overview.deployments.total > 0
        ? (overview.deployments.ready / overview.deployments.total) * 100
        : 0;
    return Math.round((nodeHealth + podHealth + deployHealth) / 3);
  }, [overview]);

  const updatedTimeLabel = useMemo(() => {
    if (!dataUpdatedAt) {
      return '--:--:--';
    }
    return new Date(dataUpdatedAt).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }, [dataUpdatedAt]);

  if (isLoading || !overview) {
    return (
      <div className="space-y-6">
        <div className="card rounded-xl p-6">
          <div className="h-6 w-40 rounded skeleton" />
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="h-24 rounded-lg skeleton" />
            <div className="h-24 rounded-lg skeleton" />
            <div className="h-24 rounded-lg skeleton" />
            <div className="h-24 rounded-lg skeleton" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="card rounded-xl p-6">
            <div className="h-5 w-32 rounded skeleton" />
            <div className="mt-4 h-40 rounded-lg skeleton" />
          </div>
          <div className="card rounded-xl p-6">
            <div className="h-5 w-32 rounded skeleton" />
            <div className="mt-4 h-40 rounded-lg skeleton" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ExecutiveSummary
        overview={overview}
        alertSummary={alertSummary}
        healthScore={healthScore}
        updatedTimeLabel={updatedTimeLabel}
        onRefresh={() => {
          void refetch();
        }}
      />

      <RiskFocusPanel
        overview={overview}
        alertSummary={alertSummary}
        alertFilter={alertFilter}
        eventFilter={eventFilter}
        onAlertFilterChange={setAlertFilter}
        onEventFilterChange={setEventFilter}
      />

      <OpsDetailGrid overview={overview} alertSummary={alertSummary} />
    </div>
  );
}
