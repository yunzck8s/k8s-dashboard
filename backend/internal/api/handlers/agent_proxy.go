package handlers

import (
	"io"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// AgentProxy Agent 服务代理
// 将 /api/v1/agent/* 请求转发到 Python Agent 服务
type AgentProxy struct {
	agentURL string
	client   *http.Client
}

// NewAgentProxy 创建 Agent 代理
func NewAgentProxy(agentURL string) *AgentProxy {
	return &AgentProxy{
		agentURL: agentURL,
		client:   &http.Client{},
	}
}

// ProxyRequest 代理请求到 Python Agent
func (p *AgentProxy) ProxyRequest(c *gin.Context) {
	// 构建目标 URL
	// 请求路径: /api/v1/agent/providers -> 转发到: http://localhost:8000/api/v1/agent/providers
	targetPath := c.Request.URL.Path
	targetURL := p.agentURL + targetPath

	// 如果有查询参数，也要带上
	if c.Request.URL.RawQuery != "" {
		targetURL += "?" + c.Request.URL.RawQuery
	}

	// 创建代理请求
	proxyReq, err := http.NewRequest(c.Request.Method, targetURL, c.Request.Body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "创建代理请求失败"})
		return
	}

	// 复制请求头
	for key, values := range c.Request.Header {
		// 跳过 hop-by-hop 头
		if isHopByHopHeader(key) {
			continue
		}
		for _, value := range values {
			proxyReq.Header.Add(key, value)
		}
	}

	// 发送请求
	resp, err := p.client.Do(proxyReq)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "无法连接到 Agent 服务"})
		return
	}
	defer resp.Body.Close()

	// 复制响应头
	for key, values := range resp.Header {
		if isHopByHopHeader(key) {
			continue
		}
		for _, value := range values {
			c.Header(key, value)
		}
	}

	// 设置状态码
	c.Status(resp.StatusCode)

	// 复制响应体
	io.Copy(c.Writer, resp.Body)
}

// isHopByHopHeader 检查是否是 hop-by-hop 头
func isHopByHopHeader(header string) bool {
	hopByHopHeaders := []string{
		"Connection",
		"Keep-Alive",
		"Proxy-Authenticate",
		"Proxy-Authorization",
		"Te",
		"Trailers",
		"Transfer-Encoding",
		"Upgrade",
	}

	header = strings.ToLower(header)
	for _, h := range hopByHopHeaders {
		if strings.ToLower(h) == header {
			return true
		}
	}
	return false
}
