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

  // 连接 WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
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
              options.onSessionCreated?.(message.sessionId);
            }
            break;

          case 'chunk':
            if (message.content) {
              messageBufferRef.current += message.content;
              options.onMessage?.(messageBufferRef.current);
            }
            break;

          case 'tool_call':
            if (message.toolCall) {
              options.onToolCall?.(message.toolCall);
            }
            break;

          case 'tool_result':
            if (message.toolResult) {
              options.onToolResult?.(message.toolResult);
            }
            break;

          case 'approval_request':
            if (message.approvalRequest) {
              options.onApprovalRequest?.(message.approvalRequest);
            }
            break;

          case 'done':
            setIsLoading(false);
            messageBufferRef.current = '';
            break;

          case 'error':
            setIsLoading(false);
            options.onError?.(message.error || 'Unknown error');
            messageBufferRef.current = '';
            break;
        }
      } catch (error) {
        console.error('[AgentChat] Failed to parse message:', error);
        options.onError?.('Failed to parse server message');
      }
    };

    ws.onerror = (error) => {
      console.error('[AgentChat] WebSocket error:', error);
      options.onError?.('WebSocket connection error');
      setIsConnected(false);
    };

    ws.onclose = () => {
      console.log('[AgentChat] WebSocket closed');
      setIsConnected(false);
      wsRef.current = null;
    };

    wsRef.current = ws;
  }, [options]);

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
        options.onError?.('WebSocket is not connected');
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
    [options]
  );

  // 发送审批响应
  const sendApproval = useCallback(
    (toolCallId: string, approved: boolean) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        options.onError?.('WebSocket is not connected');
        return;
      }

      const message: ClientMessage = {
        type: 'approval',
        toolCallId,
        approved,
      };

      wsRef.current.send(JSON.stringify(message));
    },
    [options]
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
    connect();
    return () => {
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
