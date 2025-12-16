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
  color: string;
}

const tabs: Tab[] = [
  {
    id: 'preferences',
    label: '用户偏好',
    icon: UserCircleIcon,
    component: UserPreferences,
    color: '#00ff9f',
  },
  {
    id: 'cluster',
    label: '集群配置',
    icon: ServerIcon,
    component: ClusterConfig,
    color: '#00ffff',
  },
  {
    id: 'security',
    label: '安全设置',
    icon: ShieldCheckIcon,
    component: SecuritySettings,
    color: '#ff006e',
  },
  {
    id: 'agent',
    label: 'AI 助手',
    icon: SparklesIcon,
    component: AgentConfig,
    color: '#ff00ff',
  },
  {
    id: 'system',
    label: '系统信息',
    icon: InformationCircleIcon,
    component: SystemInfo,
    color: '#ffaa00',
  },
];

export default function Settings() {
  const [activeTab, setActiveTab] = useState<TabType>('preferences');

  const ActiveComponent = tabs.find((tab) => tab.id === activeTab)?.component || UserPreferences;
  const activeColor = tabs.find((tab) => tab.id === activeTab)?.color || '#00ff9f';

  return (
    <div className="space-y-6 relative">
      {/* 背景装饰 */}
      <div className="fixed inset-0 bg-[#0a0e27] -z-10">
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: `
            radial-gradient(circle at 30% 20%, rgba(0, 255, 159, 0.15) 0%, transparent 50%),
            radial-gradient(circle at 70% 60%, rgba(255, 0, 110, 0.15) 0%, transparent 50%)
          `
        }}></div>
        {/* 扫描线 */}
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 255, 159, 0.05) 2px, rgba(0, 255, 159, 0.05) 4px)'
        }}></div>
      </div>

      {/* 页面头部 */}
      <div className="relative">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[#00ff9f] to-[#00ff9f]/50 flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 bg-[#00ff9f] blur-2xl opacity-40 animate-pulse"></div>
            <svg className="w-10 h-10 text-[#0a0e27] relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
          </div>
          <div>
            <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#00ff9f] to-[#00ffff]" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
              系统设置
            </h1>
            <p className="text-gray-400 mt-1 text-sm font-mono">
              {'>'} 配置系统偏好、集群连接和安全选项
            </p>
          </div>
        </div>
      </div>

      {/* 标签页导航 - 垂直侧边栏风格 */}
      <div className="grid grid-cols-12 gap-6">
        {/* 左侧导航 */}
        <div className="col-span-3 space-y-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  'w-full flex items-center gap-4 px-5 py-4 rounded-xl text-sm font-bold transition-all duration-300 relative overflow-hidden group',
                  isActive
                    ? 'bg-[#0f1629]/90 backdrop-blur-sm border-2 shadow-lg'
                    : 'bg-[#0a0e27]/50 backdrop-blur-sm border border-gray-700/30 hover:bg-[#0f1629]/70 hover:border-gray-600/50'
                )}
                style={{
                  borderColor: isActive ? tab.color : undefined,
                  boxShadow: isActive ? `0 0 30px ${tab.color}40` : undefined,
                }}
              >
                {/* 装饰性光效 */}
                {isActive && (
                  <div className="absolute inset-0 opacity-20" style={{
                    background: `linear-gradient(135deg, ${tab.color}20 0%, transparent 100%)`
                  }}></div>
                )}

                <div className={clsx(
                  'w-10 h-10 rounded-lg flex items-center justify-center transition-all relative',
                  isActive ? 'shadow-lg' : 'bg-gray-800/50'
                )}
                style={{
                  background: isActive ? `linear-gradient(135deg, ${tab.color} 0%, ${tab.color}80 100%)` : undefined,
                  boxShadow: isActive ? `0 0 20px ${tab.color}60` : undefined,
                }}>
                  <Icon className={clsx('w-6 h-6 relative z-10', isActive ? 'text-[#0a0e27]' : 'text-gray-400')} />
                  {isActive && (
                    <div className="absolute inset-0 blur-xl opacity-50" style={{ background: tab.color }}></div>
                  )}
                </div>

                <span className={clsx(
                  'font-mono tracking-wide relative z-10 transition-colors',
                  isActive ? 'text-transparent bg-clip-text' : 'text-gray-400 group-hover:text-gray-300'
                )}
                style={isActive ? {
                  backgroundImage: `linear-gradient(90deg, ${tab.color} 0%, white 100%)`
                } : undefined}
                >
                  {tab.label}
                </span>

                {/* 活动指示器 */}
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full animate-pulse" style={{
                    background: tab.color,
                    boxShadow: `0 0 15px ${tab.color}`
                  }}></div>
                )}
              </button>
            );
          })}
        </div>

        {/* 右侧内容区域 */}
        <div className="col-span-9">
          <div className="bg-[#0f1629]/80 backdrop-blur-xl rounded-2xl border shadow-2xl relative overflow-hidden" style={{
            borderColor: `${activeColor}30`,
            boxShadow: `0 0 60px ${activeColor}15`
          }}>
            {/* 装饰性顶部线条 */}
            <div className="absolute top-0 left-0 w-full h-px opacity-60" style={{
              background: `linear-gradient(90deg, transparent 0%, ${activeColor} 50%, transparent 100%)`
            }}></div>

            {/* 内容区 */}
            <div className="p-8">
              <ActiveComponent />
            </div>

            {/* 装饰性底部线条 */}
            <div className="absolute bottom-0 left-0 w-full h-px opacity-40" style={{
              background: `linear-gradient(90deg, transparent 0%, ${activeColor} 50%, transparent 100%)`
            }}></div>
          </div>
        </div>
      </div>

      {/* 添加自定义字体 */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
      `}</style>
    </div>
  );
}
