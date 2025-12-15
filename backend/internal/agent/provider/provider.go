package provider

import (
	"context"
	"time"
)

// Message 聊天消息
type Message struct {
	ID        string     `json:"id"`
	Role      string     `json:"role"` // user, assistant, system, tool
	Content   string     `json:"content"`
	ToolCalls []ToolCall `json:"toolCalls,omitempty"`
	CreatedAt time.Time  `json:"createdAt"`
}

// ToolCall 工具调用
type ToolCall struct {
	ID        string                 `json:"id"`
	Name      string                 `json:"name"`
	Arguments map[string]interface{} `json:"arguments"`
	Status    string                 `json:"status"`
	Result    string                 `json:"result,omitempty"`
	Error     string                 `json:"error,omitempty"`
}

// ProviderInfo 提供商信息
type ProviderInfo struct {
	Name           string  `json:"name"`
	DisplayName    string  `json:"displayName"`
	Description    string  `json:"description"`
	DefaultModel   string  `json:"defaultModel"`
	Models         []Model `json:"models"`
	SupportsTools  bool    `json:"supportsTools"`
	SupportsStream bool    `json:"supportsStream"`
	Enabled        bool    `json:"enabled"`
}

// Model 模型信息
type Model struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	MaxTokens   int     `json:"maxTokens"`
	PriceInput  float64 `json:"priceInput"`
	PriceOutput float64 `json:"priceOutput"`
}

// StreamChunk 流式响应块
type StreamChunk struct {
	Type      string     `json:"type"` // content, tool_call, done, error
	Content   string     `json:"content,omitempty"`
	ToolCall  *ToolCall  `json:"toolCall,omitempty"`
	Error     string     `json:"error,omitempty"`
	SessionID string     `json:"sessionId,omitempty"`
}

// ProviderConfig 提供商配置
type ProviderConfig struct {
	Enabled bool     `json:"enabled"`
	APIKey  string   `json:"apiKey,omitempty"`
	BaseURL string   `json:"baseURL,omitempty"`
	Models  []string `json:"models,omitempty"`
}

// LLMProvider LLM 提供商接口
type LLMProvider interface {
	// Chat 基础对话
	Chat(ctx context.Context, messages []Message, opts ...Option) (*Message, error)

	// ChatStream 流式对话
	ChatStream(ctx context.Context, messages []Message, opts ...Option) (<-chan StreamChunk, error)

	// ChatWithTools 带工具调用的对话
	ChatWithTools(ctx context.Context, messages []Message, tools []Tool, opts ...Option) (*ToolCallResponse, error)

	// Info 获取提供商信息
	Info() ProviderInfo

	// Name 获取提供商名称
	Name() string
}

// Tool 工具定义（给 LLM 看的）
type Tool struct {
	Name        string         `json:"name"`
	Description string         `json:"description"`
	Parameters  ToolParameters `json:"parameters"`
}

// ToolParameters 工具参数定义
type ToolParameters struct {
	Type       string                    `json:"type"`
	Properties map[string]ToolProperty   `json:"properties"`
	Required   []string                  `json:"required,omitempty"`
}

// ToolProperty 工具参数属性
type ToolProperty struct {
	Type        string   `json:"type"`
	Description string   `json:"description"`
	Enum        []string `json:"enum,omitempty"`
}

// ToolCallResponse 工具调用响应
type ToolCallResponse struct {
	Message   *Message   `json:"message,omitempty"`
	ToolCalls []ToolCall `json:"toolCalls,omitempty"`
}

// Option 配置选项
type Option func(*Options)

// Options 配置
type Options struct {
	Temperature    float64
	MaxTokens      int
	TopP           float64
	StopSequences  []string
	SystemPrompt   string
}

// DefaultOptions 默认配置
func DefaultOptions() *Options {
	return &Options{
		Temperature: 0.7,
		MaxTokens:   4096,
		TopP:        1.0,
	}
}

// WithTemperature 设置温度
func WithTemperature(t float64) Option {
	return func(o *Options) {
		o.Temperature = t
	}
}

// WithMaxTokens 设置最大 token 数
func WithMaxTokens(n int) Option {
	return func(o *Options) {
		o.MaxTokens = n
	}
}

// WithSystemPrompt 设置系统提示
func WithSystemPrompt(prompt string) Option {
	return func(o *Options) {
		o.SystemPrompt = prompt
	}
}

// ApplyOptions 应用配置
func ApplyOptions(opts ...Option) *Options {
	options := DefaultOptions()
	for _, opt := range opts {
		opt(options)
	}
	return options
}

// Registry Provider 注册表
type Registry struct {
	providers map[string]LLMProvider
}

// NewRegistry 创建注册表
func NewRegistry() *Registry {
	return &Registry{
		providers: make(map[string]LLMProvider),
	}
}

// Register 注册 Provider
func (r *Registry) Register(provider LLMProvider) {
	r.providers[provider.Name()] = provider
}

// Get 获取 Provider
func (r *Registry) Get(name string) (LLMProvider, bool) {
	p, ok := r.providers[name]
	return p, ok
}

// List 列出所有 Provider
func (r *Registry) List() []ProviderInfo {
	var result []ProviderInfo
	for _, p := range r.providers {
		result = append(result, p.Info())
	}
	return result
}

// ListEnabled 列出启用的 Provider
func (r *Registry) ListEnabled() []ProviderInfo {
	var result []ProviderInfo
	for _, p := range r.providers {
		info := p.Info()
		if info.Enabled {
			result = append(result, info)
		}
	}
	return result
}
