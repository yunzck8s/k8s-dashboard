import { Suspense, lazy, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { podApi } from '../../../api';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import type { Pod, Event, PodPhase } from '../../../types';
import {
  ArrowLeftIcon,
  TrashIcon,
  ArrowPathIcon,
  ClipboardDocumentIcon,
} from '@heroicons/react/24/outline';

const PodTerminal = lazy(() => import('../../../components/terminal/PodTerminal'));

type TabType = 'overview' | 'containers' | 'logs' | 'terminal' | 'yaml' | 'events';

// ─── log highlighting ─────────────────────────────────────────────────────────

type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'stacktrace' | 'plain';

function detectLevel(line: string): LogLevel {
  // Structured logging (logrus / zap / zerolog)
  if (/level["']?\s*[=:]\s*["']?(fatal|critical|crit|panic)/i.test(line)) return 'fatal';
  if (/level["']?\s*[=:]\s*["']?(error|err\b)/i.test(line)) return 'error';
  if (/level["']?\s*[=:]\s*["']?(warn)/i.test(line)) return 'warn';
  if (/level["']?\s*[=:]\s*["']?(info)/i.test(line)) return 'info';
  if (/level["']?\s*[=:]\s*["']?(debug|dbg|trace|trc)/i.test(line)) return 'debug';
  // Plain-text level keywords
  if (/\b(FATAL|CRITICAL|CRIT|PANIC)\b/.test(line)) return 'fatal';
  if (/\bERR(OR|O)?\b/.test(line)) return 'error';
  if (/\bWARN(ING)?\b/.test(line)) return 'warn';
  if (/\bINFO?\b/.test(line)) return 'info';
  if (/\b(DEBUG|DEBU|TRAC(E)?|DBG)\b/.test(line)) return 'debug';
  // klog / glog prefix (E0101, W0101, I0101, F0101)
  if (/^[EF]\d{4}\s/.test(line.trimStart())) return 'error';
  if (/^W\d{4}\s/.test(line.trimStart())) return 'warn';
  if (/^I\d{4}\s/.test(line.trimStart())) return 'info';
  // Java / Python exception class names (e.g. "SomeException: msg" or "Caused by:")
  if (/^\s*(Caused by:|Suppressed:)\s/.test(line)) return 'error';
  if (/^[\w.$]+Exception[:\s]/.test(line.trimStart())) return 'error';
  if (/^[\w.$]+Error[:\s]/.test(line.trimStart())) return 'error';
  if (/\b(Exception|Traceback|panic:|runtime error)\b/i.test(line)) return 'error';
  // Go panic / goroutine dump
  if (/^goroutine \d+ \[/.test(line.trimStart())) return 'error';
  // Java stack trace continuation lines
  if (/^\s+at [\w.$<>[\]]+/.test(line)) return 'stacktrace';
  if (/^\s+\.\.\. \d+ more/.test(line)) return 'stacktrace';
  // Python traceback frame
  if (/^\s+File ".*", line \d+/.test(line)) return 'stacktrace';
  // HTTP 5xx / 4xx
  if (/["'\s]5\d{2}["'\s]/.test(line)) return 'error';
  if (/["'\s]4\d{2}["'\s]/.test(line)) return 'warn';
  return 'plain';
}

const LOG_ROW_STYLE: Record<LogLevel, React.CSSProperties> = {
  fatal:      { background: 'rgba(120,10,10,0.45)', borderLeft: '3px solid #f87171' },
  error:      { background: 'rgba(80,10,10,0.30)',  borderLeft: '3px solid #ef4444' },
  warn:       { background: 'rgba(80,50,0,0.28)',   borderLeft: '3px solid #d97706' },
  stacktrace: { background: 'rgba(50,5,5,0.18)',    borderLeft: '3px solid #7f1d1d' },
  info:  {},
  debug: {},
  plain: {},
};

const LOG_DEFAULT_COLOR: Record<LogLevel, string> = {
  fatal:      '#fca5a5',
  error:      '#fca5a5',
  warn:       '#fcd34d',
  stacktrace: '#9ca3af', // gray-400 — readable but clearly subordinate
  info:       '#cbd5e1',
  debug:      '#475569',
  plain:      '#94a3b8',
};

interface Tok { text: string; color?: string; bold?: boolean; italic?: boolean }

const LOG_RE =
  /((?:\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?(?:Z|[+-]\d{2}:\d{2})?)|(?:\d{2}\/\w+\/\d{4}:\d{2}:\d{2}:\d{2}))|(\b(?:FATAL|CRITICAL|CRIT|PANIC|ERROR|ERRO|WARN(?:ING)?|INFO?|DEBUG|DEBU|TRAC(?:E)?|DBG)\b)|([a-zA-Z_][\w.-]*=(?:"[^"]*"|'[^']*'|\S+))|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g;

function tokenizeLog(line: string, level: LogLevel): Tok[] {
  const def = LOG_DEFAULT_COLOR[level];
  const out: Tok[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  LOG_RE.lastIndex = 0;
  while ((m = LOG_RE.exec(line)) !== null) {
    if (m.index > last) out.push({ text: line.slice(last, m.index), color: def });
    const [full, ts, kw, kv, str] = m;
    if (ts) {
      out.push({ text: full, color: '#475569' });
    } else if (kw) {
      const u = kw.toUpperCase();
      let color = def;
      if (/FATAL|CRITICAL|CRIT|PANIC/.test(u)) color = '#f87171';
      else if (/ERROR|ERRO/.test(u)) color = '#f87171';
      else if (/WARN/.test(u)) color = '#fbbf24';
      else if (/INFO/.test(u)) color = '#60a5fa';
      else color = '#64748b';
      out.push({ text: full, color, bold: true });
    } else if (kv) {
      const eq = full.indexOf('=');
      out.push({ text: full.slice(0, eq), color: '#7dd3fc' });
      out.push({ text: '=', color: '#475569' });
      out.push({ text: full.slice(eq + 1), color: '#6ee7b7' });
    } else if (str) {
      out.push({ text: full, color: '#86efac' });
    }
    last = m.index + full.length;
  }
  if (last < line.length) out.push({ text: line.slice(last), color: def });
  return out;
}

// ─── yaml highlighting ────────────────────────────────────────────────────────

function tokenizeYamlLine(line: string): Tok[] {
  const out: Tok[] = [];
  const ws = line.match(/^(\s*)/)?.[1] ?? '';
  const rest = line.slice(ws.length);
  if (ws) out.push({ text: ws });
  if (!rest) return out;

  if (/^(---|\.\.\.)\s*$/.test(rest)) { out.push({ text: rest, color: '#64748b' }); return out; }
  if (rest.startsWith('#')) { out.push({ text: rest, color: '#3d5166', italic: true }); return out; }

  let cur = rest;
  if (/^-\s/.test(cur) || cur === '-') {
    const prefix = cur.match(/^(-\s*)/)?.[1] ?? '- ';
    out.push({ text: prefix, color: '#64748b' });
    cur = cur.slice(prefix.length);
  }
  if (!cur) return out;

  const kv = cur.match(/^([^:#\[\]{},\n]+?)\s*(:)(\s.*|$)/s);
  if (kv) {
    const [, key, colon, after] = kv;
    out.push({ text: key.trimEnd(), color: '#93c5fd' });
    out.push({ text: colon, color: '#64748b' });
    if (after.trim()) { out.push({ text: ' ' }); out.push(...yamlValue(after.trimStart())); }
    return out;
  }
  out.push(...yamlValue(cur));
  return out;
}

function yamlValue(text: string): Tok[] {
  if (!text) return [];
  let val = text, trail = '';
  if (!/"/.test(text) && !/'/.test(text)) {
    const ci = text.search(/\s#/);
    if (ci !== -1) { val = text.slice(0, ci); trail = text.slice(ci); }
  }
  const t = val.trim();
  const out: Tok[] = [];
  if (/^[|>][-+]?\d*\s*$/.test(t)) out.push({ text: val, color: '#fb923c' });
  else if (/^(null|~|Null|NULL)$/.test(t)) out.push({ text: val, color: '#f87171' });
  else if (/^(true|false|yes|no|on|off)$/i.test(t)) out.push({ text: val, color: '#c084fc' });
  else if (/^-?(0x[\da-fA-F]+|\d+(\.\d*)?([eE][+-]?\d+)?)$/.test(t)) out.push({ text: val, color: '#fb923c' });
  else if (/^"/.test(t) || /^'/.test(t)) out.push({ text: val, color: '#6ee7b7' });
  else if (/^&/.test(t)) out.push({ text: val, color: '#67e8f9' });
  else if (/^\*/.test(t)) out.push({ text: val, color: '#a5f3fc' });
  else out.push({ text: val, color: '#cbd5e1' });
  if (trail) out.push({ text: trail, color: '#3d5166', italic: true });
  return out;
}

function renderToks(toks: Tok[], key: string | number) {
  return toks.map((t, i) => (
    <span key={`${key}-${i}`} style={{ color: t.color, fontWeight: t.bold ? 600 : undefined, fontStyle: t.italic ? 'italic' : undefined }}>
      {t.text}
    </span>
  ));
}

// ─── helpers ──────────────────────────────────────────────────────────────────

const phaseStyle: Record<PodPhase, { bg: string; text: string; ring: string }> = {
  Running:   { bg: 'bg-emerald-400/10', text: 'text-emerald-300', ring: 'ring-emerald-400/25' },
  Pending:   { bg: 'bg-amber-400/10',   text: 'text-amber-300',   ring: 'ring-amber-400/25' },
  Succeeded: { bg: 'bg-blue-400/10',    text: 'text-blue-300',    ring: 'ring-blue-400/25' },
  Failed:    { bg: 'bg-rose-400/10',    text: 'text-rose-300',    ring: 'ring-rose-400/25' },
  Unknown:   { bg: 'bg-slate-700/50',   text: 'text-slate-400',   ring: 'ring-slate-600/40' },
};

function getPodPhaseStyle(pod: Pod) {
  const phase = pod.status.phase;
  const cs = pod.status.containerStatuses ?? [];
  const allReady = cs.length > 0 && cs.every((c) => c.ready);
  const effective: PodPhase = phase === 'Running' && !allReady ? 'Pending' : phase;
  return { style: phaseStyle[effective] ?? phaseStyle.Unknown, phase: effective };
}

// ─── skeleton ─────────────────────────────────────────────────────────────────

function PodDetailSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <div className="h-9 w-9 rounded-lg skeleton" />
        <div className="space-y-2">
          <div className="h-6 w-64 rounded-md skeleton" />
          <div className="h-4 w-48 rounded-md skeleton" />
        </div>
      </div>
      <div className="h-10 w-full rounded-lg skeleton" />
      <div className="h-80 rounded-xl skeleton" />
    </div>
  );
}

// ─── shared card ──────────────────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-700/80 bg-slate-900/65">
      <div className="border-b border-slate-800 bg-slate-950/60 px-4 py-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{title}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between border-b border-slate-800/50 py-2 last:border-0">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={`text-xs text-slate-300 ${mono ? 'font-mono' : ''} max-w-[60%] truncate text-right`} title={value}>
        {value}
      </dd>
    </div>
  );
}

// ─── main ─────────────────────────────────────────────────────────────────────

export default function PodDetail() {
  const { namespace, name } = useParams<{ namespace: string; name: string }>();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [selectedContainer, setSelectedContainer] = useState<string>('');
  const queryClient = useQueryClient();

  const { data: pod, isLoading, error, refetch } = useQuery({
    queryKey: ['pod', namespace, name],
    queryFn: () => podApi.get(namespace!, name!),
    enabled: !!namespace && !!name,
  });

  const { data: yamlData } = useQuery({
    queryKey: ['pod-yaml', namespace, name],
    queryFn: () => podApi.getYaml(namespace!, name!),
    enabled: !!namespace && !!name && activeTab === 'yaml',
  });

  const { data: eventsData } = useQuery({
    queryKey: ['pod-events', namespace, name],
    queryFn: () => podApi.getEvents(namespace!, name!),
    enabled: !!namespace && !!name && activeTab === 'events',
  });

  const effectiveContainer = selectedContainer || pod?.spec.containers[0]?.name || '';

  const { data: logsData, refetch: refetchLogs } = useQuery({
    queryKey: ['pod-logs', namespace, name, effectiveContainer],
    queryFn: () => podApi.getLogs(namespace!, name!, effectiveContainer, 500),
    enabled: !!namespace && !!name && !!effectiveContainer && activeTab === 'logs',
  });

  const deleteMutation = useMutation({
    mutationFn: () => podApi.delete(namespace!, name!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pods'] });
      window.history.back();
    },
  });

  if (isLoading) return <PodDetailSkeleton />;

  if (error || !pod) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-rose-400/20 bg-rose-400/5 py-16 text-center">
        <p className="text-rose-300">加载失败：{(error as Error)?.message || 'Pod 不存在'}</p>
        <button onClick={() => refetch()} className="btn btn-secondary btn-sm">重试</button>
      </div>
    );
  }

  const { style: ps } = getPodPhaseStyle(pod);

  const tabs: { id: TabType; label: string }[] = [
    { id: 'overview', label: '概览' },
    { id: 'containers', label: '容器' },
    { id: 'logs', label: '日志' },
    { id: 'terminal', label: '终端' },
    { id: 'yaml', label: 'YAML' },
    { id: 'events', label: '事件' },
  ];

  return (
    <div className="space-y-5 text-slate-100">
      {/* header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/workloads/pods"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700/80 bg-slate-900/65 text-slate-400 transition-colors hover:border-slate-600 hover:text-slate-200"
          >
            <ArrowLeftIcon className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-slate-100">{name}</h1>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${ps.bg} ${ps.text} ${ps.ring}`}>
                {pod.status.phase}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              {namespace} · {pod.spec.nodeName || 'Pending'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className="btn btn-secondary btn-sm flex items-center gap-1.5">
            <ArrowPathIcon className="h-3.5 w-3.5" />
            刷新
          </button>
          <button
            onClick={() => { if (confirm('确定要删除此 Pod 吗？')) deleteMutation.mutate(); }}
            disabled={deleteMutation.isPending}
            className="flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-300 transition-colors hover:bg-rose-500/20 disabled:opacity-50"
          >
            <TrashIcon className="h-3.5 w-3.5" />
            删除
          </button>
        </div>
      </div>

      {/* tabs */}
      <div className="flex gap-1 rounded-lg border border-slate-700/80 bg-slate-900/65 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-150 ${
              activeTab === tab.id
                ? 'bg-slate-700 text-slate-100'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* tab content */}
      {activeTab === 'overview' && <OverviewTab pod={pod} />}
      {activeTab === 'containers' && <ContainersTab pod={pod} />}
      {activeTab === 'logs' && (
        <LogsTab
          pod={pod}
          logs={logsData || ''}
          selectedContainer={effectiveContainer}
          onContainerChange={setSelectedContainer}
          onRefresh={() => refetchLogs()}
        />
      )}
      {activeTab === 'terminal' && (
        <div className="overflow-hidden rounded-xl border border-slate-700/80 bg-slate-900/65" style={{ minHeight: 500 }}>
          <div className="flex items-center gap-3 border-b border-slate-800 bg-slate-950/60 px-4 py-2.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">终端</span>
            <select
              value={effectiveContainer}
              onChange={(e) => setSelectedContainer(e.target.value)}
              className="ml-2 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-300 focus:outline-none"
            >
              {pod.spec.containers.map((c) => (
                <option key={c.name} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
          {effectiveContainer && (
            <Suspense fallback={
              <div className="flex h-[420px] items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-blue-400" />
              </div>
            }>
              <PodTerminal namespace={namespace!} name={name!} container={effectiveContainer} />
            </Suspense>
          )}
        </div>
      )}
      {activeTab === 'yaml' && <YamlTab yaml={yamlData || ''} />}
      {activeTab === 'events' && <EventsTab events={eventsData?.items || []} />}
    </div>
  );
}

// ─── overview ─────────────────────────────────────────────────────────────────

function OverviewTab({ pod }: { pod: Pod }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <SectionCard title="基本信息">
        <dl>
          <InfoRow label="名称" value={pod.metadata.name} />
          <InfoRow label="命名空间" value={pod.metadata.namespace || '-'} />
          <InfoRow label="UID" value={pod.metadata.uid} mono />
          <InfoRow label="创建时间" value={formatDistanceToNow(new Date(pod.metadata.creationTimestamp), { addSuffix: true, locale: zhCN })} />
          <InfoRow label="节点" value={pod.spec.nodeName || 'Pending'} />
          <InfoRow label="Pod IP" value={pod.status.podIP || '-'} mono />
          <InfoRow label="Host IP" value={pod.status.hostIP || '-'} mono />
          <InfoRow label="QoS 等级" value={pod.status.qosClass || '-'} />
          <InfoRow label="重启策略" value={pod.spec.restartPolicy || '-'} />
          <InfoRow label="服务账户" value={pod.spec.serviceAccountName || 'default'} />
        </dl>
      </SectionCard>

      <div className="space-y-4">
        <SectionCard title="标签">
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(pod.metadata.labels || {}).length > 0
              ? Object.entries(pod.metadata.labels || {}).map(([k, v]) => (
                  <span key={k} className="rounded-full bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-slate-400 ring-1 ring-slate-700">
                    {k}={v}
                  </span>
                ))
              : <span className="text-xs text-slate-600">无标签</span>
            }
          </div>
        </SectionCard>

        <SectionCard title="注解">
          <div className="max-h-36 space-y-1.5 overflow-y-auto">
            {Object.entries(pod.metadata.annotations || {}).length > 0
              ? Object.entries(pod.metadata.annotations || {}).map(([k, v]) => (
                  <div key={k} className="text-[11px]">
                    <span className="text-slate-500">{k}:</span>
                    <span className="ml-1 break-all text-slate-400">{v}</span>
                  </div>
                ))
              : <span className="text-xs text-slate-600">无注解</span>
            }
          </div>
        </SectionCard>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-700/80 bg-slate-900/65 lg:col-span-2">
        <div className="border-b border-slate-800 bg-slate-950/60 px-4 py-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">条件状态</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800/60">
                <th className="py-2.5 pl-4 pr-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">类型</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">状态</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">原因</th>
                <th className="py-2.5 pl-3 pr-4 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">最后转换</th>
              </tr>
            </thead>
            <tbody>
              {pod.status.conditions?.map((cond) => (
                <tr key={cond.type} className="border-b border-slate-800/40 last:border-0">
                  <td className="py-2.5 pl-4 pr-3 text-xs text-slate-300">{cond.type}</td>
                  <td className="px-3 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${
                      cond.status === 'True'
                        ? 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/25'
                        : 'bg-amber-400/10 text-amber-300 ring-amber-400/25'
                    }`}>
                      {cond.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-500">{cond.reason || '—'}</td>
                  <td className="py-2.5 pl-3 pr-4 text-xs text-slate-500">
                    {cond.lastTransitionTime
                      ? formatDistanceToNow(new Date(cond.lastTransitionTime), { addSuffix: true, locale: zhCN })
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── containers ───────────────────────────────────────────────────────────────

function ContainersTab({ pod }: { pod: Pod }) {
  const csMap = new Map((pod.status.containerStatuses ?? []).map((cs) => [cs.name, cs]));

  return (
    <div className="space-y-4">
      {pod.spec.containers.map((container) => {
        const cs = csMap.get(container.name);
        return (
          <div key={container.name} className="overflow-hidden rounded-xl border border-slate-700/80 bg-slate-900/65">
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/60 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-200">{container.name}</span>
                {cs && (
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${
                    cs.ready
                      ? 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/25'
                      : 'bg-amber-400/10 text-amber-300 ring-amber-400/25'
                  }`}>
                    {cs.ready ? '就绪' : '未就绪'}
                  </span>
                )}
              </div>
              {cs && (
                <span className={`font-mono text-xs ${cs.restartCount > 5 ? 'text-rose-400' : cs.restartCount > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                  重启 {cs.restartCount}
                </span>
              )}
            </div>
            <div className="p-4">
              <dl>
                <InfoRow label="镜像" value={container.image} mono />
                <InfoRow label="拉取策略" value={container.imagePullPolicy || 'Always'} />
              </dl>

              {container.ports && container.ports.length > 0 && (
                <div className="mt-3">
                  <div className="mb-1.5 text-[11px] text-slate-500">端口</div>
                  <div className="flex flex-wrap gap-1.5">
                    {container.ports.map((port, i) => (
                      <span key={i} className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-slate-400 ring-1 ring-slate-700">
                        {port.name ? `${port.name}: ` : ''}{port.containerPort}/{port.protocol || 'TCP'}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {container.resources && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                    <div className="mb-1 text-[10px] text-slate-500">请求</div>
                    <div className="font-mono text-xs text-slate-300">
                      CPU: {container.resources.requests?.cpu || '-'}
                    </div>
                    <div className="font-mono text-xs text-slate-300">
                      内存: {container.resources.requests?.memory || '-'}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                    <div className="mb-1 text-[10px] text-slate-500">限制</div>
                    <div className="font-mono text-xs text-slate-300">
                      CPU: {container.resources.limits?.cpu || '-'}
                    </div>
                    <div className="font-mono text-xs text-slate-300">
                      内存: {container.resources.limits?.memory || '-'}
                    </div>
                  </div>
                </div>
              )}

              {container.env && container.env.length > 0 && (
                <div className="mt-3">
                  <div className="mb-1.5 text-[11px] text-slate-500">环境变量</div>
                  <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2">
                    {container.env.map((env, i) => (
                      <div key={i} className="font-mono text-[11px]">
                        <span className="text-blue-400">{env.name}</span>
                        <span className="text-slate-600">=</span>
                        <span className="text-slate-400">
                          {env.value || (env.valueFrom ? '[from secret/configmap]' : '')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {container.volumeMounts && container.volumeMounts.length > 0 && (
                <div className="mt-3">
                  <div className="mb-1.5 text-[11px] text-slate-500">挂载卷</div>
                  <div className="space-y-1">
                    {container.volumeMounts.map((m, i) => (
                      <div key={i} className="flex items-center gap-2 text-[11px]">
                        <span className="font-mono text-slate-300">{m.mountPath}</span>
                        <span className="text-slate-600">←</span>
                        <span className="text-slate-500">{m.name}</span>
                        {m.readOnly && (
                          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-500 ring-1 ring-slate-700">只读</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── logs ─────────────────────────────────────────────────────────────────────

function LogsTab({
  pod,
  logs,
  selectedContainer,
  onContainerChange,
  onRefresh,
}: {
  pod: Pod;
  logs: string;
  selectedContainer: string;
  onContainerChange: (c: string) => void;
  onRefresh: () => void;
}) {
  const copyLogs = () => navigator.clipboard.writeText(logs);
  const lines = logs ? logs.split('\n') : [];

  return (
    <div className="overflow-hidden rounded-xl border border-slate-700/80 bg-slate-900/65">
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/60 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">日志</span>
          <select
            value={selectedContainer}
            onChange={(e) => onContainerChange(e.target.value)}
            className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-300 focus:outline-none"
          >
            {pod.spec.containers.map((c) => (
              <option key={c.name} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={copyLogs} className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200">
            <ClipboardDocumentIcon className="h-3.5 w-3.5" />复制
          </button>
          <button onClick={onRefresh} className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200">
            <ArrowPathIcon className="h-3.5 w-3.5" />刷新
          </button>
        </div>
      </div>
      <div className="max-h-[600px] overflow-auto" style={{ background: '#07090f' }}>
        {lines.length > 0 ? (
          <div className="py-1.5">
            {lines.map((line, i) => {
              const level = detectLevel(line);
              const toks = tokenizeLog(line, level);
              return (
                <div key={i} className="flex min-w-0" style={LOG_ROW_STYLE[level]}>
                  <span className="w-12 shrink-0 select-none py-[1px] pr-3 text-right font-mono text-[11px] leading-5 text-slate-700">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 py-[1px] font-mono text-[12px] leading-5 whitespace-pre-wrap break-all">
                    {renderToks(toks, i)}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex h-24 items-center justify-center">
            <span className="text-sm text-slate-600">暂无日志</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── yaml ─────────────────────────────────────────────────────────────────────

function YamlTab({ yaml }: { yaml: string }) {
  const copyYaml = () => navigator.clipboard.writeText(yaml);
  const lines = yaml ? yaml.split('\n') : [];

  return (
    <div className="overflow-hidden rounded-xl border border-slate-700/80 bg-slate-900/65">
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/60 px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">YAML</span>
        <button onClick={copyYaml} className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200">
          <ClipboardDocumentIcon className="h-3.5 w-3.5" />复制
        </button>
      </div>
      <div className="max-h-[600px] overflow-auto" style={{ background: '#07090f' }}>
        {lines.length > 0 ? (
          <div className="py-1.5">
            {lines.map((line, i) => {
              const toks = tokenizeYamlLine(line);
              return (
                <div key={i} className="flex min-w-0 transition-colors duration-75 hover:bg-slate-800/20">
                  <span className="w-12 shrink-0 select-none py-[1px] pr-3 text-right font-mono text-[11px] leading-5 text-slate-700">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 py-[1px] font-mono text-[12px] leading-5 whitespace-pre">
                    {renderToks(toks, i)}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex h-24 items-center justify-center">
            <span className="text-sm text-slate-600">{yaml === '' ? '暂无内容' : '加载中…'}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── events ───────────────────────────────────────────────────────────────────

function EventsTab({ events }: { events: Event[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-700/80 bg-slate-900/65">
      <div className="border-b border-slate-800 bg-slate-950/60 px-4 py-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">事件</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800/60">
              <th className="py-2.5 pl-4 pr-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">类型</th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">原因</th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">消息</th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">次数</th>
              <th className="py-2.5 pl-3 pr-4 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">时间</th>
            </tr>
          </thead>
          <tbody>
            {events.map((ev, i) => (
              <tr key={i} className="border-b border-slate-800/40 last:border-0 hover:bg-slate-800/30">
                <td className="py-2.5 pl-4 pr-3">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${
                    ev.type === 'Normal'
                      ? 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/25'
                      : 'bg-amber-400/10 text-amber-300 ring-amber-400/25'
                  }`}>
                    {ev.type}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-xs text-slate-400">{ev.reason}</td>
                <td className="max-w-sm px-3 py-2.5 text-xs text-slate-500">
                  <span className="block truncate" title={ev.message}>{ev.message}</span>
                </td>
                <td className="px-3 py-2.5 font-mono text-xs text-slate-500">{ev.count || 1}</td>
                <td className="py-2.5 pl-3 pr-4 text-xs text-slate-500">
                  {ev.lastTimestamp
                    ? formatDistanceToNow(new Date(ev.lastTimestamp), { addSuffix: true, locale: zhCN })
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {events.length === 0 && (
        <div className="py-12 text-center text-sm text-slate-600">暂无事件</div>
      )}
    </div>
  );
}
