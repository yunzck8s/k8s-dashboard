import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PaperAirplaneIcon, SparklesIcon, Cog6ToothIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { ArrowPathIcon } from '@heroicons/react/24/solid';
import { ChatMessage } from '../../components/ChatMessage';
import { ApprovalDialog } from '../../components/ApprovalDialog';
import { useAgentChat } from '../../hooks/useAgentChat';
import type { Message, ApprovalRequest } from '../../types/agent';
import api from '../../api/client';

export default function AgentPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [approvalRequest, setApprovalRequest] = useState<ApprovalRequest | null>(null);
  const [pendingToolCallId, setPendingToolCallId] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const [isCheckingConfig, setIsCheckingConfig] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 检查配置状态
  useEffect(() => {
    checkConfiguration();
  }, []);

  const checkConfiguration = async () => {
    try {
      const response = await api.get('/agent/config');
      const config = response.data.config;
      // 检查是否至少有一个 provider 已配置 (*** 表示已配置)
      const hasConfiguredProvider = Object.values(config.providers || {}).some(
        (provider: any) => provider.apiKey === '***'
      );
      setIsConfigured(hasConfiguredProvider);
    } catch (error) {
      console.error('检查配置失败', error);
      setIsConfigured(false);
    } finally {
      setIsCheckingConfig(false);
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
              id: Date.now().toString(),
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
          id: Date.now().toString(),
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
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
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
      id: Date.now().toString(),
      role: 'user',
      content: inputValue.trim(),
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    sendMessage(inputValue.trim());
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

  // 加载中
  if (isCheckingConfig) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <ArrowPathIcon className="w-12 h-12 mx-auto mb-4 text-gray-400 animate-spin" />
          <p className="text-gray-600">检查配置中...</p>
        </div>
      </div>
    );
  }

  // 未配置提示
  if (!isConfigured) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-2xl w-full mx-auto px-6">
          <div className="bg-white rounded-xl shadow-lg p-8 border-2 border-yellow-200">
            <div className="text-center mb-6">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-yellow-100 flex items-center justify-center">
                <ExclamationTriangleIcon className="w-12 h-12 text-yellow-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">AI 助手未配置</h2>
              <p className="text-gray-600">
                使用 AI 助手功能前，需要先配置 LLM Provider API Key（如 OpenAI、DeepSeek、通义千问等）
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-6 mb-6">
              <h3 className="font-semibold text-gray-900 mb-3">配置步骤：</h3>
              <ol className="space-y-2 list-decimal list-inside text-gray-700">
                <li>前往设置页面的 "AI 助手" 标签</li>
                <li>选择你想使用的 LLM Provider（OpenAI、DeepSeek、通义千问、豆包）</li>
                <li>点击 Provider 卡片展开配置界面</li>
                <li>输入对应的 API Key 并保存</li>
                <li>返回此页面开始使用</li>
              </ol>
            </div>

            <div className="flex gap-3">
              <Link
                to="/settings"
                className="flex-1 py-3 px-6 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Cog6ToothIcon className="w-5 h-5" />
                <span>前往设置</span>
              </Link>
              <button
                onClick={checkConfiguration}
                className="py-3 px-6 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <ArrowPathIcon className="w-5 h-5" />
                <span>重新检查</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* 头部 */}
      <header className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <SparklesIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">AI 运维助手</h1>
              <p className="text-sm text-gray-500">
                {isConnected ? (
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    已连接
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                    未连接
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <SparklesIcon className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                你好！我是 K8s 运维助手
              </h2>
              <p className="text-gray-600 mb-6">
                我可以帮你查询集群状态、诊断问题、执行运维操作等。试试问我：
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl mx-auto">
                <button
                  className="text-left p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                  onClick={() => setInputValue('列出所有命名空间下的 Pod')}
                >
                  <div className="font-medium text-gray-900 text-sm">列出所有 Pod</div>
                  <div className="text-xs text-gray-500 mt-1">查看集群中的所有 Pod</div>
                </button>
                <button
                  className="text-left p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                  onClick={() => setInputValue('检查集群健康状态')}
                >
                  <div className="font-medium text-gray-900 text-sm">检查集群健康</div>
                  <div className="text-xs text-gray-500 mt-1">诊断集群当前状态</div>
                </button>
                <button
                  className="text-left p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                  onClick={() => setInputValue('查看 default 命名空间下的 Deployment')}
                >
                  <div className="font-medium text-gray-900 text-sm">查看 Deployment</div>
                  <div className="text-xs text-gray-500 mt-1">查看部署情况</div>
                </button>
                <button
                  className="text-left p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                  onClick={() => setInputValue('分析集群中的异常情况')}
                >
                  <div className="font-medium text-gray-900 text-sm">分析异常</div>
                  <div className="text-xs text-gray-500 mt-1">查找潜在问题</div>
                </button>
              </div>
            </div>
          ) : (
            messages.map((message) => <ChatMessage key={message.id} message={message} />)
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 输入框 */}
      <div className="bg-white border-t px-6 py-4">
        <div className="max-w-4xl mx-auto flex gap-3">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isConnected
                ? '输入你的问题... (Shift+Enter 换行，Enter 发送)'
                : '等待连接...'
            }
            disabled={!isConnected || isLoading}
            className="flex-1 min-h-[60px] max-h-[200px] resize-none px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          />
          <button
            onClick={handleSend}
            disabled={!isConnected || isLoading || !inputValue.trim()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isLoading ? (
              <ArrowPathIcon className="w-5 h-5 animate-spin" />
            ) : (
              <PaperAirplaneIcon className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

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
