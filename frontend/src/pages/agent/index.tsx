import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  PaperAirplaneIcon,
  SparklesIcon,
  Cog6ToothIcon,
  ExclamationTriangleIcon,
  ChevronDownIcon,
  WrenchScrewdriverIcon,
  XMarkIcon,
  ShieldCheckIcon,
  MagnifyingGlassIcon,
  BoltIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';
import { ArrowPathIcon } from '@heroicons/react/24/solid';
import { ChatMessage } from '../../components/ChatMessage';
import { ApprovalDialog } from '../../components/ApprovalDialog';
import { useAgentChat } from '../../hooks/useAgentChat';
import type { Message, ApprovalRequest } from '../../types/agent';
import api from '../../api/client';

// 生成唯一 ID
let messageIdCounter = 0;
const generateMessageId = () => {
  messageIdCounter += 1;
  return `${Date.now()}-${messageIdCounter}-${Math.random().toString(36).slice(2, 8)}`;
};

// 工具定义
interface K8sTool {
  name: string;
  description: string;
  category: 'query' | 'diagnostic' | 'action' | 'analysis';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

// Provider 配置
interface ProviderOption {
  id: string;
  name: string;
  models: { id: string; name: string }[];
}

const PROVIDER_CONFIG: Record<string, ProviderOption> = {
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek Chat' },
      { id: 'deepseek-coder', name: 'DeepSeek Coder' },
    ],
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
    ],
  },
  qwen: {
    id: 'qwen',
    name: '通义千问',
    models: [
      { id: 'qwen-turbo', name: 'Qwen Turbo' },
      { id: 'qwen-plus', name: 'Qwen Plus' },
      { id: 'qwen-max', name: 'Qwen Max' },
    ],
  },
  doubao: {
    id: 'doubao',
    name: '豆包',
    models: [
      { id: 'doubao-pro-32k', name: '豆包 Pro 32K' },
      { id: 'doubao-lite-32k', name: '豆包 Lite 32K' },
    ],
  },
};

export default function AgentPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [approvalRequest, setApprovalRequest] = useState<ApprovalRequest | null>(null);
  const [pendingToolCallId, setPendingToolCallId] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const [isCheckingConfig, setIsCheckingConfig] = useState(true);
  const [availableProviders, setAvailableProviders] = useState<string[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [showCapabilities, setShowCapabilities] = useState(false);
  const [tools, setTools] = useState<K8sTool[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const modelSelectorRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭模型选择器
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modelSelectorRef.current && !modelSelectorRef.current.contains(event.target as Node)) {
        setShowModelSelector(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 检查配置状态
  useEffect(() => {
    checkConfiguration();
    fetchTools();
  }, []);

  const checkConfiguration = async () => {
    try {
      const response = await api.get('/agent/config');
      const config = response.data.config;
      const configuredProviders = Object.entries(config.providers || {})
        .filter(([, provider]: [string, any]) => provider.apiKey === '***' && provider.enabled !== false)
        .map(([name]) => name);

      setAvailableProviders(configuredProviders);
      setIsConfigured(configuredProviders.length > 0);

      if (configuredProviders.length > 0) {
        const firstProvider = configuredProviders[0];
        setSelectedProvider(firstProvider);
        const providerConfig = PROVIDER_CONFIG[firstProvider];
        if (providerConfig?.models.length > 0) {
          setSelectedModel(providerConfig.models[0].id);
        }
      }
    } catch (error) {
      console.error('检查配置失败', error);
      setIsConfigured(false);
    } finally {
      setIsCheckingConfig(false);
    }
  };

  const fetchTools = async () => {
    try {
      const response = await api.get('/agent/tools');
      setTools(response.data.tools || []);
    } catch (error) {
      console.error('获取工具列表失败', error);
    }
  };

  const { isConnected, isLoading, sendMessage, sendApproval } = useAgentChat({
    onMessage: (content) => {
      setMessages((prev) => {
        const lastMessage = prev[prev.length - 1];
        if (lastMessage && lastMessage.role === 'assistant') {
          return [...prev.slice(0, -1), { ...lastMessage, content }];
        } else {
          return [
            ...prev,
            {
              id: generateMessageId(),
              role: 'assistant',
              content,
              createdAt: new Date().toISOString(),
            },
          ];
        }
      });
    },
    onToolCall: (toolCall) => {
      setMessages((prev) => {
        const lastMessage = prev[prev.length - 1];
        if (lastMessage && lastMessage.role === 'assistant') {
          return [
            ...prev.slice(0, -1),
            {
              ...lastMessage,
              toolCalls: [...(lastMessage.toolCalls || []), toolCall],
            },
          ];
        }
        return prev;
      });
    },
    onToolResult: (result) => {
      setMessages((prev) => [
        ...prev,
        {
          id: generateMessageId(),
          role: 'tool',
          content: result.success ? result.result || '执行成功' : result.error || '执行失败',
          createdAt: new Date().toISOString(),
        },
      ]);
    },
    onApprovalRequest: (request) => {
      setApprovalRequest(request);
      setPendingToolCallId(request.toolCallId);
    },
    onError: (error) => {
      console.error('[AgentChat] Error:', error);
      if (error === 'WebSocket is not connected') {
        return;
      }
      setMessages((prev) => [
        ...prev,
        {
          id: generateMessageId(),
          role: 'assistant',
          content: `错误：${error}`,
          createdAt: new Date().toISOString(),
        },
      ]);
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!inputValue.trim() || !isConnected || isLoading) {
      return;
    }

    const userMessage: Message = {
      id: generateMessageId(),
      role: 'user',
      content: inputValue.trim(),
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    sendMessage(inputValue.trim(), selectedProvider, selectedModel);
    setInputValue('');
  };

  const handleProviderChange = (provider: string) => {
    setSelectedProvider(provider);
    const providerConfig = PROVIDER_CONFIG[provider];
    if (providerConfig?.models.length > 0) {
      setSelectedModel(providerConfig.models[0].id);
    }
    setShowModelSelector(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleApprove = () => {
    if (pendingToolCallId) {
      sendApproval(pendingToolCallId, true);
      setPendingToolCallId(null);
      setApprovalRequest(null);
    }
  };

  const handleReject = () => {
    if (pendingToolCallId) {
      sendApproval(pendingToolCallId, false);
      setPendingToolCallId(null);
      setApprovalRequest(null);
    }
  };

  // 加载中
  if (isCheckingConfig) {
    return (
      <div className="flex items-center justify-center relative" style={{ height: 'calc(100vh - 140px)' }}>
        {/* 动画背景 */}
        <div className="absolute inset-0 bg-[#0a0e27]">
          <div className="absolute inset-0 opacity-30" style={{
            backgroundImage: `
              radial-gradient(circle at 20% 50%, rgba(0, 255, 159, 0.15) 0%, transparent 50%),
              radial-gradient(circle at 80% 80%, rgba(255, 0, 110, 0.15) 0%, transparent 50%)
            `
          }}></div>
          {/* 扫描线效果 */}
          <div className="absolute inset-0 opacity-10" style={{
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 255, 159, 0.03) 2px, rgba(0, 255, 159, 0.03) 4px)'
          }}></div>
        </div>

        <div className="text-center relative z-10">
          <div className="relative inline-block">
            <ArrowPathIcon className="w-16 h-16 mb-4 text-[#00ff9f] animate-spin" />
            <div className="absolute inset-0 blur-xl bg-[#00ff9f] opacity-50 animate-pulse"></div>
          </div>
          <p className="text-[#00ff9f] font-mono text-sm tracking-wider animate-pulse">
            {'>'} 正在初始化系统...
          </p>
        </div>
      </div>
    );
  }

  // 未配置提示
  if (!isConfigured) {
    return (
      <div className="flex items-center justify-center relative" style={{ height: 'calc(100vh - 140px)' }}>
        {/* 动画背景 */}
        <div className="absolute inset-0 bg-[#0a0e27]">
          <div className="absolute inset-0 opacity-20" style={{
            backgroundImage: `
              radial-gradient(circle at 20% 50%, rgba(255, 0, 110, 0.2) 0%, transparent 50%),
              radial-gradient(circle at 80% 80%, rgba(0, 255, 159, 0.1) 0%, transparent 50%)
            `
          }}></div>
        </div>

        <div className="max-w-2xl w-full mx-auto px-6 relative z-10">
          <div className="bg-[#0f1629]/90 backdrop-blur-xl rounded-2xl shadow-2xl p-10 border border-[#ff006e]/30 relative overflow-hidden">
            {/* 装饰性边框光效 */}
            <div className="absolute inset-0 opacity-50">
              <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#ff006e] to-transparent"></div>
              <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#00ff9f] to-transparent"></div>
            </div>

            <div className="text-center mb-8 relative">
              <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-[#ff006e] to-[#ff006e]/50 flex items-center justify-center relative">
                <ExclamationTriangleIcon className="w-14 h-14 text-white" />
                <div className="absolute inset-0 blur-2xl bg-[#ff006e] opacity-60 animate-pulse"></div>
              </div>
              <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#ff006e] to-[#00ff9f] mb-3" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                系统未配置
              </h2>
              <p className="text-gray-400 font-mono text-sm">
                {'>'} 需要配置 LLM Provider API Key 才能使用 AI 助手
              </p>
            </div>

            <div className="bg-[#0a0e27]/50 rounded-xl p-6 mb-8 border border-[#00ff9f]/20">
              <h3 className="font-bold text-[#00ff9f] mb-4 text-lg" style={{ fontFamily: 'Rajdhani, sans-serif' }}>配置步骤</h3>
              <ol className="space-y-3 list-none text-gray-300 font-mono text-sm">
                <li className="flex items-start gap-3">
                  <span className="text-[#00ff9f] font-bold">01.</span>
                  <span>前往设置页面的 "AI 助手" 标签</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#00ff9f] font-bold">02.</span>
                  <span>选择 LLM Provider（OpenAI、DeepSeek、通义千问、豆包）</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#00ff9f] font-bold">03.</span>
                  <span>展开 Provider 卡片并输入 API Key</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#00ff9f] font-bold">04.</span>
                  <span>保存配置后返回此页面开始使用</span>
                </li>
              </ol>
            </div>

            <div className="flex gap-4">
              <Link
                to="/settings"
                className="flex-1 py-4 px-6 bg-gradient-to-r from-[#ff006e] to-[#ff006e]/80 hover:from-[#ff006e]/90 hover:to-[#ff006e]/70 text-white font-bold rounded-xl transition-all transform hover:scale-105 hover:shadow-lg hover:shadow-[#ff006e]/50 flex items-center justify-center gap-3 relative overflow-hidden group"
                style={{ fontFamily: 'Rajdhani, sans-serif' }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000"></div>
                <Cog6ToothIcon className="w-6 h-6 relative z-10" />
                <span className="relative z-10">前往设置</span>
              </Link>
              <button
                onClick={checkConfiguration}
                className="py-4 px-6 bg-[#0a0e27] hover:bg-[#0a0e27]/80 text-[#00ff9f] font-bold rounded-xl transition-all border-2 border-[#00ff9f]/30 hover:border-[#00ff9f] flex items-center justify-center gap-3"
                style={{ fontFamily: 'Rajdhani, sans-serif' }}
              >
                <ArrowPathIcon className="w-6 h-6" />
                <span>重新检查</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col relative" style={{ height: 'calc(100vh - 140px)' }}>
      {/* 动画背景 */}
      <div className="fixed inset-0 bg-[#0a0e27] -z-10">
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: `
            radial-gradient(circle at 20% 20%, rgba(0, 255, 159, 0.1) 0%, transparent 50%),
            radial-gradient(circle at 80% 80%, rgba(255, 0, 110, 0.1) 0%, transparent 50%)
          `
        }}></div>
        {/* 扫描线 */}
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 255, 159, 0.05) 2px, rgba(0, 255, 159, 0.05) 4px)'
        }}></div>
      </div>

      {/* 头部 - 终端风格 - 固定 */}
      <header className="flex-shrink-0 bg-[#0f1629]/80 backdrop-blur-xl border-b border-[#00ff9f]/20 px-6 py-4 relative">
        {/* 装饰性顶部线条 */}
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#00ff9f] to-transparent"></div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#00ff9f] to-[#00ff9f]/50 flex items-center justify-center relative overflow-hidden group">
              <SparklesIcon className="w-7 h-7 text-[#0a0e27] relative z-10" />
              <div className="absolute inset-0 bg-[#00ff9f] blur-xl opacity-50 group-hover:opacity-80 transition-opacity"></div>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#00ff9f] to-[#00ffff]" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                AI 运维助手
              </h1>
              <p className="text-xs font-mono mt-1">
                {isConnected ? (
                  <span className="flex items-center gap-2 text-[#00ff9f]">
                    <span className="w-2 h-2 bg-[#00ff9f] rounded-full animate-pulse shadow-[0_0_10px_rgba(0,255,159,0.8)]"></span>
                    {'>'} 系统在线
                  </span>
                ) : (
                  <span className="flex items-center gap-2 text-[#ff006e]">
                    <span className="w-2 h-2 bg-[#ff006e] rounded-full animate-pulse"></span>
                    {'>'} 连接中断
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* 右侧按钮组 */}
          <div className="flex items-center gap-3">
            {/* 显示能力按钮 */}
            <button
              onClick={() => setShowCapabilities(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#0a0e27]/50 hover:bg-[#0a0e27]/80 rounded-lg transition-all border border-[#00ffff]/30 hover:border-[#00ffff] font-mono text-sm group"
            >
              <WrenchScrewdriverIcon className="w-5 h-5 text-[#00ffff]" />
              <span className="text-gray-400 group-hover:text-gray-300 transition-colors">能力列表</span>
            </button>

            {/* 模型选择器 - 终端风格 */}
            <div className="relative" ref={modelSelectorRef}>
              <button
                onClick={() => setShowModelSelector(!showModelSelector)}
                className="flex items-center gap-3 px-5 py-2.5 bg-[#0a0e27]/50 hover:bg-[#0a0e27]/80 rounded-lg transition-all border border-[#00ff9f]/30 hover:border-[#00ff9f] font-mono text-sm group"
              >
                <span className="text-[#00ff9f] font-bold">
                  {PROVIDER_CONFIG[selectedProvider]?.name || selectedProvider}
                </span>
                <span className="text-[#ff006e]">/</span>
                <span className="text-gray-400 group-hover:text-gray-300 transition-colors">
                  {PROVIDER_CONFIG[selectedProvider]?.models.find((m) => m.id === selectedModel)?.name ||
                    selectedModel}
                </span>
                <ChevronDownIcon className={`w-4 h-4 text-[#00ff9f] transition-transform ${showModelSelector ? 'rotate-180' : ''}`} />
              </button>

              {/* 下拉菜单 */}
              {showModelSelector && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-[#0f1629]/95 backdrop-blur-xl rounded-xl shadow-2xl border border-[#00ff9f]/30 z-50 overflow-hidden">
                  <div className="p-3">
                    <div className="text-xs font-mono text-[#00ff9f] px-3 py-2 border-b border-[#00ff9f]/20 mb-2">
                      {'>'} 选择模型
                    </div>
                    {availableProviders.map((providerId) => {
                      const provider = PROVIDER_CONFIG[providerId];
                      if (!provider) return null;
                      return (
                        <div key={providerId} className="mb-2">
                          <div className="text-xs font-bold font-mono text-[#ff006e] px-3 py-1.5 bg-[#ff006e]/10 rounded-lg mb-1">
                            {provider.name}
                          </div>
                          {provider.models.map((model) => (
                            <button
                              key={model.id}
                              onClick={() => {
                                handleProviderChange(providerId);
                                setSelectedModel(model.id);
                                setShowModelSelector(false);
                              }}
                              className={`w-full text-left px-4 py-2.5 text-sm font-mono rounded-lg transition-all ${
                                selectedProvider === providerId && selectedModel === model.id
                                  ? 'bg-[#00ff9f]/20 text-[#00ff9f] border-l-2 border-[#00ff9f]'
                                  : 'text-gray-400 hover:text-gray-300 hover:bg-[#0a0e27]/50'
                              }`}
                            >
                              {model.name}
                            </button>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-5xl mx-auto space-y-5">
          {messages.length === 0 ? (
            <div className="bg-[#0f1629]/60 backdrop-blur-sm rounded-2xl shadow-2xl p-12 text-center border border-[#00ff9f]/20 relative overflow-hidden">
              {/* 装饰性角落 */}
              <div className="absolute top-0 left-0 w-20 h-20 border-t-2 border-l-2 border-[#00ff9f]/30 rounded-tl-2xl"></div>
              <div className="absolute bottom-0 right-0 w-20 h-20 border-b-2 border-r-2 border-[#ff006e]/30 rounded-br-2xl"></div>

              <div className="relative z-10">
                <div className="w-20 h-20 mx-auto mb-6 relative">
                  <SparklesIcon className="w-20 h-20 text-[#00ff9f]/50" />
                  <div className="absolute inset-0 blur-2xl bg-[#00ff9f] opacity-30 animate-pulse"></div>
                </div>
                <h2 className="text-3xl font-bold mb-3 text-transparent bg-clip-text bg-gradient-to-r from-[#00ff9f] to-[#00ffff]" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                  {'>'} 欢迎使用 K8s 运维助手
                </h2>
                <p className="text-gray-400 font-mono text-sm mb-8 max-w-2xl mx-auto leading-relaxed">
                  我可以帮你查询集群状态、诊断问题、执行运维操作等。所有高风险操作都需要你的确认。
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto">
                  {[
                    { title: '列出所有 Pod', desc: '查看集群中的所有 Pod', prompt: '列出所有命名空间下的 Pod' },
                    { title: '检查集群健康', desc: '诊断集群当前状态', prompt: '检查集群健康状态' },
                    { title: '查看 Deployment', desc: '查看部署情况', prompt: '查看 default 命名空间下的 Deployment' },
                    { title: '分析异常', desc: '查找潜在问题', prompt: '分析集群中的异常情况' },
                  ].map((item, idx) => (
                    <button
                      key={idx}
                      className="text-left p-4 bg-[#0a0e27]/50 hover:bg-[#0a0e27]/80 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-[#00ff9f]/20 hover:border-[#00ff9f]/50 group relative overflow-hidden"
                      onClick={() => setInputValue(item.prompt)}
                      disabled={!isConnected}
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-[#00ff9f]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      <div className="relative z-10">
                        <div className="font-bold text-[#00ff9f] text-sm mb-1 font-mono">{item.title}</div>
                        <div className="text-xs text-gray-500 font-mono">{item.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            messages.map((message) => <ChatMessage key={message.id} message={message} />)
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 输入框 - 终端风格 - 固定底部 */}
      <div className="flex-shrink-0 bg-[#0f1629]/90 backdrop-blur-xl border-t border-[#00ff9f]/20 px-6 py-5 relative">
        {/* 装饰性底部线条 */}
        <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#00ff9f] to-transparent"></div>

        <div className="max-w-5xl mx-auto flex gap-4">
          <div className="flex-1 relative">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isConnected
                  ? '> 输入你的问题... (Shift+Enter 换行，Enter 发送)'
                  : '> 等待连接...'
              }
              disabled={!isConnected || isLoading}
              className="w-full min-h-[70px] max-h-[200px] resize-none px-5 py-4 bg-[#0a0e27]/80 border-2 border-[#00ff9f]/30 rounded-xl text-gray-300 placeholder-gray-600 focus:outline-none focus:border-[#00ff9f] disabled:opacity-50 font-mono text-sm transition-all"
              style={{ caretColor: '#00ff9f' }}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!isConnected || isLoading || !inputValue.trim()}
            className="px-8 py-4 bg-gradient-to-r from-[#00ff9f] to-[#00ffff] text-[#0a0e27] font-bold rounded-xl hover:shadow-lg hover:shadow-[#00ff9f]/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 disabled:transform-none flex items-center justify-center relative overflow-hidden group"
            style={{ fontFamily: 'Rajdhani, sans-serif' }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700"></div>
            {isLoading ? (
              <ArrowPathIcon className="w-6 h-6 animate-spin relative z-10" />
            ) : (
              <PaperAirplaneIcon className="w-6 h-6 relative z-10" />
            )}
          </button>
        </div>

        {/* 状态栏 */}
        <div className="max-w-5xl mx-auto mt-3 flex items-center justify-between text-xs font-mono text-gray-600">
          <div className="flex items-center gap-4">
            <span className="text-[#00ff9f]">{'>'} {isConnected ? '在线' : '离线'}</span>
            <span className="text-gray-600">|</span>
            <span>{selectedProvider} / {selectedModel}</span>
          </div>
          <div className="flex items-center gap-2">
            {isLoading && (
              <span className="text-[#ff006e] animate-pulse">{'>'} 处理中...</span>
            )}
          </div>
        </div>
      </div>

      {/* 审批对话框 */}
      <ApprovalDialog
        request={approvalRequest}
        open={!!approvalRequest}
        onApprove={handleApprove}
        onReject={handleReject}
      />

      {/* 能力展示弹窗 */}
      {showCapabilities && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0f1629]/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-[#00ffff]/30 w-full max-w-4xl max-h-[80vh] overflow-hidden relative">
            {/* 装饰性线条 */}
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#00ffff] to-transparent"></div>

            {/* 头部 */}
            <div className="flex items-center justify-between p-6 border-b border-[#00ffff]/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#00ffff] to-[#00ffff]/50 flex items-center justify-center relative">
                  <WrenchScrewdriverIcon className="w-6 h-6 text-[#0a0e27] relative z-10" />
                  <div className="absolute inset-0 blur-xl bg-[#00ffff] opacity-50"></div>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#00ffff] to-white" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                    Agent 能力列表
                  </h2>
                  <p className="text-xs font-mono text-gray-400 mt-1">{'>'} 共 {tools.length} 个可用工具</p>
                </div>
              </div>
              <button
                onClick={() => setShowCapabilities(false)}
                className="w-10 h-10 rounded-lg bg-gray-700/30 hover:bg-gray-700/50 border border-gray-600/30 hover:border-gray-500/50 transition-all flex items-center justify-center"
              >
                <XMarkIcon className="w-6 h-6 text-gray-400 hover:text-gray-300" />
              </button>
            </div>

            {/* 内容区域 */}
            <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 100px)' }}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {['query', 'diagnostic', 'action', 'analysis'].map((category) => {
                  const categoryTools = tools.filter((t) => t.category === category);
                  if (categoryTools.length === 0) return null;

                  const categoryInfo = {
                    query: { label: '查询操作', icon: MagnifyingGlassIcon, color: '#00ff9f' },
                    diagnostic: { label: '诊断检查', icon: ShieldCheckIcon, color: '#00ffff' },
                    action: { label: '执行操作', icon: BoltIcon, color: '#ff006e' },
                    analysis: { label: '分析功能', icon: ChartBarIcon, color: '#ffaa00' },
                  }[category];

                  const Icon = categoryInfo?.icon || MagnifyingGlassIcon;

                  return (
                    <div key={category} className="bg-[#0a0e27]/50 rounded-xl p-4 border border-gray-700/30">
                      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-700/30">
                        <Icon className="w-5 h-5" style={{ color: categoryInfo?.color }} />
                        <h3 className="font-bold font-mono text-sm" style={{ color: categoryInfo?.color }}>
                          {categoryInfo?.label}
                        </h3>
                        <span className="ml-auto text-xs text-gray-500 font-mono">({categoryTools.length})</span>
                      </div>
                      <div className="space-y-2">
                        {categoryTools.map((tool) => {
                          const riskColors = {
                            low: '#00ff9f',
                            medium: '#ffaa00',
                            high: '#ff006e',
                            critical: '#ff0000',
                          };
                          const riskColor = riskColors[tool.riskLevel] || '#00ff9f';

                          return (
                            <div key={tool.name} className="p-3 bg-[#0a0e27]/30 rounded-lg border border-gray-700/20 hover:border-gray-600/40 transition-all">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <div className="font-mono text-sm font-bold text-gray-200">{tool.name}</div>
                                <div
                                  className="text-xs px-2 py-0.5 rounded font-mono font-bold"
                                  style={{
                                    backgroundColor: `${riskColor}20`,
                                    borderColor: `${riskColor}60`,
                                    color: riskColor,
                                    border: `1px solid`,
                                  }}
                                >
                                  {tool.riskLevel.toUpperCase()}
                                </div>
                              </div>
                              <p className="text-xs text-gray-400 font-mono leading-relaxed">{tool.description}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 添加自定义字体 */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
      `}</style>
    </div>
  );
}
