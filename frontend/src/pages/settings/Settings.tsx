import { useState } from 'react';
import clsx from 'clsx';
import {
  UserCircleIcon,
  ServerIcon,
  ShieldCheckIcon,
  InformationCircleIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import UserPreferences from './components/UserPreferences';
import ClusterConfig from './components/ClusterConfig';
import SecuritySettings from './components/SecuritySettings';
import SystemInfo from './components/SystemInfo';
import AgentConfig from './components/AgentConfig';

type TabType = 'preferences' | 'cluster' | 'security' | 'agent' | 'system';

interface Tab {
  id: TabType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  component: React.ComponentType;
}

const tabs: Tab[] = [
  {
    id: 'preferences',
    label: '用户偏好',
    icon: UserCircleIcon,
    component: UserPreferences,
  },
  {
    id: 'cluster',
    label: '集群配置',
    icon: ServerIcon,
    component: ClusterConfig,
  },
  {
    id: 'security',
    label: '安全设置',
    icon: ShieldCheckIcon,
    component: SecuritySettings,
  },
  {
    id: 'agent',
    label: 'AI 助手',
    icon: SparklesIcon,
    component: AgentConfig,
  },
  {
    id: 'system',
    label: '系统信息',
    icon: InformationCircleIcon,
    component: SystemInfo,
  },
];

export default function Settings() {
  const [activeTab, setActiveTab] = useState<TabType>('preferences');

  const ActiveComponent = tabs.find((tab) => tab.id === activeTab)?.component || UserPreferences;

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-white via-slate-100 to-slate-200 bg-clip-text text-transparent">
          设置
        </h1>
        <p className="text-slate-400 mt-2 text-sm font-medium">
          配置系统偏好、集群连接和安全选项
        </p>
      </div>

      {/* 标签页导航 */}
      <div className="card p-1">
        <div className="flex gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  'flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200',
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/25'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                )}
              >
                <Icon className="w-5 h-5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 标签页内容 */}
      <div className="card p-6">
        <ActiveComponent />
      </div>
    </div>
  );
}
