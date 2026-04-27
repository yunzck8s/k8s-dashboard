import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { nodeApi, podApi } from '../../api';
import { usePollingInterval } from '../../utils/polling';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import type { Node } from '../../types';
import type { NodeMetricSummary } from '../../types/api';
import Pagination from '../../components/common/Pagination';

// ─── hooks ────────────────────────────────────────────────────────────────────

function useMountAnimation(delayMs = 100) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), delayMs);
    return () => clearTimeout(t);
  }, [delayMs]);
  return mounted;
}

// ─── MiniBar ──────────────────────────────────────────────────────────────────

function MiniBar({
  used,
  total,
  label,
  color,
  delay = 0,
  unavailable = false,
}: {
  used: number;
  total: number;
  label: string;
  color: string;
  delay?: number;
  unavailable?: boolean;
}) {
  const mounted = useMountAnimation(120 + delay);
  const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0;
  const barColor = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : color;
  const glowColor = pct >= 90 ? '#ef444460' : pct >= 70 ? '#f59e0b60' : `${color}60`;

  if (unavailable) {
    return (
      <div className="min-w-[110px]">
        <span className="text-[11px] text-slate-600">指标不可用</span>
      </div>
    );
  }

  return (
    <div className="min-w-[110px]">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="truncate text-[11px] text-slate-500">{label}</span>
        <span className="font-mono text-[11px] text-slate-300">{pct.toFixed(0)}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full"
          style={{
            width: `${mounted ? pct : 0}%`,
            backgroundColor: barColor,
            boxShadow: mounted && pct > 0 ? `0 0 6px ${glowColor}` : 'none',
            transition: `width 0.85s cubic-bezier(0.4,0,0.2,1) ${delay}ms`,
          }}
        />
      </div>
    </div>
  );
}

// ─── StatTile ─────────────────────────────────────────────────────────────────

function StatTile({
  label,
  value,
  accent = 'slate',
  pulse = false,
}: {
  label: string;
  value: number | string;
  accent?: 'slate' | 'emerald' | 'rose' | 'blue';
  pulse?: boolean;
}) {
  const colors: Record<typeof accent, { num: string; dot: string }> = {
    slate:   { num: 'text-slate-100',   dot: 'bg-slate-400' },
    emerald: { num: 'text-emerald-300', dot: 'bg-emerald-400' },
    rose:    { num: 'text-rose-300',    dot: 'bg-rose-400' },
    blue:    { num: 'text-blue-300',    dot: 'bg-blue-400' },
  };
  const c = colors[accent];

  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-700/70 bg-slate-900/60 px-4 py-3 transition-colors duration-200 hover:border-slate-600/70">
      {pulse ? (
        <span className="relative flex h-2 w-2 shrink-0">
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-70 ${c.dot}`} />
          <span className={`relative inline-flex h-2 w-2 rounded-full ${c.dot}`} />
        </span>
      ) : (
        <span className={`h-2 w-2 shrink-0 rounded-full ${c.dot}`} />
      )}
      <div>
        <div className={`font-mono text-xl font-semibold ${c.num}`}>{value}</div>
        <div className="text-xs text-slate-500">{label}</div>
      </div>
    </div>
  );
}

// ─── NodeRow ──────────────────────────────────────────────────────────────────

function NodeRow({
  node,
  podCount,
  metrics,
  index,
}: {
  node: Node;
  podCount: number;
  metrics: NodeMetricSummary | null;
  index: number;
}) {
  const isReady = node.status.conditions?.some((c) => c.type === 'Ready' && c.status === 'True') ?? false;
  const isUnschedulable = node.spec.unschedulable;
  const podCapacity = parseInt(node.status.allocatable?.pods ?? '110');

  const labels = node.metadata.labels ?? {};
  const isControlPlane =
    labels['node-role.kubernetes.io/control-plane'] !== undefined ||
    labels['node-role.kubernetes.io/master'] !== undefined;

  const cpuUsed = metrics?.cpu.usage ?? 0;
  const cpuCapacity = metrics?.cpu.capacity ?? 0;
  const memUsed = metrics?.memory.usage ?? 0;
  const memCapacity = metrics?.memory.capacity ?? 0;
  const metricsAvailable = metrics !== null && cpuCapacity > 0;

  const cpuLabel = metricsAvailable
    ? `${(cpuUsed / 1000).toFixed(1)} / ${(cpuCapacity / 1000).toFixed(0)} cores`
    : '指标不可用';
  const memLabel = metricsAvailable
    ? `${(memUsed / 1024 ** 3).toFixed(1)} / ${(memCapacity / 1024 ** 3).toFixed(0)} Gi`
    : '指标不可用';

  return (
    <tr
      className="group cursor-default border-b border-slate-800/60 transition-colors duration-100 hover:bg-slate-800/50"
      style={{ animationDelay: `${index * 30}ms` }}
    >
      {/* 名称 */}
      <td className="py-3 pl-4 pr-3">
        <Link
          to={`/nodes/${node.metadata.name}`}
          className="font-medium text-blue-400 transition-colors duration-150 hover:text-blue-300"
        >
          {node.metadata.name}
        </Link>
      </td>

      {/* 状态 */}
      <td className="px-3 py-3">
        <div className="flex items-center gap-2">
          {isReady ? (
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
          ) : (
            <span className="h-2 w-2 shrink-0 rounded-full bg-rose-400" />
          )}
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
              isReady ? 'bg-emerald-400/10 text-emerald-300' : 'bg-rose-400/10 text-rose-300'
            }`}
          >
            {isReady ? 'Ready' : 'NotReady'}
          </span>
          {isUnschedulable && (
            <span className="rounded-full bg-amber-400/10 px-2 py-0.5 text-[11px] text-amber-300">
              Cordoned
            </span>
          )}
        </div>
      </td>

      {/* 角色 */}
      <td className="px-3 py-3">
        <span
          className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ${
            isControlPlane
              ? 'bg-blue-500/10 text-blue-300 ring-blue-400/30'
              : 'bg-slate-700/50 text-slate-400 ring-slate-600/40'
          }`}
        >
          {isControlPlane ? 'control-plane' : 'worker'}
        </span>
      </td>

      {/* CPU */}
      <td className="px-3 py-3">
        <MiniBar used={cpuUsed} total={cpuCapacity} label={cpuLabel} color="#3b82f6" delay={index * 20} unavailable={!metricsAvailable} />
      </td>

      {/* 内存 */}
      <td className="px-3 py-3">
        <MiniBar used={memUsed} total={memCapacity} label={memLabel} color="#a855f7" delay={index * 20 + 40} unavailable={!metricsAvailable} />
      </td>

      {/* Pods */}
      <td className="px-3 py-3">
        <div className="flex items-baseline gap-1">
          <span className="font-mono text-sm font-semibold text-slate-100">{podCount}</span>
          <span className="text-xs text-slate-600">/</span>
          <span className="font-mono text-xs text-slate-500">{podCapacity}</span>
        </div>
      </td>

      {/* 版本 */}
      <td className="px-3 py-3">
        <span className="font-mono text-xs text-slate-500">
          {node.status.nodeInfo?.kubeletVersion ?? '-'}
        </span>
      </td>

      {/* 时间 */}
      <td className="py-3 pl-3 pr-4 text-xs text-slate-500">
        {formatDistanceToNow(new Date(node.metadata.creationTimestamp), { addSuffix: true, locale: zhCN })}
      </td>
    </tr>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function NodesSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="h-8 w-32 rounded-lg skeleton" />
        <div className="h-9 w-16 rounded-lg skeleton" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 rounded-xl skeleton" />
        ))}
      </div>
      <div className="h-64 rounded-xl skeleton" />
    </div>
  );
}

// ─── Nodes ────────────────────────────────────────────────────────────────────

export default function Nodes() {
  const pollingInterval = usePollingInterval('standard');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const { data, isLoading, isRefetching, error, refetch } = useQuery({
    queryKey: ['nodes'],
    queryFn: () => nodeApi.list(),
    refetchInterval: pollingInterval,
  });

  // 真实 Metrics Server 用量（对应 kubectl top nodes）
  const { data: nodeMetricsData } = useQuery({
    queryKey: ['nodes-metrics'],
    queryFn: () => nodeApi.listMetrics(),
    refetchInterval: pollingInterval,
    retry: false,
  });

  const { data: podsData } = useQuery({
    queryKey: ['pods-all'],
    queryFn: () => podApi.listAll(),
    refetchInterval: pollingInterval,
  });

  const metricsMap = new Map<string, NodeMetricSummary>(
    (nodeMetricsData?.items ?? []).map((m) => [m.name, m])
  );

  const getNodePodCount = (nodeName: string) => {
    if (!podsData?.items) return 0;
    return podsData.items.filter((p) => p.spec.nodeName === nodeName && p.status.phase === 'Running').length;
  };

  if (isLoading) return <NodesSkeleton />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-rose-400/20 bg-rose-400/5 py-16 text-center">
        <p className="text-rose-300">加载失败：{(error as Error).message}</p>
        <button onClick={() => refetch()} className="btn btn-secondary btn-sm">重试</button>
      </div>
    );
  }

  const nodes = data?.items ?? [];
  const readyCount = nodes.filter((n) =>
    n.status.conditions?.some((c) => c.type === 'Ready' && c.status === 'True')
  ).length;
  const totalPods = podsData?.items.filter((p) => p.status.phase === 'Running').length ?? 0;

  const totalPages = Math.ceil(nodes.length / pageSize);
  const currentNodes = nodes.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-5 text-slate-100">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">节点</h1>
          <p className="mt-0.5 text-xs text-slate-500">集群节点资源与健康状态</p>
        </div>
        <button
          onClick={() => refetch()}
          className="btn btn-secondary btn-sm flex items-center gap-2"
        >
          <ArrowPathIcon className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
          刷新
        </button>
      </div>

      {/* 汇总统计 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="节点总数" value={nodes.length} accent="slate" />
        <StatTile label="健康节点" value={readyCount} accent="emerald" pulse />
        <StatTile label="异常节点" value={nodes.length - readyCount} accent={nodes.length - readyCount > 0 ? 'rose' : 'slate'} />
        <StatTile label="运行中 Pods" value={totalPods} accent="blue" />
      </div>

      {/* 节点表格 */}
      <div className="overflow-hidden rounded-xl border border-slate-700/80 bg-slate-900/65">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60">
                <th className="py-3 pl-4 pr-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">名称</th>
                <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">状态</th>
                <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">角色</th>
                <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">CPU 用量</th>
                <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">内存用量</th>
                <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Pods</th>
                <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">版本</th>
                <th className="py-3 pl-3 pr-4 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">时间</th>
              </tr>
            </thead>
            <tbody>
              {currentNodes.map((node, index) => (
                  <NodeRow
                    key={node.metadata.uid}
                    node={node}
                    podCount={getNodePodCount(node.metadata.name)}
                    metrics={metricsMap.get(node.metadata.name) ?? null}
                    index={index}
                  />
              ))}
            </tbody>
          </table>
        </div>

        {nodes.length === 0 && (
          <div className="py-16 text-center text-sm text-slate-500">没有找到节点</div>
        )}
      </div>

      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={nodes.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
        />
      )}
    </div>
  );
}
