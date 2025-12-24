import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChatMessage } from '../../components/ChatMessage';
import { ApprovalDialog } from '../../components/ApprovalDialog';
import { useAgentChat } from '../../hooks/useAgentChat';
import type { Message, ApprovalRequest } from '../../types/agent';

// Python Agent 服务地址
const PYTHON_AGENT_API = import.meta.env.VITE_PYTHON_AGENT_URL || 'http://localhost:8000';

// 生成唯一 ID
let messageIdCounter = 0;
const generateMessageId = () => {
  messageIdCounter += 1;
  return `${Date.now()}-${messageIdCounter}-${Math.random().toString(36).slice(2, 8)}`;
};

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
  const [showSettings, setShowSettings] = useState(false);
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
  }, []);

  const checkConfiguration = async () => {
    try {
      const response = await fetch(`${PYTHON_AGENT_API}/api/providers?enabled_only=true`);
      if (!response.ok) {
        throw new Error('Failed to fetch providers');
      }
      const providers = await response.json();
      const configuredProviders = providers.map((p: any) => p.provider_type);

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
      setIsConfigured(true);
      setSelectedProvider('deepseek');
      setSelectedModel('deepseek-chat');
    } finally {
      setIsCheckingConfig(false);
    }
  };

  const { isConnected, isLoading, sendMessage, sendApproval, newSession } = useAgentChat({
    useDeepAgent: false,
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

  const handleNewChat = () => {
    newSession();
    setMessages([]);
  };

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

  // 加载中状态
  if (isCheckingConfig) {
    return (
      <div className="flex items-center justify-center h-full bg-[#0a0e27]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <p className="text-slate-400">正在初始化...</p>
        </div>
      </div>
    );
  }

  // 未配置提示
  if (!isConfigured) {
    return (
      <div className="flex items-center justify-center h-full bg-[#0a0e27] p-4">
        <div className="max-w-md w-full bg-[#111a22] rounded-xl shadow-2xl p-6 border border-[#233648]">
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-500/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-amber-500 text-3xl">warning</span>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">系统未配置</h2>
            <p className="text-slate-400 text-sm">需要配置 LLM Provider 才能使用 AI 助手</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowSettings(true)}
              className="flex-1 py-2.5 px-4 bg-primary hover:bg-primary/90 text-white font-semibold rounded-lg transition-all text-center text-sm"
            >
              打开设置
            </button>
            <button
              onClick={checkConfiguration}
              className="py-2.5 px-4 bg-[#233648] hover:bg-[#2e4559] text-slate-300 font-semibold rounded-lg transition-all text-sm"
            >
              重新检查
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex bg-[#0a0e27] overflow-hidden relative">
      <div className="flex w-full h-full bg-[#111a22] overflow-hidden">
        {/* 侧边栏 */}
        <aside className="w-56 bg-[#0b1116] border-r border-[#233648] flex flex-col flex-shrink-0">
          <div className="p-3 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h1 className="text-xs font-bold text-slate-200 tracking-tight">历史记录</h1>
              <button className="text-slate-400 hover:text-slate-200 transition-colors">
                <span className="material-symbols-outlined text-[18px]">search</span>
              </button>
            </div>
            <button
              onClick={handleNewChat}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-primary hover:bg-blue-600 text-white rounded-lg shadow-sm transition-all"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span className="text-xs font-semibold">新对话</span>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-3">
            <div className="text-[10px] text-slate-500 px-3 py-2">暂无历史记录</div>
          </div>
        </aside>

        {/* 主内容区 */}
        <div className="flex-1 flex flex-col h-full min-w-0 bg-[#111a22]">
          {/* 头部 */}
          <header className="flex items-center justify-between px-4 py-2.5 border-b border-[#233648] bg-[#111a22] shrink-0">
            <div className="flex items-center gap-3">
              <div className="relative flex items-center justify-center size-9 rounded-full bg-primary/10 text-primary shrink-0">
                <span className="material-symbols-outlined text-[20px]">smart_toy</span>
                <span className={`absolute bottom-0 right-0 size-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-red-500'} border-2 border-[#111a22]`}></span>
              </div>
              <div className="flex flex-col">
                <h2 className="text-sm font-bold leading-none">K8s Copilot</h2>
                <div className="flex items-center gap-1.5 mt-1 text-[10px]">
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${isConnected ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                    {isConnected ? '在线' : '离线'}
                  </span>
                </div>
              </div>

              {/* Provider 选择器 */}
              <div className="flex items-center gap-2 ml-3 pl-3 border-l border-[#233648] relative" ref={modelSelectorRef}>
                <button
                  onClick={() => setShowModelSelector(!showModelSelector)}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#233648] border border-primary/30 hover:bg-[#2e4559] transition-colors text-[11px] font-medium"
                >
                  <span className="material-symbols-outlined text-[14px] text-primary">psychology</span>
                  <span className="text-white">{PROVIDER_CONFIG[selectedProvider]?.name || selectedProvider}</span>
                  <span className="material-symbols-outlined text-[14px] text-slate-500">{showModelSelector ? 'expand_less' : 'expand_more'}</span>
                </button>

                {/* 下拉菜单 */}
                {showModelSelector && (
                  <div className="absolute top-full left-0 mt-2 w-56 bg-[#1c2a38] border border-[#2e4559] rounded-xl shadow-2xl z-50 overflow-hidden">
                    <div className="p-1.5 space-y-0.5">
                      {availableProviders.map((providerId) => {
                        const provider = PROVIDER_CONFIG[providerId];
                        if (!provider) return null;
                        return (
                          <div key={providerId}>
                            {provider.models.map((model) => (
                              <button
                                key={model.id}
                                onClick={() => {
                                  setSelectedProvider(providerId);
                                  setSelectedModel(model.id);
                                  setShowModelSelector(false);
                                }}
                                className={`w-full flex items-center justify-between px-2.5 py-2 text-left rounded-lg transition-all text-xs ${
                                  selectedProvider === providerId && selectedModel === model.id
                                    ? 'bg-primary/10 text-primary border-l-2 border-primary'
                                    : 'text-slate-300 hover:bg-[#233648]'
                                }`}
                              >
                                <span>{provider.name} - {model.name}</span>
                                {selectedProvider === providerId && selectedModel === model.id && (
                                  <span className="material-symbols-outlined text-primary text-[14px]">check_circle</span>
                                )}
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

            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowSettings(true)}
                className="flex items-center justify-center size-8 rounded-lg hover:bg-[#233648] text-slate-400 hover:text-slate-300 transition-colors"
                title="设置"
              >
                <span className="material-symbols-outlined text-[18px]">settings</span>
              </button>
              <div className="w-px h-4 bg-[#233648] mx-1"></div>
              <button className="flex items-center justify-center size-8 rounded-lg hover:bg-[#233648] text-slate-400 hover:text-slate-300 transition-colors">
                <span className="material-symbols-outlined text-[18px]">delete</span>
              </button>
            </div>
          </header>

          {/* 消息列表 */}
          <main className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#111a22] custom-scrollbar">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="w-16 h-16 mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary text-4xl">smart_toy</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">欢迎使用 K8s Copilot</h3>
                <p className="text-slate-400 text-sm mb-6 max-w-md">
                  我可以帮你管理集群、诊断问题、执行操作。所有危险操作都需要你的确认。
                </p>
                <div className="grid grid-cols-2 gap-2 max-w-2xl w-full">
                  {[
                    '列出所有 Pod',
                    '检查集群健康',
                    '查看 Deployment',
                    '分析异常',
                  ].map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => setInputValue(prompt)}
                      className="px-3 py-2.5 bg-[#233648] hover:bg-[#2e4559] rounded-lg border border-[#2e4559] text-left transition-all"
                    >
                      <span className="text-xs font-medium text-slate-300">{prompt}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((message) => (
                  <ChatMessage key={message.id} message={message} />
                ))}
                <div ref={messagesEndRef} />
              </>
            )}
          </main>

          {/* 输入框 */}
          <footer className="p-3 border-t border-[#233648] bg-[#111a22] shrink-0">
            <div className="relative flex items-end gap-2 bg-[#1c2a38] p-1.5 rounded-xl border border-[#2e4559] focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all">
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full bg-transparent border-none text-white placeholder-slate-500 focus:ring-0 text-sm py-2.5 px-2.5 resize-none max-h-32 outline-none"
                placeholder="输入你的问题..."
                rows={1}
                disabled={!isConnected || isLoading}
              />
              <button
                onClick={handleSend}
                disabled={!isConnected || isLoading || !inputValue.trim()}
                className="p-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shrink-0 mb-0.5"
              >
                <span className="material-symbols-outlined text-[20px]">
                  {isLoading ? 'progress_activity' : 'arrow_upward'}
                </span>
              </button>
            </div>
            <div className="text-center mt-2">
              <p className="text-[9px] font-medium text-slate-600">
                AI 可能会犯错，请验证生成的命令
              </p>
            </div>
          </footer>
        </div>
      </div>

      {/* 设置侧边栏 */}
      {showSettings && (
        <>
          {/* 背景遮罩 */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={() => setShowSettings(false)}
          />

          {/* 设置面板 */}
          <div className="fixed right-0 top-0 w-full md:w-[420px] h-full flex flex-col border-l border-[#324d67] bg-[#101922] shadow-2xl z-50 animate-in slide-in-from-right">
            {/* 头部 */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#324d67] shrink-0">
              <div className="flex flex-col">
                <h1 className="text-white text-xl font-bold leading-tight tracking-tight">Assistant Settings</h1>
                <p className="text-[#92adc9] text-xs font-normal mt-1">Configure your AI companion</p>
              </div>
              <button
                onClick={() => setShowSettings(false)}
                className="text-[#92adc9] hover:text-white transition-colors p-2 rounded-full hover:bg-[#192633]"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* 内容区 */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
              {/* Model Configuration */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <span className="material-symbols-outlined text-primary text-xl">smart_toy</span>
                  <h2 className="text-white text-base font-bold tracking-tight">Model Configuration</h2>
                </div>
                <div className="space-y-5">
                  <div className="flex flex-col">
                    <label className="text-[#92adc9] text-sm font-medium mb-2">AI Model</label>
                    <div className="relative">
                      <select className="appearance-none w-full bg-[#192633] border border-[#324d67] text-white text-sm rounded-lg focus:ring-1 focus:ring-primary focus:border-primary block p-3 pr-10 outline-none transition-all">
                        <option value="gpt-4">Kube-GPT-4 (Recommended)</option>
                        <option value="gpt-3.5">GPT-3.5 Turbo (Faster)</option>
                        <option value="llama-2">Llama 2 (Local)</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[#92adc9]">
                        <span className="material-symbols-outlined text-lg">expand_more</span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <div className="h-px bg-[#324d67]/50 w-full"></div>

              {/* Provider Settings */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <span className="material-symbols-outlined text-primary text-xl">extension</span>
                  <h2 className="text-white text-base font-bold tracking-tight">Provider Settings</h2>
                </div>
                <div className="space-y-4">
                  <p className="text-[#92adc9] text-xs mb-3">Configure API keys for external model providers.</p>
                  <Link
                    to="/settings"
                    className="block w-full p-3 bg-[#192633] hover:bg-[#192633]/80 border border-[#324d67] rounded-lg text-white text-sm font-medium transition-colors text-center"
                  >
                    前往完整设置页面
                  </Link>
                </div>
              </section>

              <div className="h-px bg-[#324d67]/50 w-full"></div>

              {/* Security & Context */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <span className="material-symbols-outlined text-primary text-xl">shield_lock</span>
                  <h2 className="text-white text-base font-bold tracking-tight">Security & Context</h2>
                </div>
                <div className="space-y-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-white text-sm font-medium">Read-only Mode</span>
                      <span className="text-[#92adc9] text-xs leading-relaxed">Prevent the assistant from applying YAML changes or deleting resources.</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-[#192633] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary border border-[#324d67]"></div>
                    </label>
                  </div>
                </div>
              </section>

              <div className="h-px bg-[#324d67]/50 w-full"></div>

              {/* About */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <span className="material-symbols-outlined text-primary text-xl">info</span>
                  <h2 className="text-white text-base font-bold tracking-tight">About</h2>
                </div>
                <div className="bg-[#192633]/50 rounded-lg p-4 border border-[#324d67]/50 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-primary text-lg">smart_toy</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-white text-sm font-medium">K8s Copilot</h3>
                      <p className="text-[#92adc9] text-xs mt-1 leading-relaxed">
                        Your intelligent companion for cluster management, offering real-time insights and automated resource optimization.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              <div className="h-4"></div>
            </div>

            {/* 底部按钮 */}
            <div className="p-6 border-t border-[#324d67] bg-[#101922] shrink-0">
              <div className="flex items-center gap-4">
                <button className="flex-1 px-4 py-3 rounded-lg text-sm font-medium text-[#92adc9] hover:text-white hover:bg-[#192633] transition-colors">
                  Reset Defaults
                </button>
                <button className="flex-1 px-4 py-3 rounded-lg text-sm font-medium text-white bg-primary hover:bg-blue-600 transition-colors shadow-lg shadow-blue-900/20">
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 审批对话框 */}
      <ApprovalDialog
        request={approvalRequest}
        open={!!approvalRequest}
        onApprove={handleApprove}
        onReject={handleReject}
      />
    </div>
  );
}
