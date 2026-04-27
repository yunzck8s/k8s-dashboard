import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { nodeApi } from '../../api';
import { usePollingInterval } from '../../utils/polling';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import clsx from 'clsx';
import type { Node, NodeMetrics, Pod } from '../../types';
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  ClipboardDocumentIcon,
  ShieldExclamationIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';

type TabType = 'overview' | 'pods' | 'yaml' | 'metrics';

// ─── useMountAnimation ────────────────────────────────────────────────────────

function useMountAnimation(delayMs = 80) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), delayMs);
    return () => clearTimeout(t);
  }, [delayMs]);
  return mounted;
}

// ─── GaugeRing ────────────────────────────────────────────────────────────────

function GaugeRing({
  pct,
  label,
  sublabel,
  color,
}: {
  pct: number;
  label: string;
  sublabel: string;
  color: string;
}) {
  const mounted = useMountAnimation(150);
  const radius = 40;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (Math.min(pct, 100) / 100) * circ;
  const ringColor = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : color;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative grid h-28 w-28 place-items-center">
        <svg viewBox="0 0 96 96" className="h-28 w-28 -rotate-90">
          <circle cx="48" cy="48" r={radius} fill="none" stroke="rgba(30,41,59,.95)" strokeWidth="8" />
          <circle
            cx="48"
            cy="48"
            r={radius}
            fill="none"
            stroke={ringColor}
            strokeDasharray={circ}
            strokeDashoffset={mounted ? offset : circ}
            strokeLinecap="round"
            strokeWidth="8"
            style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1), stroke 0.3s' }}
          />
        </svg>
        <div className="absolute text-center">
          <div className="font-mono text-2xl font-semibold text-white">{pct.toFixed(0)}<span className="text-sm text-slate-400">%</span></div>
        </div>
      </div>
      <div className="text-center">
        <div className="text-sm font-medium text-slate-200">{label}</div>
        <div className="mt-0.5 font-mono text-xs text-slate-500">{sublabel}</div>
      </div>
    </div>
  );
}

// ─── InfoRow ──────────────────────────────────────────────────────────────────

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-800/60 py-2.5 last:border-0">
      <dt className="shrink-0 text-xs text-slate-500">{label}</dt>
      <dd className={clsx('text-right text-xs text-slate-200 break-all', mono && 'font-mono')}>{value}</dd>
    </div>
  );
}

// ─── SectionCard ──────────────────────────────────────────────────────────────

function SectionCard({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-slate-700/80 bg-slate-900/65 p-5 transition-colors duration-200 hover:border-slate-700/50 ${className}`}>
      <h3 className="mb-3 text-sm font-semibold text-slate-300">{title}</h3>
      {children}
    </div>
  );
}

// ─── NodeDetail ───────────────────────────────────────────────────────────────

export default function NodeDetail() {
  const { name } = useParams<{ name: string }>();
  const pollingInterval = usePollingInterval('standard');
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const queryClient = useQueryClient();

  const { data: node, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['node', name],
    queryFn: () => nodeApi.get(name!),
    enabled: !!name,
  });

  const { data: yamlData } = useQuery({
    queryKey: ['node-yaml', name],
    queryFn: () => nodeApi.getYaml(name!),
    enabled: !!name && activeTab === 'yaml',
  });

  const { data: podsData } = useQuery({
    queryKey: ['node-pods', name],
    queryFn: () => nodeApi.getPods(name!),
    enabled: !!name && activeTab === 'pods',
  });

  const { data: metricsData } = useQuery({
    queryKey: ['node-metrics', name],
    queryFn: () => nodeApi.getMetrics(name!),
    enabled: !!name && activeTab === 'metrics',
    refetchInterval: pollingInterval,
  });

  const cordonMutation = useMutation({
    mutationFn: () => nodeApi.cordon(name!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['node', name] }),
  });

  const uncordonMutation = useMutation({
    mutationFn: () => nodeApi.uncordon(name!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['node', name] }),
  });

  const drainMutation = useMutation({
    mutationFn: () => nodeApi.drain(name!, { force: true, gracePeriod: 30 }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['node', name] }),
  });

  if (isLoading) {
    return (
      <div className="space-y-5 text-slate-100">
        <div className="flex items-center gap-4">
          <div className="h-9 w-9 rounded-lg skeleton" />
          <div className="h-8 w-48 rounded-lg skeleton" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-40 rounded-xl skeleton" />)}
        </div>
      </div>
    );
  }

  if (error || !node) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-rose-400/20 bg-rose-400/5 py-16 text-center">
        <p className="text-rose-300">加载失败：{(error as Error)?.message ?? '节点不存在'}</p>
        <button onClick={() => refetch()} className="btn btn-secondary btn-sm">重试</button>
      </div>
    );
  }

  const tabs: { id: TabType; label: string }[] = [
    { id: 'overview', label: '概览' },
    { id: 'pods', label: 'Pods' },
    { id: 'metrics', label: '指标' },
    { id: 'yaml', label: 'YAML' },
  ];

  const isReady = node.status.conditions?.some((c) => c.type === 'Ready' && c.status === 'True');
  const isUnschedulable = node.spec.unschedulable;

  return (
    <div className="space-y-5 text-slate-100">
      {/* 头部 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Link to="/nodes" className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-700/80 bg-slate-900/60 text-slate-400 transition-colors hover:border-slate-600/80 hover:text-slate-200">
            <ArrowLeftIcon className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-slate-100">{name}</h1>
              {/* 状态点 */}
              {isReady ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                  </span>
                  <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-xs text-emerald-300">Ready</span>
                </>
              ) : (
                <>
                  <span className="h-2 w-2 rounded-full bg-rose-400" />
                  <span className="rounded-full bg-rose-400/10 px-2 py-0.5 text-xs text-rose-300">NotReady</span>
                </>
              )}
              {isUnschedulable && (
                <span className="rounded-full bg-amber-400/10 px-2 py-0.5 text-xs text-amber-300">Cordoned</span>
              )}
            </div>
            <p className="mt-1 font-mono text-xs text-slate-500">
              {node.status.nodeInfo?.kubeletVersion} · {node.status.nodeInfo?.osImage}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => refetch()}
            className="btn btn-secondary btn-sm flex items-center gap-2"
          >
            <ArrowPathIcon className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
            刷新
          </button>
          {isUnschedulable ? (
            <button
              onClick={() => uncordonMutation.mutate()}
              className="btn btn-primary btn-sm flex items-center gap-2"
              disabled={uncordonMutation.isPending}
            >
              <ShieldCheckIcon className="h-4 w-4" />
              Uncordon
            </button>
          ) : (
            <button
              onClick={() => cordonMutation.mutate()}
              className="btn btn-warning btn-sm flex items-center gap-2"
              disabled={cordonMutation.isPending}
            >
              <ShieldExclamationIcon className="h-4 w-4" />
              Cordon
            </button>
          )}
          <button
            onClick={() => {
              if (confirm('确定要驱逐此节点上的所有 Pod 吗？此操作不可逆！')) {
                drainMutation.mutate();
              }
            }}
            className="btn btn-danger btn-sm"
            disabled={drainMutation.isPending}
          >
            Drain
          </button>
        </div>
      </div>

      {/* Tab 导航 */}
      <div className="flex gap-1 rounded-xl border border-slate-700/80 bg-slate-900/60 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-150',
              activeTab === tab.id
                ? 'bg-slate-800 text-slate-100 shadow-sm'
                : 'text-slate-500 hover:text-slate-300'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 内容 */}
      {activeTab === 'overview' && <OverviewTab node={node} />}
      {activeTab === 'pods' && <PodsTab pods={podsData?.items ?? []} />}
      {activeTab === 'metrics' && <MetricsTab metrics={metricsData} />}
      {activeTab === 'yaml' && <YamlTab yaml={yamlData ?? ''} />}
    </div>
  );
}

// ─── OverviewTab ──────────────────────────────────────────────────────────────

function OverviewTab({ node }: { node: Node }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <SectionCard title="基本信息">
        <dl>
          <InfoRow label="名称" value={node.metadata.name} />
          <InfoRow label="UID" value={node.metadata.uid} mono />
          <InfoRow
            label="创建时间"
            value={formatDistanceToNow(new Date(node.metadata.creationTimestamp), { addSuffix: true, locale: zhCN })}
          />
          <InfoRow label="Pod CIDR" value={node.spec.podCIDR ?? '-'} />
          <InfoRow label="Provider ID" value={node.spec.providerID ?? '-'} mono />
        </dl>
      </SectionCard>

      <SectionCard title="系统信息">
        <dl>
          <InfoRow label="操作系统" value={node.status.nodeInfo?.osImage ?? '-'} />
          <InfoRow label="内核版本" value={node.status.nodeInfo?.kernelVersion ?? '-'} mono />
          <InfoRow label="容器运行时" value={node.status.nodeInfo?.containerRuntimeVersion ?? '-'} mono />
          <InfoRow label="Kubelet 版本" value={node.status.nodeInfo?.kubeletVersion ?? '-'} mono />
          <InfoRow label="Kube-Proxy" value={node.status.nodeInfo?.kubeProxyVersion ?? '-'} mono />
          <InfoRow label="架构" value={node.status.nodeInfo?.architecture ?? '-'} />
        </dl>
      </SectionCard>

      <SectionCard title="地址">
        <dl>
          {node.status.addresses?.map((addr) => (
            <InfoRow key={addr.type} label={addr.type} value={addr.address} mono />
          ))}
        </dl>
      </SectionCard>

      <SectionCard title="资源">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="mb-2 text-[11px] uppercase tracking-wider text-slate-500">容量</p>
            <dl>
              <InfoRow label="CPU" value={node.status.capacity?.cpu ?? '-'} />
              <InfoRow label="内存" value={formatMemory(node.status.capacity?.memory)} />
              <InfoRow label="存储" value={formatMemory(node.status.capacity?.['ephemeral-storage'])} />
              <InfoRow label="Pods" value={node.status.capacity?.pods ?? '-'} />
            </dl>
          </div>
          <div>
            <p className="mb-2 text-[11px] uppercase tracking-wider text-slate-500">可分配</p>
            <dl>
              <InfoRow label="CPU" value={node.status.allocatable?.cpu ?? '-'} />
              <InfoRow label="内存" value={formatMemory(node.status.allocatable?.memory)} />
              <InfoRow label="存储" value={formatMemory(node.status.allocatable?.['ephemeral-storage'])} />
              <InfoRow label="Pods" value={node.status.allocatable?.pods ?? '-'} />
            </dl>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="标签">
        <div className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto">
          {Object.entries(node.metadata.labels ?? {}).map(([key, value]) => (
            <span key={key} className="rounded-md bg-slate-800/80 px-2 py-0.5 font-mono text-[11px] text-slate-400">
              {key}={value}
            </span>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="污点 (Taints)">
        {(node.spec.taints?.length ?? 0) > 0 ? (
          <div className="flex flex-wrap gap-2">
            {node.spec.taints?.map((taint, idx) => (
              <span key={idx} className="rounded-md bg-amber-400/10 px-2 py-0.5 font-mono text-[11px] text-amber-300 ring-1 ring-amber-400/20">
                {taint.key}={taint.value ?? ''}:{taint.effect}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500">无污点</p>
        )}
      </SectionCard>

      {/* 条件状态 全宽 */}
      <SectionCard title="条件状态" className="lg:col-span-2">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                {['类型', '状态', '原因', '消息', '最后心跳'].map((h) => (
                  <th key={h} className="pb-2 pr-4 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 last:pr-0">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {node.status.conditions?.map((condition) => (
                <tr key={condition.type} className="border-b border-slate-800/50 transition-colors hover:bg-slate-800/30">
                  <td className="py-2.5 pr-4 text-xs text-slate-300">{condition.type}</td>
                  <td className="py-2.5 pr-4">
                    <span
                      className={clsx(
                        'rounded-full px-2 py-0.5 text-[11px]',
                        condition.type === 'Ready'
                          ? condition.status === 'True'
                            ? 'bg-emerald-400/10 text-emerald-300'
                            : 'bg-rose-400/10 text-rose-300'
                          : condition.status === 'False'
                          ? 'bg-emerald-400/10 text-emerald-300'
                          : 'bg-amber-400/10 text-amber-300'
                      )}
                    >
                      {condition.status}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-xs text-slate-500">{condition.reason ?? '-'}</td>
                  <td className="max-w-xs py-2.5 pr-4 text-xs text-slate-500 truncate">{condition.message ?? '-'}</td>
                  <td className="py-2.5 text-xs text-slate-500">
                    {condition.lastHeartbeatTime
                      ? formatDistanceToNow(new Date(condition.lastHeartbeatTime), { addSuffix: true, locale: zhCN })
                      : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

// ─── PodsTab ──────────────────────────────────────────────────────────────────

function PodsTab({ pods }: { pods: Pod[] }) {
  const getPodBadge = (pod: Pod) => {
    const phase = pod.status.phase;
    if (phase === 'Running') {
      const cs = pod.status.containerStatuses ?? [];
      const ready = cs.filter((c) => c.ready).length;
      if (cs.length > 0 && ready < cs.length) return { cls: 'bg-amber-400/10 text-amber-300', label: 'Running' };
      return { cls: 'bg-emerald-400/10 text-emerald-300', label: 'Running' };
    }
    if (phase === 'Succeeded') return { cls: 'bg-blue-400/10 text-blue-300', label: 'Succeeded' };
    if (phase === 'Failed') return { cls: 'bg-rose-400/10 text-rose-300', label: 'Failed' };
    if (phase === 'Pending') return { cls: 'bg-amber-400/10 text-amber-300', label: 'Pending' };
    return { cls: 'bg-slate-700/50 text-slate-400', label: phase ?? 'Unknown' };
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-700/80 bg-slate-900/65">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/60">
              {['名称', '命名空间', '状态', 'Ready', '重启', 'IP', '创建时间'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pods.map((pod) => {
              const ready = pod.status.containerStatuses?.filter((c) => c.ready).length ?? 0;
              const total = pod.status.containerStatuses?.length ?? 0;
              const restarts = pod.status.containerStatuses?.reduce((s, c) => s + c.restartCount, 0) ?? 0;
              const badge = getPodBadge(pod);
              return (
                <tr key={pod.metadata.uid} className="border-b border-slate-800/50 transition-colors hover:bg-slate-800/40">
                  <td className="px-4 py-3">
                    <Link
                      to={`/workloads/pods/${pod.metadata.namespace}/${pod.metadata.name}`}
                      className="text-sm text-blue-400 transition-colors hover:text-blue-300"
                    >
                      {pod.metadata.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-md bg-slate-800/80 px-2 py-0.5 text-[11px] text-slate-400">{pod.metadata.namespace}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] ${badge.cls}`}>{badge.label}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-300">{ready}/{total}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">{restarts}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{pod.status.podIP ?? '-'}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {formatDistanceToNow(new Date(pod.metadata.creationTimestamp), { addSuffix: true, locale: zhCN })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {pods.length === 0 && (
        <div className="py-12 text-center text-sm text-slate-500">此节点上暂无 Pods</div>
      )}
    </div>
  );
}

// ─── MetricsTab ───────────────────────────────────────────────────────────────

function MetricsTab({ metrics }: { metrics?: NodeMetrics }) {
  if (!metrics) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-900/40 py-16 text-sm text-slate-500">
        暂无指标数据
      </div>
    );
  }

  const cpuPct = metrics.cpu?.percentage ?? 0;
  const memPct = metrics.memory?.percentage ?? 0;
  const cpuUsage = metrics.cpu?.usage ?? 0;
  const cpuCap = metrics.cpu?.capacity ?? 1;
  const memUsage = metrics.memory?.usage ?? 0;
  const memCap = metrics.memory?.capacity ?? 1;

  return (
    <div className="flex flex-wrap justify-center gap-12 rounded-xl border border-slate-700/80 bg-slate-900/65 p-8">
      <GaugeRing
        pct={cpuPct}
        label="CPU 使用率"
        sublabel={`${(cpuUsage / 1000).toFixed(2)} / ${(cpuCap / 1000).toFixed(2)} cores`}
        color="#3b82f6"
      />
      <GaugeRing
        pct={memPct}
        label="内存使用率"
        sublabel={`${(memUsage / 1024 ** 3).toFixed(2)} / ${(memCap / 1024 ** 3).toFixed(2)} GB`}
        color="#a855f7"
      />
    </div>
  );
}

// ─── YamlTab ──────────────────────────────────────────────────────────────────

function YamlTab({ yaml }: { yaml: string }) {
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          onClick={() => navigator.clipboard.writeText(yaml)}
          className="btn btn-secondary btn-sm flex items-center gap-2"
        >
          <ClipboardDocumentIcon className="h-4 w-4" />
          复制 YAML
        </button>
      </div>
      <div className="max-h-[600px] overflow-auto rounded-xl border border-slate-700/80 bg-slate-950/60 p-5">
        <pre className="font-mono text-xs leading-relaxed text-slate-300">{yaml || '加载中...'}</pre>
      </div>
    </div>
  );
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatMemory(value?: string): string {
  if (!value) return '-';
  if (value.endsWith('Ki')) {
    const ki = parseInt(value);
    if (ki > 1024 * 1024) return `${(ki / 1024 / 1024).toFixed(1)} Gi`;
    if (ki > 1024) return `${(ki / 1024).toFixed(1)} Mi`;
    return `${ki} Ki`;
  }
  return value;
}
