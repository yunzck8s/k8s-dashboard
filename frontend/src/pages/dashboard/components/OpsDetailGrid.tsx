import { Link } from 'react-router-dom';
import {
  ChartBarIcon,
  CubeIcon,
  FolderIcon,
  GlobeAltIcon,
  RectangleStackIcon,
  ServerIcon,
} from '@heroicons/react/24/outline';
import StatsCard from '../../../components/common/StatsCard';
import ResourceChart from '../../../components/charts/ResourceChart';
import { formatNumber } from '../../../utils/format';
import type { OpsDetailGridProps, QuickActionLink } from '../types';

const quickLinks: QuickActionLink[] = [
  {
    name: 'Pods',
    path: '/workloads/pods',
    description: '检查运行状态与重启情况',
    icon: CubeIcon,
    iconClassName: 'text-[var(--color-info)]',
  },
  {
    name: 'Deployments',
    path: '/workloads/deployments',
    description: '查看发布进度与副本状态',
    icon: RectangleStackIcon,
    iconClassName: 'text-[var(--color-primary)]',
  },
  {
    name: 'Services',
    path: '/network/services',
    description: '核对服务暴露与端点',
    icon: GlobeAltIcon,
    iconClassName: 'text-[var(--color-warning)]',
  },
  {
    name: 'Nodes',
    path: '/nodes',
    description: '追踪节点健康与资源压力',
    icon: ServerIcon,
    iconClassName: 'text-[var(--color-success)]',
  },
  {
    name: 'ConfigMaps',
    path: '/config/configmaps',
    description: '检查配置变更与版本',
    icon: FolderIcon,
    iconClassName: 'text-[var(--color-info)]',
  },
  {
    name: 'Namespaces',
    path: '/namespaces',
    description: '按租户/团队视角巡检',
    icon: FolderIcon,
    iconClassName: 'text-[var(--color-primary)]',
  },
];

export default function OpsDetailGrid({ overview, alertSummary }: OpsDetailGridProps) {
  return (
    <section className="space-y-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <article className="card rounded-xl p-6 xl:col-span-8">
          <header className="mb-5 flex items-center gap-2">
            <ChartBarIcon className="h-5 w-5 text-[var(--color-text-muted)]" />
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">资源利用率</h2>
          </header>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-divider-strong bg-surface-neutral p-4">
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
                CPU 使用率
              </p>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">容器 CPU 占用</p>
              <div className="mt-3">
                <ResourceChart
                  used={overview.resources.cpu.used}
                  total={overview.resources.cpu.total}
                  unit={overview.resources.cpu.unit}
                  size="sm"
                />
              </div>
            </div>

            <div className="rounded-xl border border-divider-strong bg-surface-neutral p-4">
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
                容器内存
              </p>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">K8s Working Set</p>
              <div className="mt-3">
                <ResourceChart
                  used={overview.resources.memory.used}
                  total={overview.resources.memory.total}
                  unit={overview.resources.memory.unit}
                  size="sm"
                />
              </div>
            </div>

            <div className="rounded-xl border border-divider-strong bg-surface-neutral p-4">
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
                节点内存
              </p>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">OS 可用内存</p>
              <div className="mt-3">
                <ResourceChart
                  used={overview.resources.nodeMemory.used}
                  total={overview.resources.nodeMemory.total}
                  unit={overview.resources.nodeMemory.unit}
                  size="sm"
                />
              </div>
            </div>

            <div className="rounded-xl border border-divider-strong bg-surface-neutral p-4">
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
                Pod 容量
              </p>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">运行中的 Pod</p>
              <div className="mt-3">
                <ResourceChart
                  used={overview.resources.pods.used}
                  total={overview.resources.pods.total}
                  unit={overview.resources.pods.unit}
                  size="sm"
                />
              </div>
            </div>
          </div>
        </article>

        <article className="card rounded-xl p-6 xl:col-span-4">
          <header className="mb-5">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">高频操作入口</h2>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              用于快速处理高频巡检和异常定位。
            </p>
          </header>

          <div className="space-y-2">
            {quickLinks.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className="group flex min-h-[52px] items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-3 py-2 transition-colors duration-150 ease-out hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-elevated)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                aria-label={`进入${item.name}页面`}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <item.icon className={`h-5 w-5 flex-shrink-0 ${item.iconClassName}`} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                      {item.name}
                    </p>
                    <p className="truncate text-xs text-[var(--color-text-muted)]">{item.description}</p>
                  </div>
                </div>
                <span className="text-xs text-[var(--color-text-muted)] transition-colors duration-150 ease-out group-hover:text-[var(--color-primary)]">
                  打开
                </span>
              </Link>
            ))}
          </div>

          <div className="mt-4 rounded-lg border border-divider-strong bg-surface-risk px-3 py-2">
            <p className="text-xs text-[var(--color-text-secondary)]">
              严重告警：<span className="font-semibold text-[var(--color-error)]">{formatNumber(alertSummary?.critical ?? 0, 0)}</span>
            </p>
          </div>
        </article>
      </div>

      <article className="space-y-4">
        <header>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">关键资源指标</h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            为管理层提供趋势前的关键容量与可用性快照。
          </p>
        </header>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard
            title="节点"
            value={overview.nodes.total}
            subtitle={`${overview.nodes.ready} 就绪 / ${overview.nodes.notReady} 异常`}
            icon={ServerIcon}
            color="blue"
            trend={overview.nodes.ready === overview.nodes.total ? 'up' : 'down'}
            variant="executive"
          />
          <StatsCard
            title="Pods"
            value={overview.pods.total}
            subtitle={`${overview.pods.ready} 运行中`}
            icon={CubeIcon}
            color="green"
            trend={overview.pods.ready === overview.pods.total ? 'up' : 'down'}
            variant="executive"
          />
          <StatsCard
            title="Deployments"
            value={overview.deployments.total}
            subtitle={`${overview.deployments.ready} 就绪`}
            icon={RectangleStackIcon}
            color="purple"
            trend={overview.deployments.ready === overview.deployments.total ? 'up' : 'down'}
            variant="executive"
          />
          <StatsCard
            title="Services"
            value={overview.services.total}
            subtitle={`${overview.namespaces} 命名空间`}
            icon={GlobeAltIcon}
            color="orange"
            variant="executive"
          />
        </div>
      </article>
    </section>
  );
}
