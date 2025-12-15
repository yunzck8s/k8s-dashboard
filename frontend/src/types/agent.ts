// AI Agent 类型定义

// 消息角色
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

// 聊天消息
export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  toolCalls?: ToolCall[];
  createdAt: string;
}

// 工具调用
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
  status: string;
  result?: string;
  error?: string;
}

// 会话
export interface Session {
  id: string;
  userId?: string;
  title: string;
  provider: string;
  model: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

// 提供商信息
export interface ProviderInfo {
  name: string;
  displayName: string;
  models: Model[];
  supportsTools: boolean;
  supportsStream: boolean;
  enabled: boolean;
}

// 模型信息
export interface Model {
  id: string;
  name: string;
  maxTokens: number;
  priceInput: number;
  priceOutput: number;
}

// K8s 工具
export interface K8sTool {
  name: string;
  description: string;
  category: ToolCategory;
  riskLevel: RiskLevel;
}

// 工具类别
export type ToolCategory = 'query' | 'diagnostic' | 'action' | 'analysis';

// 风险等级
export type RiskLevel = 'low' | 'medium' | 'high';

// 审批请求
export interface ApprovalRequest {
  toolCallId: string;
  toolName: string;
  description: string;
  impact: string;
  riskLevel: RiskLevel;
  arguments: Record<string, any>;
}

// 工具结果
export interface ToolResult {
  toolCallId: string;
  success: boolean;
  result?: string;
  error?: string;
}

// WebSocket 客户端消息
export interface ClientMessage {
  type: 'message' | 'approval' | 'cancel';
  sessionId?: string;
  content?: string;
  provider?: string;
  model?: string;
  toolCallId?: string;
  approved?: boolean;
}

// WebSocket 服务端消息
export interface ServerMessage {
  type: 'session' | 'chunk' | 'tool_call' | 'tool_result' | 'approval_request' | 'done' | 'error';
  sessionId?: string;
  content?: string;
  toolCall?: ToolCall;
  toolResult?: ToolResult;
  approvalRequest?: ApprovalRequest;
  error?: string;
}

// Agent 配置
export interface AgentConfig {
  providers: Record<string, ProviderConfig>;
  defaultProvider: string;
  defaultModel: string;
  systemPrompt?: string;
}

// 提供商配置
export interface ProviderConfig {
  enabled: boolean;
  apiKey?: string;
  baseURL?: string;
  models?: string[];
}
