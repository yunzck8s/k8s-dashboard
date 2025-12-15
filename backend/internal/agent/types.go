package agent

import (
	"time"

	"github.com/k8s-dashboard/backend/internal/agent/provider"
	"github.com/k8s-dashboard/backend/internal/agent/tools"
)

// Session 聊天会话
type Session struct {
	ID        string             `json:"id"`
	UserID    string             `json:"userId"`
	Title     string             `json:"title"`
	Provider  string             `json:"provider"`
	Model     string             `json:"model"`
	Messages  []provider.Message `json:"messages,omitempty"`
	CreatedAt time.Time          `json:"createdAt"`
	UpdatedAt time.Time          `json:"updatedAt"`
}

// ClientMessage 客户端 WebSocket 消息
type ClientMessage struct {
	Type       string `json:"type"` // message, approval, cancel
	SessionID  string `json:"sessionId,omitempty"`
	Content    string `json:"content,omitempty"`
	Provider   string `json:"provider,omitempty"`
	Model      string `json:"model,omitempty"`
	ToolCallID string `json:"toolCallId,omitempty"`
	Approved   bool   `json:"approved,omitempty"`
}

// ServerMessage 服务端 WebSocket 消息
type ServerMessage struct {
	Type            string                `json:"type"` // session, chunk, tool_call, tool_result, approval_request, done, error
	SessionID       string                `json:"sessionId,omitempty"`
	Content         string                `json:"content,omitempty"`
	ToolCall        *provider.ToolCall    `json:"toolCall,omitempty"`
	ToolResult      *ToolResult           `json:"toolResult,omitempty"`
	ApprovalRequest *ApprovalRequest      `json:"approvalRequest,omitempty"`
	Error           string                `json:"error,omitempty"`
}

// ToolResult 工具执行结果
type ToolResult struct {
	ToolCallID string `json:"toolCallId"`
	Success    bool   `json:"success"`
	Result     string `json:"result,omitempty"`
	Error      string `json:"error,omitempty"`
}

// ApprovalRequest 审批请求
type ApprovalRequest struct {
	ToolCallID  string                 `json:"toolCallId"`
	ToolName    string                 `json:"toolName"`
	Description string                 `json:"description"`
	Impact      string                 `json:"impact"`
	RiskLevel   tools.RiskLevel        `json:"riskLevel"`
	Arguments   map[string]interface{} `json:"arguments"`
}

// ChatRequest 聊天请求
type ChatRequest struct {
	SessionID string             `json:"sessionId,omitempty"`
	Messages  []provider.Message `json:"messages"`
	Provider  string             `json:"provider"`
	Model     string             `json:"model"`
	Stream    bool               `json:"stream"`
}

// ChatResponse 聊天响应
type ChatResponse struct {
	SessionID string           `json:"sessionId"`
	Message   provider.Message `json:"message"`
}

// AgentConfig Agent 配置
type AgentConfig struct {
	Providers       map[string]provider.ProviderConfig `json:"providers"`
	DefaultProvider string                             `json:"defaultProvider"`
	DefaultModel    string                             `json:"defaultModel"`
	SystemPrompt    string                             `json:"systemPrompt"`
}
