import { useState, useEffect } from 'react';
import {
  SparklesIcon,
  CheckCircleIcon,
  XCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline';
import api from '../../../api/client';

interface ProviderInfo {
  name: string;
  displayName: string;
  description: string;
  enabled: boolean;
  models: Array<{
    id: string;
    name: string;
    maxTokens: number;
    priceInput: number;
    priceOutput: number;
  }>;
  defaultModel: string;
  supportStream: boolean;
  supportTools: boolean;
}

interface ProviderConfigState {
  apiKey: string;
  isConfigured: boolean;
  isExpanded: boolean;
  isLoading: boolean;
  message: { type: 'success' | 'error'; text: string } | null;
}

// Provider 显示信息
const providerDisplayInfo: Record<
  string,
  { icon: string; color: string; getBadge: string }
> = {
  openai: {
    icon: '🤖',
    color: 'from-green-600 to-teal-600',
    getBadge: 'bg-green-500/10 border-green-500/30 text-green-400',
  },
  deepseek: {
    icon: '🧠',
    color: 'from-purple-600 to-pink-600',
    getBadge: 'bg-purple-500/10 border-purple-500/30 text-purple-400',
  },
  qwen: {
    icon: '☁️',
    color: 'from-blue-600 to-cyan-600',
    getBadge: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
  },
  doubao: {
    icon: '🔥',
    color: 'from-orange-600 to-red-600',
    getBadge: 'bg-orange-500/10 border-orange-500/30 text-orange-400',
  },
};

export default function AgentConfig() {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [providerConfigs, setProviderConfigs] = useState<Record<string, ProviderConfigState>>({});
  const [isLoadingProviders, setIsLoadingProviders] = useState(true);

  useEffect(() => {
    loadProviders();
    loadConfig();
  }, []);

  const loadProviders = async () => {
    try {
      const response = await api.get('/agent/providers');
      const providersList = response.data.providers || [];
      setProviders(providersList);

      // 初始化每个 provider 的配置状态
      const configs: Record<string, ProviderConfigState> = {};
      providersList.forEach((provider: ProviderInfo) => {
        configs[provider.name] = {
          apiKey: '',
          isConfigured: false,
          isExpanded: false,
          isLoading: false,
          message: null,
        };
      });
      setProviderConfigs(configs);
    } catch (error) {
      console.error('加载 providers 失败', error);
    } finally {
      setIsLoadingProviders(false);
    }
  };

  const loadConfig = async () => {
    try {
      const response = await api.get('/agent/config');
      const config = response.data.config;

      // 更新每个 provider 的配置状态
      setProviderConfigs((prev) => {
        const updated = { ...prev };
        Object.keys(config.providers || {}).forEach((name) => {
          if (updated[name]) {
            updated[name].isConfigured = config.providers[name].apiKey === '***';
          }
        });
        return updated;
      });
    } catch (error) {
      console.error('加载配置失败', error);
    }
  };

  const handleSave = async (providerName: string) => {
    const config = providerConfigs[providerName];
    if (!config.apiKey.trim()) {
      updateProviderConfig(providerName, {
        message: { type: 'error', text: '请输入 API Key' },
      });
      return;
    }

    updateProviderConfig(providerName, { isLoading: true, message: null });

    try {
      await api.put('/agent/config', {
        provider: providerName,
        apiKey: config.apiKey.trim(),
      });

      updateProviderConfig(providerName, {
        isLoading: false,
        isConfigured: true,
        apiKey: '',
        message: { type: 'success', text: 'API Key 配置成功！' },
      });

      // 3秒后清除消息
      setTimeout(() => {
        updateProviderConfig(providerName, { message: null });
      }, 3000);
    } catch (error: any) {
      updateProviderConfig(providerName, {
        isLoading: false,
        message: {
          type: 'error',
          text: error.response?.data?.error || '配置失败，请重试',
        },
      });
    }
  };

  const updateProviderConfig = (
    providerName: string,
    updates: Partial<ProviderConfigState>
  ) => {
    setProviderConfigs((prev) => ({
      ...prev,
      [providerName]: { ...prev[providerName], ...updates },
    }));
  };

  const toggleExpand = (providerName: string) => {
    updateProviderConfig(providerName, {
      isExpanded: !providerConfigs[providerName]?.isExpanded,
    });
  };

  if (isLoadingProviders) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-400">加载中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 pb-4 border-b border-slate-700">
        <SparklesIcon className="w-8 h-8 text-purple-400" />
        <div>
          <h2 className="text-xl font-semibold text-slate-100">AI 助手配置</h2>
          <p className="text-sm text-slate-400 mt-1">配置 LLM API Key 以使用 AI 运维助手功能</p>
        </div>
      </div>

      {/* Providers 列表 */}
      <div className="space-y-4">
        {providers.map((provider) => {
          const config = providerConfigs[provider.name];
          const displayInfo = providerDisplayInfo[provider.name] || {
            icon: '🤖',
            color: 'from-gray-600 to-gray-600',
            getBadge: 'bg-gray-500/10 border-gray-500/30 text-gray-400',
          };

          if (!config) return null;

          return (
            <div
              key={provider.name}
              className="bg-slate-800/30 rounded-lg border border-slate-700/30 overflow-hidden"
            >
              {/* Provider 头部 */}
              <div
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-700/20 transition-colors"
                onClick={() => toggleExpand(provider.name)}
              >
                <div className="flex items-center gap-4">
                  {/* Provider 图标 */}
                  <div
                    className={`w-12 h-12 rounded-lg bg-gradient-to-br ${displayInfo.color} flex items-center justify-center text-2xl shadow-lg`}
                  >
                    {displayInfo.icon}
                  </div>

                  {/* Provider 信息 */}
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-slate-100">
                        {provider.displayName}
                      </h3>
                      {config.isConfigured ? (
                        <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-green-500/10 border border-green-500/30 text-green-400">
                          <CheckCircleIcon className="w-3 h-3" />
                          已配置
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-400">
                          <XCircleIcon className="w-3 h-3" />
                          未配置
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-400 mt-1">{provider.description}</p>
                  </div>
                </div>

                {/* 展开/收起图标 */}
                {config.isExpanded ? (
                  <ChevronUpIcon className="w-5 h-5 text-slate-400" />
                ) : (
                  <ChevronDownIcon className="w-5 h-5 text-slate-400" />
                )}
              </div>

              {/* Provider 配置表单（展开时显示） */}
              {config.isExpanded && (
                <div className="border-t border-slate-700/30 p-6 bg-slate-800/50 space-y-4">
                  {/* 模型信息 */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className={`p-3 rounded-lg border ${displayInfo.getBadge}`}>
                      <div className="text-xs opacity-75">默认模型</div>
                      <div className="text-sm font-medium mt-1">{provider.defaultModel}</div>
                    </div>
                    <div className={`p-3 rounded-lg border ${displayInfo.getBadge}`}>
                      <div className="text-xs opacity-75">支持功能</div>
                      <div className="text-sm font-medium mt-1 flex gap-2">
                        {provider.supportTools && (
                          <span className="text-xs px-2 py-0.5 rounded bg-slate-700/50">工具</span>
                        )}
                        {provider.supportStream && (
                          <span className="text-xs px-2 py-0.5 rounded bg-slate-700/50">流式</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* API Key 输入 */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      API Key
                    </label>
                    <input
                      type="password"
                      value={config.apiKey}
                      onChange={(e) =>
                        updateProviderConfig(provider.name, { apiKey: e.target.value })
                      }
                      placeholder={`输入 ${provider.displayName} API Key...`}
                      className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>

                  {/* 消息提示 */}
                  {config.message && (
                    <div
                      className={`p-3 rounded-lg flex items-center gap-2 ${
                        config.message.type === 'success'
                          ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                          : 'bg-red-500/10 border border-red-500/30 text-red-400'
                      }`}
                    >
                      {config.message.type === 'success' ? (
                        <CheckCircleIcon className="w-5 h-5" />
                      ) : (
                        <XCircleIcon className="w-5 h-5" />
                      )}
                      <span className="text-sm">{config.message.text}</span>
                    </div>
                  )}

                  {/* 保存按钮 */}
                  <button
                    onClick={() => handleSave(provider.name)}
                    disabled={config.isLoading}
                    className={`w-full py-2 px-4 bg-gradient-to-r ${displayInfo.color} hover:opacity-90 disabled:opacity-50 text-white font-medium rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg`}
                  >
                    {config.isLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span>保存中...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircleIcon className="w-5 h-5" />
                        <span>{config.isConfigured ? '更新配置' : '保存配置'}</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 使用说明 */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
        <div className="flex gap-3">
          <div className="text-blue-400 text-2xl">💡</div>
          <div className="text-sm text-blue-300 space-y-2">
            <div className="font-medium">使用提示：</div>
            <ul className="space-y-1 list-disc list-inside text-blue-300/80">
              <li>点击 Provider 卡片可展开配置界面</li>
              <li>配置完成后，可在侧边栏点击 "AI 助手" 开始使用</li>
              <li>AI 助手可帮助查询集群状态、诊断问题、执行运维操作</li>
              <li>高风险操作需要人工审批后才会执行</li>
              <li>API Key 仅存储在后端服务器，不会传输到前端</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
