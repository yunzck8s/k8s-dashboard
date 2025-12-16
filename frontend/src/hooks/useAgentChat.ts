import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClientMessage, ServerMessage, ApprovalRequest } from '../types/agent';

interface UseAgentChatOptions {
  onMessage?: (content: string) => void;
  onToolCall?: (toolCall: any) => void;
  onToolResult?: (result: any) => void;
  onApprovalRequest?: (request: ApprovalRequest) => void;
  onError?: (error: string) => void;
  onSessionCreated?: (sessionId: string) => void;
}

export function useAgentChat(options: UseAgentChatOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const messageBufferRef = useRef<string>('');
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  // 使用 ref 存储回调函数，避免重新创建连接
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // 连接 WebSocket
  const connect = useCallback(() => {
    // 如果已经连接或正在连接中，直接返回
    if (wsRef.current?.readyState === WebSocket.OPEN ||
        wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // 从 localStorage 获取 token 并作为查询参数传递
    const token = localStorage.getItem('token');
    const wsUrl = `${protocol}//${window.location.host}/ws/agent/chat${token ? `?token=${token}` : ''}`;

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
  }, []);

  // 断开连接
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
      setIsConnected(false);
    }
  }, []);

  // 发送消息
  const sendMessage = useCallback(
    (content: string, provider?: string, model?: string) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        optionsRef.current.onError?.('WebSocket is not connected');
        return;
      }

      const message: ClientMessage = {
        type: 'message',
        content,
        sessionId: sessionIdRef.current || undefined,
        provider,
        model,
      };

      wsRef.current.send(JSON.stringify(message));
      setIsLoading(true);
      messageBufferRef.current = '';
    },
    []
  );

  // 发送审批响应
  const sendApproval = useCallback(
    (toolCallId: string, approved: boolean) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        optionsRef.current.onError?.('WebSocket is not connected');
        return;
      }

      const message: ClientMessage = {
        type: 'approval',
        toolCallId,
        approved,
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

    const message: ClientMessage = {
      type: 'cancel',
    };

    wsRef.current.send(JSON.stringify(message));
    setIsLoading(false);
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
    sessionId: sessionIdRef.current,
    sendMessage,
    sendApproval,
    cancel,
    connect,
    disconnect,
  };
}
