package provider

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"time"

	"github.com/google/uuid"
	"github.com/sashabaranov/go-openai"
)

// QwenProvider 阿里云通义千问提供商 (兼容 OpenAI API)
type QwenProvider struct {
	client  *openai.Client
	config  ProviderConfig
	models  []Model
	enabled bool
}

// 通义千问模型列表
var qwenModels = []Model{
	{
		ID:          "qwen-turbo",
		Name:        "通义千问 Turbo",
		MaxTokens:   8000,
		PriceInput:  0.002,
		PriceOutput: 0.006,
	},
	{
		ID:          "qwen-plus",
		Name:        "通义千问 Plus",
		MaxTokens:   32000,
		PriceInput:  0.004,
		PriceOutput: 0.012,
	},
	{
		ID:          "qwen-max",
		Name:        "通义千问 Max",
		MaxTokens:   8000,
		PriceInput:  0.04,
		PriceOutput: 0.12,
	},
}

// NewQwenProvider 创建通义千问提供商
func NewQwenProvider(config ProviderConfig) *QwenProvider {
	if config.APIKey == "" {
		return &QwenProvider{
			enabled: false,
			models:  qwenModels,
		}
	}

	clientConfig := openai.DefaultConfig(config.APIKey)
	clientConfig.BaseURL = "https://dashscope.aliyuncs.com/compatible-mode/v1"

	return &QwenProvider{
		client:  openai.NewClientWithConfig(clientConfig),
		config:  config,
		models:  qwenModels,
		enabled: config.Enabled,
	}
}

func (p *QwenProvider) Name() string {
	return "qwen"
}

func (p *QwenProvider) Info() ProviderInfo {
	return ProviderInfo{
		Name:           "qwen",
		DisplayName:    "通义千问",
		Description:    "阿里云通义千问大模型，支持中文优化和长文本处理",
		DefaultModel:   "qwen-turbo",
		Models:         p.models,
		SupportsTools:  true,
		SupportsStream: true,
		Enabled:        p.enabled,
	}
}

func (p *QwenProvider) Chat(ctx context.Context, messages []Message, opts ...Option) (*Message, error) {
	if !p.enabled {
		return nil, errors.New("Qwen provider is not enabled")
	}

	options := ApplyOptions(opts...)
	qwenMessages := convertToQwenMessages(messages, options.SystemPrompt)

	req := openai.ChatCompletionRequest{
		Model:       "qwen-turbo",
		Messages:    qwenMessages,
		Temperature: float32(options.Temperature),
		MaxTokens:   options.MaxTokens,
	}

	resp, err := p.client.CreateChatCompletion(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("Qwen API error: %w", err)
	}

	if len(resp.Choices) == 0 {
		return nil, errors.New("no response from Qwen")
	}

	return &Message{
		ID:        uuid.New().String(),
		Role:      "assistant",
		Content:   resp.Choices[0].Message.Content,
		CreatedAt: time.Now(),
	}, nil
}

func (p *QwenProvider) ChatStream(ctx context.Context, messages []Message, opts ...Option) (<-chan StreamChunk, error) {
	if !p.enabled {
		return nil, errors.New("Qwen provider is not enabled")
	}

	options := ApplyOptions(opts...)
	qwenMessages := convertToQwenMessages(messages, options.SystemPrompt)

	req := openai.ChatCompletionRequest{
		Model:       "qwen-turbo",
		Messages:    qwenMessages,
		Temperature: float32(options.Temperature),
		MaxTokens:   options.MaxTokens,
		Stream:      true,
	}

	stream, err := p.client.CreateChatCompletionStream(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("Qwen stream error: %w", err)
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

func (p *QwenProvider) ChatWithTools(ctx context.Context, messages []Message, tools []Tool, opts ...Option) (*ToolCallResponse, error) {
	if !p.enabled {
		return nil, errors.New("Qwen provider is not enabled")
	}

	options := ApplyOptions(opts...)
	qwenMessages := convertToQwenMessages(messages, options.SystemPrompt)

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
		Model:       "qwen-turbo",
		Messages:    qwenMessages,
		Tools:       openaiTools,
		Temperature: float32(options.Temperature),
		MaxTokens:   options.MaxTokens,
	}

	resp, err := p.client.CreateChatCompletion(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("Qwen tools error: %w", err)
	}

	if len(resp.Choices) == 0 {
		return nil, errors.New("no response from Qwen")
	}

	choice := resp.Choices[0]
	result := &ToolCallResponse{}

	// 如果有工具调用
	if len(choice.Message.ToolCalls) > 0 {
		result.ToolCalls = make([]ToolCall, len(choice.Message.ToolCalls))
		for i, tc := range choice.Message.ToolCalls {
			result.ToolCalls[i] = ToolCall{
				ID:   tc.ID,
				Name: tc.Function.Name,
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

// ChatStreamWithTools 流式带工具调用的对话
func (p *QwenProvider) ChatStreamWithTools(ctx context.Context, messages []Message, tools []Tool, opts ...Option) (<-chan StreamChunk, error) {
	if !p.enabled {
		return nil, errors.New("Qwen provider is not enabled")
	}

	options := ApplyOptions(opts...)
	qwenMessages := convertToQwenMessages(messages, options.SystemPrompt)

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
		Model:       "qwen-turbo",
		Messages:    qwenMessages,
		Tools:       openaiTools,
		Temperature: float32(options.Temperature),
		MaxTokens:   options.MaxTokens,
		Stream:      true,
	}

	stream, err := p.client.CreateChatCompletionStream(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("Qwen stream error: %w", err)
	}

	chunks := make(chan StreamChunk)

	go func() {
		defer close(chunks)
		defer stream.Close()

		// 用于累积工具调用
		toolCallsMap := make(map[int]*ToolCall)

		for {
			response, err := stream.Recv()
			if errors.Is(err, io.EOF) {
				// 流结束，检查是否有工具调用
				if len(toolCallsMap) > 0 {
					for _, tc := range toolCallsMap {
						// 解析累积的 JSON 参数
						if rawArgs, ok := tc.Arguments["_raw"]; ok {
							var args map[string]interface{}
							if err := json.Unmarshal([]byte(rawArgs.(string)), &args); err == nil {
								tc.Arguments = args
							} else {
								delete(tc.Arguments, "_raw")
							}
						}
						chunks <- StreamChunk{Type: "tool_call", ToolCall: tc}
					}
				}
				chunks <- StreamChunk{Type: "done"}
				return
			}
			if err != nil {
				chunks <- StreamChunk{Type: "error", Error: err.Error()}
				return
			}

			if len(response.Choices) > 0 {
				delta := response.Choices[0].Delta

				// 处理文本内容
				if delta.Content != "" {
					chunks <- StreamChunk{Type: "content", Content: delta.Content}
				}

				// 处理工具调用（流式累积）
				for _, tc := range delta.ToolCalls {
					idx := tc.Index
					if idx == nil {
						continue
					}

					if _, exists := toolCallsMap[*idx]; !exists {
						toolCallsMap[*idx] = &ToolCall{
							ID:        tc.ID,
							Name:      tc.Function.Name,
							Arguments: make(map[string]interface{}),
							Status:    "pending",
						}
					}

					if tc.ID != "" {
						toolCallsMap[*idx].ID = tc.ID
					}
					if tc.Function.Name != "" {
						toolCallsMap[*idx].Name = tc.Function.Name
					}

					if tc.Function.Arguments != "" {
						if existing, ok := toolCallsMap[*idx].Arguments["_raw"]; ok {
							toolCallsMap[*idx].Arguments["_raw"] = existing.(string) + tc.Function.Arguments
						} else {
							toolCallsMap[*idx].Arguments["_raw"] = tc.Function.Arguments
						}
					}
				}
			}
		}
	}()

	return chunks, nil
}

// convertToQwenMessages 转换消息格式
func convertToQwenMessages(messages []Message, systemPrompt string) []openai.ChatCompletionMessage {
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
