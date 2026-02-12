import type { ComponentType, CSSProperties } from 'react';
import type { AlertSummary, ClusterOverview } from '../../types/api';

export type AlertSeverityFilter = 'critical' | 'warning' | 'info' | null;
export type EventTypeFilter = 'Normal' | 'Warning' | null;

export interface QuickActionLink {
  name: string;
  path: string;
  description: string;
  icon: ComponentType<{ className?: string; style?: CSSProperties }>;
  iconClassName: string;
}

export interface ExecutiveSummaryProps {
  overview: ClusterOverview;
  alertSummary?: AlertSummary;
  healthScore: number;
  updatedTimeLabel: string;
  onRefresh: () => void;
}

export interface RiskFocusPanelProps {
  overview: ClusterOverview;
  alertSummary?: AlertSummary;
  alertFilter: AlertSeverityFilter;
  eventFilter: EventTypeFilter;
  onAlertFilterChange: (filter: AlertSeverityFilter) => void;
  onEventFilterChange: (filter: EventTypeFilter) => void;
}

export interface OpsDetailGridProps {
  overview: ClusterOverview;
  alertSummary?: AlertSummary;
}
