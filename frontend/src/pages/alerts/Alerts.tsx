import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { alertApi } from '../../api';
import AlertsActive from './AlertsActive';
import AlertsSilences from './AlertsSilences';
import clsx from 'clsx';
import {
  BellAlertIcon,
  ClockIcon,
  BellSlashIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline';

type TabType = 'active' | 'history' | 'silences' | 'rules';

export default function Alerts() {
  const [searchParams, setSearchParams] = useSearchParams();

  // 从 URL 参数读取当前标签，默认为 'active'
  const activeTab = (searchParams.get('tab') as TabType) || 'active';

  // 获取告警摘要
  const { data: summary } = useQuery({
    queryKey: ['alerts-summary'],
    queryFn: () => alertApi.getSummary(),
    refetchInterval: 30000, // 每30秒刷新
  });

  // 设置标签并同步到 URL 参数
  const setActiveTab = (tab: TabType) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('tab', tab);
    // 切换标签时清除其他过滤参数
    newParams.delete('severity');
    newParams.delete('namespace');
    newParams.delete('alertname');
    setSearchParams(newParams);
  };

  const tabs = [
    {
      id: 'active' as TabType,
      label: '活跃告警',
      icon: BellAlertIcon,
      count: summary?.total || 0,
    },
    {
      id: 'history' as TabType,
      label: '历史记录',
      icon: ClockIcon,
    },
    {
      id: 'silences' as TabType,
      label: '静默规则',
      icon: BellSlashIcon,
    },
    {
      id: 'rules' as TabType,
      label: '告警规则',
      icon: Cog6ToothIcon,
    },
  ];

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">告警管理</h1>
          <p className="text-slate-400 mt-1">
            监控和管理集群告警、静默规则和告警规则
          </p>
        </div>

        {/* 告警摘要徽章 */}
        {summary && (
          <div className="flex items-center gap-3">
            {summary.critical > 0 && (
              <span className="badge badge-error">
                {summary.critical} 严重
              </span>
            )}
            {summary.warning > 0 && (
              <span className="badge badge-warning">
                {summary.warning} 警告
              </span>
            )}
            {summary.info > 0 && (
              <span className="badge badge-info">
                {summary.info} 信息
              </span>
            )}
          </div>
        )}
      </div>

      {/* Tab 导航 */}
      <div className="border-b border-slate-700">
        <nav className="flex gap-1" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px',
                activeTab === tab.id
                  ? 'text-blue-400 border-blue-400'
                  : 'text-slate-400 border-transparent hover:text-slate-300 hover:border-slate-600'
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className={clsx(
                    'px-2 py-0.5 text-xs rounded-full',
                    activeTab === tab.id
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'bg-slate-700 text-slate-400'
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab 内容 */}
      <div>
        {activeTab === 'active' && <AlertsActive />}
        {activeTab === 'history' && (
          <div className="card p-12 text-center">
            <ClockIcon className="w-12 h-12 mx-auto text-slate-500 mb-4" />
            <p className="text-slate-500">历史记录功能开发中...</p>
            <p className="text-slate-600 text-sm mt-2">
              将支持查看已解决的告警历史和趋势分析
            </p>
          </div>
        )}
        {activeTab === 'silences' && <AlertsSilences />}
        {activeTab === 'rules' && (
          <div className="card p-12 text-center">
            <Cog6ToothIcon className="w-12 h-12 mx-auto text-slate-500 mb-4" />
            <p className="text-slate-500">告警规则功能开发中...</p>
            <p className="text-slate-600 text-sm mt-2">
              将支持创建自定义告警规则并同步到 VictoriaMetrics
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
