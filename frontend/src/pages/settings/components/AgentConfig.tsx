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
  { icon: string; color: string; gradientFrom: string; gradientTo: string }
> = {
  openai: {
    icon: '🤖',
    color: '#00ff9f',
    gradientFrom: '#00ff9f',
    gradientTo: '#00ffaa',
  },
  deepseek: {
    icon: '🧠',
    color: '#ff00ff',
    gradientFrom: '#ff00ff',
    gradientTo: '#ff00aa',
  },
  qwen: {
    icon: '☁️',
    color: '#00ffff',
    gradientFrom: '#00ffff',
    gradientTo: '#00aaff',
  },
  doubao: {
    icon: '🔥',
    color: '#ff6600',
    gradientFrom: '#ff6600',
    gradientTo: '#ff9900',
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
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 relative">
            <div className="absolute inset-0 rounded-full border-4 border-[#00ff9f]/20"></div>
            <div className="absolute inset-0 rounded-full border-4 border-t-[#00ff9f] animate-spin"></div>
          </div>
          <p className="text-gray-400 font-mono text-sm">{'>'} 加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 头部 */}
      <div className="flex items-center gap-4 pb-6 border-b border-[#ff00ff]/20 relative">
        <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#ff00ff] to-transparent opacity-60"></div>

        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#ff00ff] to-[#ff00ff]/70 flex items-center justify-center shadow-lg relative overflow-hidden">
          <SparklesIcon className="w-8 h-8 text-white relative z-10" />
          <div className="absolute inset-0 blur-2xl bg-[#ff00ff] opacity-50 animate-pulse"></div>
        </div>

        <div>
          <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#ff00ff] to-white" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
            AI 助手配置
          </h2>
          <p className="text-sm text-gray-400 mt-1 font-mono">{'>'} 配置 LLM API Key 以使用 AI 运维助手功能</p>
        </div>
      </div>

      {/* Providers 列表 */}
      <div className="space-y-5">
        {providers.map((provider) => {
          const config = providerConfigs[provider.name];
          const displayInfo = providerDisplayInfo[provider.name] || {
            icon: '🤖',
            color: '#00ff9f',
            gradientFrom: '#00ff9f',
            gradientTo: '#00ffaa',
          };

          if (!config) return null;

          return (
            <div
              key={provider.name}
              className="bg-[#0a0e27]/60 backdrop-blur-sm rounded-xl border overflow-hidden transition-all duration-300 hover:shadow-xl relative group"
              style={{
                borderColor: config.isExpanded ? `${displayInfo.color}50` : 'rgba(107, 114, 128, 0.2)',
                boxShadow: config.isExpanded ? `0 0 40px ${displayInfo.color}20` : undefined,
              }}
            >
              {/* Provider 头部 */}
              <div
                className="p-5 flex items-center justify-between cursor-pointer transition-colors relative overflow-hidden"
                onClick={() => toggleExpand(provider.name)}
                style={{
                  background: config.isExpanded ? `linear-gradient(135deg, ${displayInfo.color}10 0%, transparent 100%)` : undefined
                }}
              >
                <div className="flex items-center gap-5 relative z-10">
                  {/* Provider 图标 */}
                  <div
                    className="w-16 h-16 rounded-xl flex items-center justify-center text-3xl shadow-lg relative overflow-hidden"
                    style={{
                      background: `linear-gradient(135deg, ${displayInfo.gradientFrom} 0%, ${displayInfo.gradientTo} 100%)`,
                      boxShadow: `0 0 30px ${displayInfo.color}40`
                    }}
                  >
                    <span className="relative z-10">{displayInfo.icon}</span>
                    <div className="absolute inset-0 blur-xl opacity-40" style={{ background: displayInfo.color }}></div>
                  </div>

                  {/* Provider 信息 */}
                  <div>
                    <div className="flex items-center gap-4">
                      <h3 className="text-xl font-bold text-gray-100" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                        {provider.displayName}
                      </h3>
                      {config.isConfigured ? (
                        <span className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg font-mono font-bold border-2" style={{
                          backgroundColor: `${displayInfo.color}15`,
                          borderColor: `${displayInfo.color}60`,
                          color: displayInfo.color,
                        }}>
                          <CheckCircleIcon className="w-4 h-4" />
                          CONFIGURED
                        </span>
                      ) : (
                        <span className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg bg-gray-700/30 border-2 border-gray-600/40 text-gray-400 font-mono font-bold">
                          <XCircleIcon className="w-4 h-4" />
                          NOT_CONFIGURED
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-400 mt-1.5 font-mono">{provider.description}</p>
                  </div>
                </div>

                {/* 展开/收起图标 */}
                <div className="relative z-10">
                  {config.isExpanded ? (
                    <ChevronUpIcon className="w-6 h-6 text-gray-400 transition-colors group-hover:text-gray-300" />
                  ) : (
                    <ChevronDownIcon className="w-6 h-6 text-gray-400 transition-colors group-hover:text-gray-300" />
                  )}
                </div>
              </div>

              {/* Provider 配置表单（展开时显示） */}
              {config.isExpanded && (
                <div className="border-t p-6 space-y-5" style={{
                  borderColor: `${displayInfo.color}20`,
                  background: `linear-gradient(180deg, ${displayInfo.color}05 0%, transparent 100%)`
                }}>
                  {/* 模型信息 */}
                  <div className="grid grid-cols-3 gap-4 mb-2">
                    <div className="p-4 rounded-lg border backdrop-blur-sm" style={{
                      borderColor: `${displayInfo.color}30`,
                      backgroundColor: `${displayInfo.color}08`
                    }}>
                      <div className="text-xs font-mono font-bold opacity-75" style={{ color: displayInfo.color }}>DEFAULT_MODEL</div>
                      <div className="text-sm font-mono font-bold mt-2 text-gray-300">{provider.defaultModel}</div>
                    </div>
                    <div className="p-4 rounded-lg border backdrop-blur-sm" style={{
                      borderColor: `${displayInfo.color}30`,
                      backgroundColor: `${displayInfo.color}08`
                    }}>
                      <div className="text-xs font-mono font-bold opacity-75" style={{ color: displayInfo.color }}>MAX_TOKENS</div>
                      <div className="text-sm font-mono font-bold mt-2 text-gray-300">
                        {provider.models[0]?.maxTokens.toLocaleString()}
                      </div>
                    </div>
                    <div className="p-4 rounded-lg border backdrop-blur-sm" style={{
                      borderColor: `${displayInfo.color}30`,
                      backgroundColor: `${displayInfo.color}08`
                    }}>
                      <div className="text-xs font-mono font-bold opacity-75" style={{ color: displayInfo.color }}>FEATURES</div>
                      <div className="text-sm font-mono font-bold mt-2 flex gap-2">
                        {provider.supportTools && (
                          <span className="px-2 py-0.5 rounded bg-[#00ff9f]/20 text-[#00ff9f] text-xs">TOOLS</span>
                        )}
                        {provider.supportStream && (
                          <span className="px-2 py-0.5 rounded bg-[#00ffff]/20 text-[#00ffff] text-xs">STREAM</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* API Key 输入 */}
                  <div>
                    <label className="block text-sm font-bold font-mono mb-3 tracking-wider" style={{ color: displayInfo.color }}>
                      {'>'} API_KEY
                    </label>
                    <input
                      type="password"
                      value={config.apiKey}
                      onChange={(e) =>
                        updateProviderConfig(provider.name, { apiKey: e.target.value })
                      }
                      placeholder={`输入 ${provider.displayName} API Key...`}
                      className="w-full px-5 py-3.5 bg-[#0a0e27]/80 border-2 rounded-xl text-gray-300 placeholder-gray-600 focus:outline-none transition-all font-mono text-sm"
                      style={{
                        borderColor: `${displayInfo.color}30`,
                        caretColor: displayInfo.color,
                      }}
                      onFocus={(e) => e.target.style.borderColor = `${displayInfo.color}80`}
                      onBlur={(e) => e.target.style.borderColor = `${displayInfo.color}30`}
                    />
                  </div>

                  {/* 消息提示 */}
                  {config.message && (
                    <div
                      className={`p-4 rounded-xl flex items-center gap-3 border-2 font-mono text-sm ${
                        config.message.type === 'success'
                          ? 'border-[#00ff9f]/40 text-[#00ff9f]'
                          : 'border-[#ff006e]/40 text-[#ff006e]'
                      }`}
                      style={{
                        backgroundColor: config.message.type === 'success' ? '#00ff9f15' : '#ff006e15'
                      }}
                    >
                      {config.message.type === 'success' ? (
                        <CheckCircleIcon className="w-6 h-6 flex-shrink-0" />
                      ) : (
                        <XCircleIcon className="w-6 h-6 flex-shrink-0" />
                      )}
                      <span className="font-bold">{config.message.text}</span>
                    </div>
                  )}

                  {/* 保存按钮 */}
                  <button
                    onClick={() => handleSave(provider.name)}
                    disabled={config.isLoading}
                    className="w-full py-4 px-6 font-bold rounded-xl transition-all flex items-center justify-center gap-3 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden group"
                    style={{
                      background: `linear-gradient(135deg, ${displayInfo.gradientFrom} 0%, ${displayInfo.gradientTo} 100%)`,
                      boxShadow: `0 0 30px ${displayInfo.color}40`,
                      fontFamily: 'Rajdhani, sans-serif'
                    }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700"></div>
                    {config.isLoading ? (
                      <>
                        <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin relative z-10"></div>
                        <span className="relative z-10 text-white">SAVING...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircleIcon className="w-6 h-6 relative z-10 text-[#0a0e27]" />
                        <span className="relative z-10 text-[#0a0e27]">{config.isConfigured ? 'UPDATE_CONFIG' : 'SAVE_CONFIG'}</span>
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
      <div className="bg-[#0a0e27]/60 backdrop-blur-sm border border-[#00ff9f]/30 rounded-xl p-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{
          background: 'linear-gradient(135deg, #00ff9f20 0%, transparent 100%)'
        }}></div>

        <div className="flex gap-4 relative z-10">
          <div className="text-4xl">💡</div>
          <div className="flex-1 space-y-3">
            <div className="font-bold text-[#00ff9f] text-lg font-mono">{'>'} USAGE_TIPS</div>
            <ul className="space-y-2 text-sm text-gray-400 font-mono leading-relaxed">
              <li className="flex items-start gap-3">
                <span className="text-[#00ff9f] font-bold flex-shrink-0">01.</span>
                <span>点击 Provider 卡片可展开配置界面</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[#00ff9f] font-bold flex-shrink-0">02.</span>
                <span>配置完成后，可在侧边栏点击 "AI 助手" 开始使用</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[#00ff9f] font-bold flex-shrink-0">03.</span>
                <span>AI 助手可帮助查询集群状态、诊断问题、执行运维操作</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[#00ff9f] font-bold flex-shrink-0">04.</span>
                <span>高风险操作需要人工审批后才会执行</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[#00ff9f] font-bold flex-shrink-0">05.</span>
                <span>API Key 仅存储在后端服务器，不会传输到前端</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
