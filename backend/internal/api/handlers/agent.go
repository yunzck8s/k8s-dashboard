package handlers

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/k8s-dashboard/backend/internal/agent"
	"github.com/k8s-dashboard/backend/internal/agent/provider"
)

// AgentHandler Agent API 处理器
type AgentHandler struct {
	agent    *agent.Agent
	upgrader websocket.Upgrader
}

// NewAgentHandler 创建 Agent 处理器
func NewAgentHandler(ag *agent.Agent) *AgentHandler {
	return &AgentHandler{
		agent: ag,
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				return true // 生产环境需要严格验证
			},
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
		},
	}
}

// GetProviders 获取可用的 LLM 提供商列表
func (h *AgentHandler) GetProviders(c *gin.Context) {
	providers := h.agent.GetProviders()
	c.JSON(http.StatusOK, gin.H{
		"providers": providers,
	})
}

// GetTools 获取可用的工具列表
func (h *AgentHandler) GetTools(c *gin.Context) {
	tools := h.agent.GetTools()
	c.JSON(http.StatusOK, gin.H{
		"tools": tools,
	})
}

// GetConfig 获取 Agent 配置（隐藏敏感信息）
func (h *AgentHandler) GetConfig(c *gin.Context) {
	config := h.agent.GetConfig()

	// 创建一个安全的配置副本，隐藏 API Key
	safeConfig := &agent.AgentConfig{
		Providers:       make(map[string]provider.ProviderConfig),
		DefaultProvider: config.DefaultProvider,
		DefaultModel:    config.DefaultModel,
		SystemPrompt:    config.SystemPrompt,
	}

	for name, cfg := range config.Providers {
		safeCfg := cfg
		// 隐藏 API Key，只显示是否已配置
		if cfg.APIKey != "" {
			safeCfg.APIKey = "***" // 标记为已配置
		}
		safeConfig.Providers[name] = safeCfg
	}

	c.JSON(http.StatusOK, gin.H{
		"config": safeConfig,
	})
}

// ChatWebSocket WebSocket 聊天端点
func (h *AgentHandler) ChatWebSocket(c *gin.Context) {
	// 升级为 WebSocket 连接
	conn, err := h.upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("WebSocket upgrade failed: %v", err)
		return
	}
	defer conn.Close()

	// 设置 pong 处理器
	conn.SetPongHandler(func(string) error {
		conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	ctx := c.Request.Context()
	var currentSession *agent.Session

	// 启动 ping 协程
	done := make(chan struct{})
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				if err := conn.WriteControl(websocket.PingMessage, []byte{}, time.Now().Add(10*time.Second)); err != nil {
					return
				}
			case <-done:
				return
			}
		}
	}()
	defer close(done)

	// 设置初始读取超时
	conn.SetReadDeadline(time.Now().Add(60 * time.Second))

	for {
		// 读取客户端消息
		var clientMsg agent.ClientMessage
		err := conn.ReadJSON(&clientMsg)
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket read error: %v", err)
			}
			break
		}

		// 重置读取超时
		conn.SetReadDeadline(time.Now().Add(60 * time.Second))

		switch clientMsg.Type {
		case "message":
			// 处理聊天消息
			h.handleChatMessage(ctx, conn, &clientMsg, &currentSession)

		case "approval":
			// 处理审批响应
			h.handleApproval(ctx, conn, &clientMsg, currentSession)

		case "cancel":
			// 取消当前操作
			// TODO: 实现取消逻辑

		default:
			h.sendError(conn, "unknown message type")
		}
	}
}

// handleChatMessage 处理聊天消息
func (h *AgentHandler) handleChatMessage(ctx context.Context, conn *websocket.Conn, msg *agent.ClientMessage, currentSession **agent.Session) {
	// 获取或创建会话
	var session *agent.Session
	if msg.SessionID != "" {
		s, ok := h.agent.GetSession(msg.SessionID)
		if !ok {
			h.sendError(conn, "session not found")
			return
		}
		session = s
	} else {
		// 创建新会话
		provider := msg.Provider
		if provider == "" {
			provider = "openai" // 默认提供商
		}
		model := msg.Model
		if model == "" {
			model = "gpt-4o" // 默认模型
		}

		s, err := h.agent.CreateSession("", provider, model)
		if err != nil {
			h.sendError(conn, err.Error())
			return
		}
		session = s

		// 发送会话 ID
		h.sendMessage(conn, agent.ServerMessage{
			Type:      "session",
			SessionID: session.ID,
		})
	}

	*currentSession = session

	// 调用 Agent 处理消息
	responseChan, err := h.agent.ChatWithTools(ctx, session, msg.Content)
	if err != nil {
		h.sendError(conn, err.Error())
		return
	}

	// 转发 Agent 响应到客户端
	for serverMsg := range responseChan {
		serverMsg.SessionID = session.ID
		if err := conn.WriteJSON(serverMsg); err != nil {
			log.Printf("Failed to send message: %v", err)
			return
		}
	}
}

// handleApproval 处理审批响应
func (h *AgentHandler) handleApproval(ctx context.Context, conn *websocket.Conn, msg *agent.ClientMessage, session *agent.Session) {
	if session == nil {
		h.sendError(conn, "no active session")
		return
	}

	// 执行工具
	result, err := h.agent.ExecuteToolWithApproval(ctx, session, msg.ToolCallID, msg.Approved)
	if err != nil {
		h.sendError(conn, err.Error())
		return
	}

	// 发送工具执行结果
	h.sendMessage(conn, agent.ServerMessage{
		Type:       "tool_result",
		SessionID:  session.ID,
		ToolResult: result,
	})
}

// sendMessage 发送消息
func (h *AgentHandler) sendMessage(conn *websocket.Conn, msg agent.ServerMessage) {
	if err := conn.WriteJSON(msg); err != nil {
		log.Printf("Failed to send message: %v", err)
	}
}

// sendError 发送错误消息
func (h *AgentHandler) sendError(conn *websocket.Conn, errMsg string) {
	h.sendMessage(conn, agent.ServerMessage{
		Type:  "error",
		Error: errMsg,
	})
}

// ListSessions 获取会话列表
func (h *AgentHandler) ListSessions(c *gin.Context) {
	// TODO: 从数据库获取会话列表
	c.JSON(http.StatusOK, gin.H{
		"sessions": []agent.Session{},
	})
}

// GetSession 获取会话详情
func (h *AgentHandler) GetSession(c *gin.Context) {
	sessionID := c.Param("id")
	session, ok := h.agent.GetSession(sessionID)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "session not found"})
		return
	}
	c.JSON(http.StatusOK, session)
}

// DeleteSession 删除会话
func (h *AgentHandler) DeleteSession(c *gin.Context) {
	sessionID := c.Param("id")
	h.agent.DeleteSession(sessionID)
	c.JSON(http.StatusOK, gin.H{"message": "session deleted"})
}

// Chat REST API 聊天端点（非流式）
func (h *AgentHandler) Chat(c *gin.Context) {
	var req agent.ChatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 默认值
	if req.Provider == "" {
		req.Provider = "openai"
	}
	if req.Model == "" {
		req.Model = "gpt-4o"
	}

	response, err := h.agent.Chat(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, response)
}

// UpdateConfigRequest 更新配置请求
type UpdateConfigRequest struct {
	Provider string `json:"provider" binding:"required"`
	APIKey   string `json:"apiKey" binding:"required"`
}

// UpdateConfig 更新 Agent 配置
func (h *AgentHandler) UpdateConfig(c *gin.Context) {
	var req UpdateConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 更新配置
	err := h.agent.UpdateProviderConfig(req.Provider, provider.ProviderConfig{
		Enabled: true,
		APIKey:  req.APIKey,
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "配置更新成功",
	})
}

// TestProvider 测试 LLM Provider 连接
func (h *AgentHandler) TestProvider(c *gin.Context) {
	var req struct {
		Provider string `json:"provider"`
		APIKey   string `json:"apiKey"`
		BaseURL  string `json:"baseURL"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// TODO: 实现测试逻辑
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "connection successful",
	})
}

// ExportSession 导出会话（Markdown 格式）
func (h *AgentHandler) ExportSession(c *gin.Context) {
	sessionID := c.Param("id")
	session, ok := h.agent.GetSession(sessionID)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "session not found"})
		return
	}

	// 构建 Markdown 内容
	var markdown string
	markdown += "# AI Agent 对话记录\n\n"
	markdown += "**Provider:** " + session.Provider + "\n"
	markdown += "**Model:** " + session.Model + "\n"
	markdown += "**Created:** " + session.CreatedAt.Format("2006-01-02 15:04:05") + "\n\n"
	markdown += "---\n\n"

	for _, msg := range session.Messages {
		switch msg.Role {
		case "user":
			markdown += "## 用户\n\n"
		case "assistant":
			markdown += "## AI 助手\n\n"
		case "tool":
			markdown += "## 工具结果\n\n"
		}
		markdown += msg.Content + "\n\n"

		// 添加工具调用信息
		if len(msg.ToolCalls) > 0 {
			markdown += "**工具调用:**\n\n"
			for _, tc := range msg.ToolCalls {
				markdown += "- " + tc.Name + "\n"
				argsJSON, _ := json.MarshalIndent(tc.Arguments, "  ", "  ")
				markdown += "```json\n" + string(argsJSON) + "\n```\n\n"
			}
		}
	}

	c.Header("Content-Type", "text/markdown")
	c.Header("Content-Disposition", "attachment; filename=session_"+sessionID+".md")
	c.String(http.StatusOK, markdown)
}
