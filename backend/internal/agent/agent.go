package agent

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/k8s-dashboard/backend/internal/agent/provider"
	"github.com/k8s-dashboard/backend/internal/agent/tools"
	"github.com/k8s-dashboard/backend/internal/k8s"
)

// Agent AI Agent 核心
type Agent struct {
	providers    *provider.Registry
	tools        *tools.Registry
	sessions     map[string]*Session
	config       *AgentConfig
	configStore  *ConfigStore
	k8sClient    *k8s.Client
	mu           sync.RWMutex
	systemPrompt string
}

// NewAgent 创建 Agent
func NewAgent(k8sClient *k8s.Client, config *AgentConfig, configStore *ConfigStore) *Agent {
	a := &Agent{
		providers:   provider.NewRegistry(),
		sessions:    make(map[string]*Session),
		config:      config,
		configStore: configStore,
		k8sClient:   k8sClient,
		systemPrompt: `你是一个 Kubernetes 集群运维助手。你可以帮助用户：
1. 查询集群资源状态（Pod、Deployment、Service、Node 等）
2. 诊断问题（分析日志、检查健康状态、排查故障）
3. 执行运维操作（扩缩容、重启、删除等，需要用户确认）
4. 提供 Kubernetes 相关的知识和建议

在执行任何操作前，请先了解用户的具体需求。对于可能影响集群的操作，请先说明影响并等待用户确认。
回答时请使用中文，保持简洁明了。`,
	}

	// 初始化工具注册表
	a.tools = tools.NewRegistry(k8sClient)

	// 注册 LLM Providers
	if config != nil {
		for name, cfg := range config.Providers {
			switch name {
			case "openai":
				a.providers.Register(provider.NewOpenAIProvider(cfg))
			case "deepseek":
				a.providers.Register(provider.NewDeepSeekProvider(cfg))
			case "qwen":
				a.providers.Register(provider.NewQwenProvider(cfg))
			case "doubao":
				a.providers.Register(provider.NewDoubaoProvider(cfg))
			}
		}

		if config.SystemPrompt != "" {
			a.systemPrompt = config.SystemPrompt
		}
	}

	return a
}

// GetProviders 获取可用的提供商列表
func (a *Agent) GetProviders() []provider.ProviderInfo {
	return a.providers.List()
}

// CreateSession 创建新会话
func (a *Agent) CreateSession(userID, providerName, model string) (*Session, error) {
	session := &Session{
		ID:        uuid.New().String(),
		UserID:    userID,
		Provider:  providerName,
		Model:     model,
		Messages:  []provider.Message{},
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	a.mu.Lock()
	a.sessions[session.ID] = session
	a.mu.Unlock()

	return session, nil
}

// GetSession 获取会话
func (a *Agent) GetSession(sessionID string) (*Session, bool) {
	a.mu.RLock()
	defer a.mu.RUnlock()
	session, ok := a.sessions[sessionID]
	return session, ok
}

// DeleteSession 删除会话
func (a *Agent) DeleteSession(sessionID string) {
	a.mu.Lock()
	delete(a.sessions, sessionID)
	a.mu.Unlock()
}

// Chat 处理聊天请求
func (a *Agent) Chat(ctx context.Context, req *ChatRequest) (*ChatResponse, error) {
	// 获取 Provider
	p, ok := a.providers.Get(req.Provider)
	if !ok {
		return nil, fmt.Errorf("provider not found: %s", req.Provider)
	}

	// 获取或创建会话
	var session *Session
	if req.SessionID != "" {
		session, ok = a.GetSession(req.SessionID)
		if !ok {
			return nil, fmt.Errorf("session not found: %s", req.SessionID)
		}
	} else {
		var err error
		session, err = a.CreateSession("", req.Provider, req.Model)
		if err != nil {
			return nil, err
		}
	}

	// 添加用户消息到会话
	for _, msg := range req.Messages {
		session.Messages = append(session.Messages, provider.Message{
			ID:        uuid.New().String(),
			Role:      msg.Role,
			Content:   msg.Content,
			ToolCalls: msg.ToolCalls,
			CreatedAt: time.Now(),
		})
	}

	// 调用 LLM
	response, err := p.Chat(ctx, session.Messages, provider.WithSystemPrompt(a.systemPrompt))
	if err != nil {
		return nil, fmt.Errorf("LLM error: %w", err)
	}

	// 添加助手响应到会话
	session.Messages = append(session.Messages, *response)
	session.UpdatedAt = time.Now()

	return &ChatResponse{
		SessionID: session.ID,
		Message:   *response,
	}, nil
}

// ChatWithTools 带工具调用的聊天（流式输出）
func (a *Agent) ChatWithTools(ctx context.Context, session *Session, userMessage string) (<-chan ServerMessage, error) {
	// 获取 Provider
	p, ok := a.providers.Get(session.Provider)
	if !ok {
		return nil, fmt.Errorf("provider not found: %s", session.Provider)
	}

	// 添加用户消息
	session.Messages = append(session.Messages, provider.Message{
		ID:        uuid.New().String(),
		Role:      "user",
		Content:   userMessage,
		CreatedAt: time.Now(),
	})

	// 创建输出 channel
	out := make(chan ServerMessage, 100)

	go func() {
		defer close(out)

		// 获取工具定义
		providerTools := a.tools.ToProviderTools()

		// 使用流式带工具调用的 API
		streamChan, err := p.ChatStreamWithTools(ctx, session.Messages, providerTools, provider.WithSystemPrompt(a.systemPrompt))
		if err != nil {
			out <- ServerMessage{Type: "error", Error: err.Error()}
			return
		}

		// 累积助手消息内容
		var assistantContent string
		var pendingToolCalls []provider.ToolCall

		// 处理流式响应
		for chunk := range streamChan {
			switch chunk.Type {
			case "content":
				// 直接转发文本内容
				out <- ServerMessage{
					Type:    "chunk",
					Content: chunk.Content,
				}
				assistantContent += chunk.Content

			case "tool_call":
				if chunk.ToolCall != nil {
					// 发送工具调用通知
					tc := *chunk.ToolCall
					out <- ServerMessage{
						Type:     "tool_call",
						ToolCall: &tc,
					}

					// 检查是否需要审批
					if a.tools.RequiresApproval(tc.Name) {
						desc, impact := a.tools.GetToolDescription(tc.Name, tc.Arguments)
						out <- ServerMessage{
							Type: "approval_request",
							ApprovalRequest: &ApprovalRequest{
								ToolCallID:  tc.ID,
								ToolName:    tc.Name,
								Description: desc,
								Impact:      impact,
								RiskLevel:   a.tools.GetRiskLevel(tc.Name),
								Arguments:   tc.Arguments,
							},
						}
						// 等待审批（简化处理）
						continue
					}

					pendingToolCalls = append(pendingToolCalls, tc)
				}

			case "error":
				out <- ServerMessage{Type: "error", Error: chunk.Error}
				return

			case "done":
				// 流结束
			}
		}

		// 如果有文本内容或工具调用，添加到会话
		if assistantContent != "" || len(pendingToolCalls) > 0 {
			assistantMsg := provider.Message{
				ID:        uuid.New().String(),
				Role:      "assistant",
				Content:   assistantContent,
				CreatedAt: time.Now(),
			}
			// 如果有工具调用，添加到消息中
			if len(pendingToolCalls) > 0 {
				assistantMsg.ToolCalls = pendingToolCalls
			}
			session.Messages = append(session.Messages, assistantMsg)
		}

		// 执行工具调用
		if len(pendingToolCalls) > 0 {
			for _, tc := range pendingToolCalls {
				// 执行工具
				result, err := a.tools.Execute(ctx, tc.Name, tc.Arguments)
				toolResult := &ToolResult{
					ToolCallID: tc.ID,
					Success:    err == nil,
				}
				if err != nil {
					toolResult.Error = err.Error()
				} else {
					toolResult.Result = result
				}

				out <- ServerMessage{
					Type:       "tool_result",
					ToolResult: toolResult,
				}

				// 将工具结果添加到消息历史
				session.Messages = append(session.Messages, provider.Message{
					ID:         uuid.New().String(),
					Role:       "tool",
					Content:    result,
					ToolCallID: tc.ID, // 关联到工具调用
					CreatedAt:  time.Now(),
				})
			}

			// 使用流式 API 获取最终响应
			finalStream, err := p.ChatStreamWithTools(ctx, session.Messages, nil, provider.WithSystemPrompt(a.systemPrompt))
			if err != nil {
				out <- ServerMessage{Type: "error", Error: err.Error()}
				return
			}

			var finalContent string
			for chunk := range finalStream {
				switch chunk.Type {
				case "content":
					out <- ServerMessage{
						Type:    "chunk",
						Content: chunk.Content,
					}
					finalContent += chunk.Content
				case "error":
					out <- ServerMessage{Type: "error", Error: chunk.Error}
					return
				}
			}

			if finalContent != "" {
				session.Messages = append(session.Messages, provider.Message{
					ID:        uuid.New().String(),
					Role:      "assistant",
					Content:   finalContent,
					CreatedAt: time.Now(),
				})
			}
		}

		out <- ServerMessage{Type: "done"}
	}()

	return out, nil
}

// ExecuteToolWithApproval 执行需要审批的工具
func (a *Agent) ExecuteToolWithApproval(ctx context.Context, session *Session, toolCallID string, approved bool) (*ToolResult, error) {
	// 查找待执行的工具调用
	// 这里简化处理，实际需要从会话状态中查找
	return nil, fmt.Errorf("not implemented")
}

// GetTools 获取所有可用工具
func (a *Agent) GetTools() []*tools.K8sTool {
	return a.tools.List()
}

// GetConfig 获取配置
func (a *Agent) GetConfig() *AgentConfig {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.config
}

// UpdateProviderConfig 动态更新 Provider 配置
func (a *Agent) UpdateProviderConfig(providerName string, config provider.ProviderConfig) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	// 更新配置
	if a.config.Providers == nil {
		a.config.Providers = make(map[string]provider.ProviderConfig)
	}
	a.config.Providers[providerName] = config

	// 保存到数据库
	if a.configStore != nil {
		if err := a.configStore.SaveProviderConfig(providerName, config); err != nil {
			return fmt.Errorf("failed to save config to database: %w", err)
		}
	}

	// 重新注册 Provider
	switch providerName {
	case "openai":
		a.providers.Register(provider.NewOpenAIProvider(config))
	case "deepseek":
		a.providers.Register(provider.NewDeepSeekProvider(config))
	case "qwen":
		a.providers.Register(provider.NewQwenProvider(config))
	case "doubao":
		a.providers.Register(provider.NewDoubaoProvider(config))
	default:
		return fmt.Errorf("unsupported provider: %s", providerName)
	}

	return nil
}
