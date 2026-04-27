import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { podApi } from '../../../api';
import { useAppStore } from '../../../store';
import { usePollingInterval } from '../../../utils/polling';
import { queryKeys } from '../../../api/queryKeys';
import { createVisibilityRefetchInterval } from '../../../api/queryPolicy';
import { useNamespacePagination } from '../../../hooks/useNamespacePagination';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import Pagination from '../../../components/common/Pagination';
import type { Pod, PodPhase } from '../../../types';

// ─── helpers ──────────────────────────────────────────────────────────────────

function useMountAnimation(delayMs = 100) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), delayMs);
    return () => clearTimeout(t);
  }, [delayMs]);
  return mounted;
}

function getPodEffectiveStatus(pod: Pod): { label: string; phase: PodPhase } {
  const phase = pod.status.phase;
  const containerStatuses = pod.status.containerStatuses ?? [];
  for (const cs of containerStatuses) {
    if (cs.state.waiting?.reason) return { label: cs.state.waiting.reason, phase };
    if (cs.state.terminated?.reason) return { label: cs.state.terminated.reason, phase };
  }
  return { label: phase, phase };
}

function getReadyContainers(pod: Pod): { ready: number; total: number } {
  const cs = pod.status.containerStatuses ?? [];
  return { ready: cs.filter((c) => c.ready).length, total: cs.length };
}

function getRestartCount(pod: Pod): number {
  return (pod.status.containerStatuses ?? []).reduce((s, c) => s + c.restartCount, 0);
}

function parseCpu(v: string): number {
  return v.endsWith('m') ? parseInt(v) : parseFloat(v) * 1000;
}
function parseMemory(v: string): number {
  const units: Record<string, number> = { Ki: 1024, Mi: 1024 ** 2, Gi: 1024 ** 3, Ti: 1024 ** 4, K: 1e3, M: 1e6, G: 1e9, T: 1e12 };
  for (const [u, m] of Object.entries(units)) if (v.endsWith(u)) return parseFloat(v) * m;
  return parseFloat(v);
}
function formatCpu(mc: number): string {
  return mc >= 1000 ? `${(mc / 1000).toFixed(1)}` : `${mc}m`;
}
function formatCpuUsage(cores: number): string {
  const mc = cores * 1000;
  return mc >= 1000 ? `${(mc / 1000).toFixed(2)}` : `${Math.round(mc)}m`;
}
function formatMemory(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)}Gi`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(0)}Mi`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)}Ki`;
  return `${bytes}B`;
}

function getPodResources(pod: Pod) {
  let cpuReq = 0, cpuLim = 0, memReq = 0, memLim = 0;
  for (const c of pod.spec.containers ?? []) {
    const r = c.resources ?? {};
    if (r.requests?.cpu) cpuReq += parseCpu(r.requests.cpu);
    if (r.limits?.cpu) cpuLim += parseCpu(r.limits.cpu);
    if (r.requests?.memory) memReq += parseMemory(r.requests.memory);
    if (r.limits?.memory) memLim += parseMemory(r.limits.memory);
  }
  return {
    cpuRequest: cpuReq > 0 ? formatCpu(cpuReq) : null,
    cpuLimit: cpuLim > 0 ? formatCpu(cpuLim) : null,
    memRequest: memReq > 0 ? formatMemory(memReq) : null,
    memLimit: memLim > 0 ? formatMemory(memLim) : null,
  };
}

// ─── sub-components ───────────────────────────────────────────────────────────

function PodsSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="h-8 w-24 rounded-lg skeleton" />
        <div className="h-9 w-16 rounded-lg skeleton" />
      </div>
      <div className="h-96 rounded-xl skeleton" />
    </div>
  );
}

const phaseStyle: Record<string, { bg: string; text: string; ring: string }> = {
  Running:   { bg: 'bg-emerald-400/10', text: 'text-emerald-300', ring: 'ring-emerald-400/25' },
  Pending:   { bg: 'bg-amber-400/10',   text: 'text-amber-300',   ring: 'ring-amber-400/25' },
  Succeeded: { bg: 'bg-blue-400/10',    text: 'text-blue-300',    ring: 'ring-blue-400/25' },
  Failed:    { bg: 'bg-rose-400/10',    text: 'text-rose-300',    ring: 'ring-rose-400/25' },
  Unknown:   { bg: 'bg-slate-700/50',   text: 'text-slate-400',   ring: 'ring-slate-600/40' },
};

function PodStatusBadge({ pod }: { pod: Pod }) {
  const { label, phase } = getPodEffectiveStatus(pod);
  const cs = pod.status.containerStatuses ?? [];
  const allReady = cs.length > 0 && cs.every((c) => c.ready);
  const effectivePhase = phase === 'Running' && !allReady ? 'Pending' : phase;
  const s = phaseStyle[effectivePhase] ?? phaseStyle.Unknown;

  return (
    <div className="flex items-center gap-1.5">
      {effectivePhase === 'Running' && allReady ? (
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
        </span>
      ) : (
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${s.text.replace('text-', 'bg-')}`} />
      )}
      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${s.bg} ${s.text} ${s.ring}`}>
        {label}
      </span>
    </div>
  );
}

function ResourceCell({
  usage,
  request,
  limit,
  delay = 0,
}: {
  usage: string | null;
  request: string | null;
  limit: string | null;
  delay?: number;
}) {
  const mounted = useMountAnimation(150 + delay);
  return (
    <div className="flex flex-col gap-0.5">
      <span
        className="font-mono text-xs font-semibold text-emerald-400 transition-opacity duration-500"
        style={{ opacity: mounted ? 1 : 0 }}
      >
        {usage ?? '-'}
      </span>
      {(request || limit) && (
        <span className="text-[10px] text-slate-600">
          {request && <span className="text-blue-400/70">{request}</span>}
          {request && limit && <span> / </span>}
          {limit && <span className="text-amber-400/70">{limit}</span>}
        </span>
      )}
    </div>
  );
}

function PodRow({
  pod,
  showNamespace,
  metrics,
  index,
}: {
  pod: Pod;
  showNamespace: boolean;
  metrics: { cpuUsage: number; memoryUsage: number } | undefined;
  index: number;
}) {
  const { ready, total } = getReadyContainers(pod);
  const restarts = getRestartCount(pod);
  const resources = getPodResources(pod);

  return (
    <tr className="group border-b border-slate-800/60 transition-colors duration-100 hover:bg-slate-800/50">
      <td className="py-3 pl-4 pr-3">
        <Link
          to={`/workloads/pods/${pod.metadata.namespace}/${pod.metadata.name}`}
          className="font-medium text-blue-400 transition-colors duration-150 hover:text-blue-300"
        >
          {pod.metadata.name}
        </Link>
      </td>
      {showNamespace && (
        <td className="px-3 py-3">
          <span className="rounded-full bg-slate-700/50 px-2 py-0.5 text-[11px] text-slate-400 ring-1 ring-slate-600/40">
            {pod.metadata.namespace}
          </span>
        </td>
      )}
      <td className="px-3 py-3">
        <PodStatusBadge pod={pod} />
      </td>
      <td className="px-3 py-3">
        <span className={`font-mono text-xs ${ready === total && total > 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
          {ready}/{total}
        </span>
      </td>
      <td className="px-3 py-3">
        <span className={`font-mono text-xs ${restarts > 5 ? 'text-rose-400' : restarts > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
          {restarts}
        </span>
      </td>
      <td className="px-3 py-3">
        <ResourceCell
          usage={metrics ? formatCpuUsage(metrics.cpuUsage) : null}
          request={resources.cpuRequest}
          limit={resources.cpuLimit}
          delay={index * 20}
        />
      </td>
      <td className="px-3 py-3">
        <ResourceCell
          usage={metrics ? formatMemory(metrics.memoryUsage) : null}
          request={resources.memRequest}
          limit={resources.memLimit}
          delay={index * 20 + 40}
        />
      </td>
      <td className="px-3 py-3">
        <span className="font-mono text-[11px] text-slate-500">{pod.spec.nodeName || '-'}</span>
      </td>
      <td className="py-3 pl-3 pr-4 text-xs text-slate-500">
        {formatDistanceToNow(new Date(pod.metadata.creationTimestamp), { addSuffix: true, locale: zhCN })}
      </td>
    </tr>
  );
}

// ─── main ─────────────────────────────────────────────────────────────────────

export default function Pods() {
  const { currentNamespace } = useAppStore();
  const pollingInterval = usePollingInterval('standard');
  const refetchInterval = createVisibilityRefetchInterval(pollingInterval);
  const { currentPage, pageSize, setCurrentPage, setPageSize } = useNamespacePagination(currentNamespace);

  const { data, isLoading, isRefetching, error, refetch } = useQuery({
    queryKey: queryKeys.pods(currentNamespace),
    queryFn: () =>
      currentNamespace === 'all' ? podApi.listAll() : podApi.list(currentNamespace),
    refetchInterval,
  });

  const { data: metricsData } = useQuery({
    queryKey: queryKeys.podsMetrics,
    queryFn: () => podApi.listAllMetrics(),
    refetchInterval,
  });

  const metricsMap = useMemo(() => {
    const map = new Map<string, { cpuUsage: number; memoryUsage: number }>();
    for (const m of metricsData?.items ?? []) {
      map.set(`${m.namespace}/${m.name}`, { cpuUsage: m.cpuUsage, memoryUsage: m.memoryUsage });
    }
    return map;
  }, [metricsData]);

  const pods = useMemo(() => data?.items ?? [], [data?.items]);
  const totalItems = pods.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const currentPods = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return pods.slice(start, start + pageSize);
  }, [currentPage, pageSize, pods]);

  if (isLoading) return <PodsSkeleton />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-rose-400/20 bg-rose-400/5 py-16 text-center">
        <p className="text-rose-300">加载失败：{(error as Error).message}</p>
        <button onClick={() => refetch()} className="btn btn-secondary btn-sm">重试</button>
      </div>
    );
  }

  const runningCount = pods.filter((p) => p.status.phase === 'Running').length;
  const failedCount = pods.filter((p) => p.status.phase === 'Failed').length;

  return (
    <div className="space-y-5 text-slate-100">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Pods</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            <span className="text-emerald-400">{runningCount}</span> 运行中
            {failedCount > 0 && <> · <span className="text-rose-400">{failedCount}</span> 失败</>}
            {' '}· 共 {totalItems}
            {currentNamespace !== 'all' && (
              <> · <span className="text-slate-400">{currentNamespace}</span></>
            )}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="btn btn-secondary btn-sm flex items-center gap-2"
        >
          <ArrowPathIcon className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
          刷新
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-700/80 bg-slate-900/65">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60">
                <th className="py-3 pl-4 pr-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">名称</th>
                {currentNamespace === 'all' && (
                  <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">命名空间</th>
                )}
                <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">状态</th>
                <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Ready</th>
                <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">重启</th>
                <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">CPU 使用</th>
                <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">内存使用</th>
                <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">节点</th>
                <th className="py-3 pl-3 pr-4 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">时间</th>
              </tr>
            </thead>
            <tbody>
              {currentPods.map((pod, i) => (
                <PodRow
                  key={pod.metadata.uid}
                  pod={pod}
                  showNamespace={currentNamespace === 'all'}
                  metrics={metricsMap.get(`${pod.metadata.namespace}/${pod.metadata.name}`)}
                  index={i}
                />
              ))}
            </tbody>
          </table>
        </div>
        {pods.length === 0 && (
          <div className="py-16 text-center text-sm text-slate-500">没有找到 Pod</div>
        )}
      </div>

      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={(p) => { setCurrentPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
          pageSizeOptions={[10, 20, 50, 100]}
        />
      )}
    </div>
  );
}
