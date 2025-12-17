import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClientMessage, ServerMessage, ApprovalRequest, TodosUpdate, SubAgentEvent, AgentFeatures } from '../types/agent';

// Python Agent 服务地址（开发环境直连，生产环境走反向代理）
const PYTHON_AGENT_URL = import.meta.env.VITE_PYTHON_AGENT_URL || 'localhost:8000';

// localStorage keys
const SESSION_ID_KEY = 'agent_session_id';
const MESSAGES_KEY = 'agent_messages';

interface UseAgentChatOptions {
  useDeepAgent?: boolean; // 是否使用 Deep Agent 模式
  onMessage?: (content: string) => void;
  onToolCall?: (toolCall: any) => void;
  onToolResult?: (result: any) => void;
  onApprovalRequest?: (request: ApprovalRequest) => void;
  onTodosUpdate?: (todos: TodosUpdate) => void;       // DeepAgent 特性
  onSubAgentEvent?: (event: SubAgentEvent) => void;   // DeepAgent 特性
  onError?: (error: string) => void;
  onSessionCreated?: (sessionId: string) => void;
  onHistoryLoaded?: (messages: any[]) => void;  // 加载历史时回调
}

export function useAgentChat(options: UseAgentChatOptions = {}) {
  const { useDeepAgent = false } = options;
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(() => {
    // 从 localStorage 恢复 sessionId
    return localStorage.getItem(SESSION_ID_KEY);
  });
  const wsRef = useRef<WebSocket | null>(null);
  const sessionIdRef = useRef<string | null>(sessionId);
  const messageBufferRef = useRef<string>('');
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  // 同步 sessionIdRef 和 state
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  // 使用 ref 存储回调函数，避免重新创建连接
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // 获取 WebSocket URL（连接到 Python Agent 服务）
  const getWebSocketUrl = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const token = localStorage.getItem('token');
    // 直连 Python Agent WebSocket
    return `${protocol}//${PYTHON_AGENT_URL}/ws/chat${token ? `?token=${token}` : ''}`;
  }, []);

  // 连接 WebSocket
  const connect = useCallback(() => {
    // 如果已经连接或正在连接中，直接返回
    if (wsRef.current?.readyState === WebSocket.OPEN ||
        wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    const wsUrl = getWebSocketUrl();
    console.log('[AgentChat] Connecting to Python Agent:', wsUrl);

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('[AgentChat] WebSocket connected');
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const message: ServerMessage = JSON.parse(event.data);

        switch (message.type) {
          case 'session':
            if (message.sessionId) {
              sessionIdRef.current = message.sessionId;
              setSessionId(message.sessionId);
              // 持久化到 localStorage
              localStorage.setItem(SESSION_ID_KEY, message.sessionId);
              optionsRef.current.onSessionCreated?.(message.sessionId);
            }
            break;

          case 'chunk':
            if (message.content) {
              messageBufferRef.current += message.content;
              optionsRef.current.onMessage?.(messageBufferRef.current);
            }
            break;

          case 'tool_call':
            if (message.toolCall) {
              optionsRef.current.onToolCall?.(message.toolCall);
            }
            break;

          case 'tool_result':
            if (message.toolResult) {
              optionsRef.current.onToolResult?.(message.toolResult);
            }
            break;

          case 'approval_request':
            if (message.approvalRequest) {
              optionsRef.current.onApprovalRequest?.(message.approvalRequest);
            }
            break;

          case 'todos_update':
            // DeepAgent 特性：TodoList 更新
            if (message.todosUpdate) {
              optionsRef.current.onTodosUpdate?.(message.todosUpdate);
            }
            break;

          case 'subagent_event':
            // DeepAgent 特性：子 Agent 事件
            if (message.subagentEvent) {
              optionsRef.current.onSubAgentEvent?.(message.subagentEvent);
            }
            break;

          case 'done':
            setIsLoading(false);
            messageBufferRef.current = '';
            break;

          case 'error':
            setIsLoading(false);
            optionsRef.current.onError?.(message.error || 'Unknown error');
            messageBufferRef.current = '';
            break;
        }
      } catch (error) {
        console.error('[AgentChat] Failed to parse message:', error);
        optionsRef.current.onError?.('Failed to parse server message');
      }
    };

    ws.onerror = (error) => {
      console.error('[AgentChat] WebSocket error:', error);
      // 连接错误不需要显示在聊天界面，因为头部已经有连接状态指示器
      // 只在控制台记录日志，避免干扰用户
      setIsConnected(false);
    };

    ws.onclose = (event) => {
      console.log('[AgentChat] WebSocket closed, code:', event.code);
      setIsConnected(false);
      wsRef.current = null;

      // 自动重连（如果组件仍然挂载且不是正常关闭）
      if (mountedRef.current && event.code !== 1000) {
        console.log('[AgentChat] Will reconnect in 2 seconds...');
        reconnectTimeoutRef.current = setTimeout(() => {
          if (mountedRef.current) {
            connect();
          }
        }, 2000);
      }
    };

    wsRef.current = ws;
  }, [getWebSocketUrl]);

  // 断开连接
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
      setIsConnected(false);
    }
  }, []);

  // 将 camelCase features 转换为 snake_case（Python 后端格式）
  const convertFeaturesToSnakeCase = (features?: AgentFeatures) => {
    if (!features) return undefined;
    return {
      enable_planning: features.enablePlanning,
      enable_filesystem: features.enableFilesystem,
      enable_subagents: features.enableSubagents,
      enable_memory: features.enableMemory,
    };
  };

  // 发送消息
  const sendMessage = useCallback(
    (content: string, provider?: string, model?: string, features?: AgentFeatures) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        optionsRef.current.onError?.('WebSocket is not connected');
        return;
      }

      // 构建符合 Python 后端格式的消息
      const message = {
        type: 'message',
        content,
        session_id: sessionIdRef.current || undefined,
        provider,
        model,
        use_deep_agent: useDeepAgent,
        features: convertFeaturesToSnakeCase(features),
      };

      wsRef.current.send(JSON.stringify(message));
      setIsLoading(true);
      messageBufferRef.current = '';
    },
    [useDeepAgent]
  );

  // 发送审批响应
  const sendApproval = useCallback(
    (toolCallId: string, approved: boolean) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        optionsRef.current.onError?.('WebSocket is not connected');
        return;
      }

      const message = {
        type: 'approval',
        session_id: sessionIdRef.current,
        tool_call_id: toolCallId,
        decision: approved ? 'approve' : 'reject',
      };

      wsRef.current.send(JSON.stringify(message));
    },
    []
  );

  // 取消当前操作
  const cancel = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    const message = {
      type: 'cancel',
      session_id: sessionIdRef.current,
    };

    wsRef.current.send(JSON.stringify(message));
    setIsLoading(false);
  }, []);

  // 新建对话（清除当前会话）
  const newSession = useCallback(() => {
    // 清除 localStorage
    localStorage.removeItem(SESSION_ID_KEY);
    localStorage.removeItem(MESSAGES_KEY);
    // 清除内存中的 sessionId
    sessionIdRef.current = null;
    setSessionId(null);
    console.log('[AgentChat] New session started');
  }, []);

  // 保存消息到 localStorage
  const saveMessages = useCallback((messages: any[]) => {
    try {
      localStorage.setItem(MESSAGES_KEY, JSON.stringify(messages));
    } catch (error) {
      console.error('[AgentChat] Failed to save messages:', error);
    }
  }, []);

  // 加载保存的消息
  const loadMessages = useCallback((): any[] => {
    try {
      const saved = localStorage.getItem(MESSAGES_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.error('[AgentChat] Failed to load messages:', error);
    }
    return [];
  }, []);

  // 组件挂载时自动连接
  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      // 清理重连定时器
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected,
    isLoading,
    useDeepAgent,
    sessionId,
    sendMessage,
    sendApproval,
    cancel,
    connect,
    disconnect,
    newSession,
    saveMessages,
    loadMessages,
  };
}
