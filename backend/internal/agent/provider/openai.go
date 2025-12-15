package provider

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"time"

	"github.com/google/uuid"
	openai "github.com/sashabaranov/go-openai"
)

// OpenAIProvider OpenAI 提供商
type OpenAIProvider struct {
	client  *openai.Client
	config  ProviderConfig
	models  []Model
	enabled bool
}

// OpenAI 模型定义
var openaiModels = []Model{
	{ID: "gpt-4o", Name: "GPT-4o", MaxTokens: 128000, PriceInput: 0.005, PriceOutput: 0.015},
	{ID: "gpt-4o-mini", Name: "GPT-4o Mini", MaxTokens: 128000, PriceInput: 0.00015, PriceOutput: 0.0006},
	{ID: "gpt-4-turbo", Name: "GPT-4 Turbo", MaxTokens: 128000, PriceInput: 0.01, PriceOutput: 0.03},
	{ID: "gpt-3.5-turbo", Name: "GPT-3.5 Turbo", MaxTokens: 16385, PriceInput: 0.0005, PriceOutput: 0.0015},
}

// NewOpenAIProvider 创建 OpenAI Provider
func NewOpenAIProvider(config ProviderConfig) *OpenAIProvider {
	if config.APIKey == "" {
		return &OpenAIProvider{
			enabled: false,
			models:  openaiModels,
		}
	}

	clientConfig := openai.DefaultConfig(config.APIKey)
	if config.BaseURL != "" {
		clientConfig.BaseURL = config.BaseURL
	}

	// 过滤启用的模型
	enabledModels := openaiModels
	if len(config.Models) > 0 {
		enabledModels = []Model{}
		modelSet := make(map[string]bool)
		for _, m := range config.Models {
			modelSet[m] = true
		}
		for _, m := range openaiModels {
			if modelSet[m.ID] {
				enabledModels = append(enabledModels, m)
			}
		}
	}

	return &OpenAIProvider{
		client:  openai.NewClientWithConfig(clientConfig),
		config:  config,
		models:  enabledModels,
		enabled: config.Enabled,
	}
}

// Name 返回提供商名称
func (p *OpenAIProvider) Name() string {
	return "openai"
}

// Info 返回提供商信息
func (p *OpenAIProvider) Info() ProviderInfo {
	return ProviderInfo{
		Name:           "openai",
		DisplayName:    "OpenAI",
		Description:    "世界领先的 AI 模型，支持高级推理和工具调用",
		DefaultModel:   "gpt-4o",
		Models:         p.models,
		SupportsTools:  true,
		SupportsStream: true,
		Enabled:        p.enabled,
	}
}

// Chat 基础对话
func (p *OpenAIProvider) Chat(ctx context.Context, messages []Message, opts ...Option) (*Message, error) {
	if !p.enabled {
		return nil, errors.New("OpenAI provider is not enabled")
	}

	options := ApplyOptions(opts...)

	// 转换消息格式
	openaiMessages := convertToOpenAIMessages(messages, options.SystemPrompt)

	req := openai.ChatCompletionRequest{
		Model:       "gpt-4o", // 默认模型
		Messages:    openaiMessages,
		Temperature: float32(options.Temperature),
		MaxTokens:   options.MaxTokens,
	}

	resp, err := p.client.CreateChatCompletion(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("OpenAI API error: %w", err)
	}

	if len(resp.Choices) == 0 {
		return nil, errors.New("no response from OpenAI")
	}

	return &Message{
		ID:        uuid.New().String(),
		Role:      "assistant",
		Content:   resp.Choices[0].Message.Content,
		CreatedAt: time.Now(),
	}, nil
}

// ChatStream 流式对话
func (p *OpenAIProvider) ChatStream(ctx context.Context, messages []Message, opts ...Option) (<-chan StreamChunk, error) {
	if !p.enabled {
		return nil, errors.New("OpenAI provider is not enabled")
	}

	options := ApplyOptions(opts...)
	openaiMessages := convertToOpenAIMessages(messages, options.SystemPrompt)

	req := openai.ChatCompletionRequest{
		Model:       "gpt-4o",
		Messages:    openaiMessages,
		Temperature: float32(options.Temperature),
		MaxTokens:   options.MaxTokens,
		Stream:      true,
	}

	stream, err := p.client.CreateChatCompletionStream(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("OpenAI stream error: %w", err)
	}

	chunks := make(chan StreamChunk)

	go func() {
		defer close(chunks)
		defer stream.Close()

		for {
			response, err := stream.Recv()
			if errors.Is(err, io.EOF) {
				chunks <- StreamChunk{Type: "done"}
				return
			}
			if err != nil {
				chunks <- StreamChunk{Type: "error", Error: err.Error()}
				return
			}

			if len(response.Choices) > 0 {
				delta := response.Choices[0].Delta
				if delta.Content != "" {
					chunks <- StreamChunk{Type: "content", Content: delta.Content}
				}
			}
		}
	}()

	return chunks, nil
}

// ChatWithTools 带工具调用的对话
func (p *OpenAIProvider) ChatWithTools(ctx context.Context, messages []Message, tools []Tool, opts ...Option) (*ToolCallResponse, error) {
	if !p.enabled {
		return nil, errors.New("OpenAI provider is not enabled")
	}

	options := ApplyOptions(opts...)
	openaiMessages := convertToOpenAIMessages(messages, options.SystemPrompt)

	// 转换工具定义
	openaiTools := make([]openai.Tool, len(tools))
	for i, t := range tools {
		openaiTools[i] = openai.Tool{
			Type: openai.ToolTypeFunction,
			Function: &openai.FunctionDefinition{
				Name:        t.Name,
				Description: t.Description,
				Parameters:  t.Parameters,
			},
		}
	}

	req := openai.ChatCompletionRequest{
		Model:       "gpt-4o",
		Messages:    openaiMessages,
		Tools:       openaiTools,
		Temperature: float32(options.Temperature),
		MaxTokens:   options.MaxTokens,
	}

	resp, err := p.client.CreateChatCompletion(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("OpenAI API error: %w", err)
	}

	if len(resp.Choices) == 0 {
		return nil, errors.New("no response from OpenAI")
	}

	choice := resp.Choices[0]
	result := &ToolCallResponse{}

	// 检查是否有工具调用
	if len(choice.Message.ToolCalls) > 0 {
		result.ToolCalls = make([]ToolCall, len(choice.Message.ToolCalls))
		for i, tc := range choice.Message.ToolCalls {
			var args map[string]interface{}
			if err := json.Unmarshal([]byte(tc.Function.Arguments), &args); err != nil {
				args = make(map[string]interface{})
			}
			result.ToolCalls[i] = ToolCall{
				ID:        tc.ID,
				Name:      tc.Function.Name,
				Arguments: args,
				Status:    "pending",
			}
		}
	}

	// 如果有文本响应
	if choice.Message.Content != "" {
		result.Message = &Message{
			ID:        uuid.New().String(),
			Role:      "assistant",
			Content:   choice.Message.Content,
			CreatedAt: time.Now(),
		}
	}

	return result, nil
}

// convertToOpenAIMessages 转换消息格式
func convertToOpenAIMessages(messages []Message, systemPrompt string) []openai.ChatCompletionMessage {
	var result []openai.ChatCompletionMessage

	// 添加系统提示
	if systemPrompt != "" {
		result = append(result, openai.ChatCompletionMessage{
			Role:    openai.ChatMessageRoleSystem,
			Content: systemPrompt,
		})
	}

	for _, msg := range messages {
		role := openai.ChatMessageRoleUser
		switch msg.Role {
		case "assistant":
			role = openai.ChatMessageRoleAssistant
		case "system":
			role = openai.ChatMessageRoleSystem
		case "tool":
			role = openai.ChatMessageRoleTool
		}

		result = append(result, openai.ChatCompletionMessage{
			Role:    role,
			Content: msg.Content,
		})
	}

	return result
}
