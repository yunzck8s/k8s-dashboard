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

// DeepSeekProvider DeepSeek AI 提供商 (兼容 OpenAI API)
type DeepSeekProvider struct {
	client  *openai.Client
	config  ProviderConfig
	models  []Model
	enabled bool
}

// DeepSeek 模型列表
var deepseekModels = []Model{
	{
		ID:          "deepseek-chat",
		Name:        "DeepSeek Chat",
		MaxTokens:   64000,
		PriceInput:  0.001,
		PriceOutput: 0.002,
	},
	{
		ID:          "deepseek-coder",
		Name:        "DeepSeek Coder",
		MaxTokens:   64000,
		PriceInput:  0.001,
		PriceOutput: 0.002,
	},
}

// NewDeepSeekProvider 创建 DeepSeek 提供商
func NewDeepSeekProvider(config ProviderConfig) *DeepSeekProvider {
	if config.APIKey == "" {
		return &DeepSeekProvider{
			enabled: false,
			models:  deepseekModels,
		}
	}

	clientConfig := openai.DefaultConfig(config.APIKey)
	clientConfig.BaseURL = "https://api.deepseek.com"

	return &DeepSeekProvider{
		client:  openai.NewClientWithConfig(clientConfig),
		config:  config,
		models:  deepseekModels,
		enabled: config.Enabled,
	}
}

func (p *DeepSeekProvider) Name() string {
	return "deepseek"
}

func (p *DeepSeekProvider) Info() ProviderInfo {
	return ProviderInfo{
		Name:           "deepseek",
		DisplayName:    "DeepSeek AI",
		Description:    "高性能 AI 模型，支持深度对话和代码生成",
		DefaultModel:   "deepseek-chat",
		Models:         p.models,
		SupportsTools:  true,
		SupportsStream: true,
		Enabled:        p.enabled,
	}
}

func (p *DeepSeekProvider) Chat(ctx context.Context, messages []Message, opts ...Option) (*Message, error) {
	if !p.enabled {
		return nil, errors.New("DeepSeek provider is not enabled")
	}

	options := ApplyOptions(opts...)
	deepseekMessages := convertToDeepSeekMessages(messages, options.SystemPrompt)

	req := openai.ChatCompletionRequest{
		Model:       "deepseek-chat",
		Messages:    deepseekMessages,
		Temperature: float32(options.Temperature),
		MaxTokens:   options.MaxTokens,
	}

	resp, err := p.client.CreateChatCompletion(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("DeepSeek API error: %w", err)
	}

	if len(resp.Choices) == 0 {
		return nil, errors.New("no response from DeepSeek")
	}

	return &Message{
		ID:        uuid.New().String(),
		Role:      "assistant",
		Content:   resp.Choices[0].Message.Content,
		CreatedAt: time.Now(),
	}, nil
}

func (p *DeepSeekProvider) ChatStream(ctx context.Context, messages []Message, opts ...Option) (<-chan StreamChunk, error) {
	if !p.enabled {
		return nil, errors.New("DeepSeek provider is not enabled")
	}

	options := ApplyOptions(opts...)
	deepseekMessages := convertToDeepSeekMessages(messages, options.SystemPrompt)

	req := openai.ChatCompletionRequest{
		Model:       "deepseek-chat",
		Messages:    deepseekMessages,
		Temperature: float32(options.Temperature),
		MaxTokens:   options.MaxTokens,
		Stream:      true,
	}

	stream, err := p.client.CreateChatCompletionStream(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("DeepSeek stream error: %w", err)
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

func (p *DeepSeekProvider) ChatWithTools(ctx context.Context, messages []Message, tools []Tool, opts ...Option) (*ToolCallResponse, error) {
	if !p.enabled {
		return nil, errors.New("DeepSeek provider is not enabled")
	}

	options := ApplyOptions(opts...)
	deepseekMessages := convertToDeepSeekMessages(messages, options.SystemPrompt)

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
		Model:       "deepseek-chat",
		Messages:    deepseekMessages,
		Tools:       openaiTools,
		Temperature: float32(options.Temperature),
		MaxTokens:   options.MaxTokens,
	}

	resp, err := p.client.CreateChatCompletion(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("DeepSeek tools error: %w", err)
	}

	if len(resp.Choices) == 0 {
		return nil, errors.New("no response from DeepSeek")
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
func (p *DeepSeekProvider) ChatStreamWithTools(ctx context.Context, messages []Message, tools []Tool, opts ...Option) (<-chan StreamChunk, error) {
	if !p.enabled {
		return nil, errors.New("DeepSeek provider is not enabled")
	}

	options := ApplyOptions(opts...)
	deepseekMessages := convertToDeepSeekMessages(messages, options.SystemPrompt)

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
		Model:       "deepseek-chat",
		Messages:    deepseekMessages,
		Tools:       openaiTools,
		Temperature: float32(options.Temperature),
		MaxTokens:   options.MaxTokens,
		Stream:      true,
	}

	stream, err := p.client.CreateChatCompletionStream(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("DeepSeek stream error: %w", err)
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

					// 累积工具调用 ID 和名称
					if tc.ID != "" {
						toolCallsMap[*idx].ID = tc.ID
					}
					if tc.Function.Name != "" {
						toolCallsMap[*idx].Name = tc.Function.Name
					}

					// 累积参数（JSON 字符串形式）
					if tc.Function.Arguments != "" {
						// 参数是 JSON 字符串，需要在流结束后解析
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

// convertToDeepSeekMessages 转换消息格式
func convertToDeepSeekMessages(messages []Message, systemPrompt string) []openai.ChatCompletionMessage {
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

		deepseekMsg := openai.ChatCompletionMessage{
			Role:    role,
			Content: msg.Content,
		}

		// 如果是 assistant 消息且有工具调用，转换 ToolCalls
		if msg.Role == "assistant" && len(msg.ToolCalls) > 0 {
			deepseekMsg.ToolCalls = make([]openai.ToolCall, len(msg.ToolCalls))
			for i, tc := range msg.ToolCalls {
				// 将参数 map 转换为 JSON 字符串
				argsJSON, _ := json.Marshal(tc.Arguments)
				deepseekMsg.ToolCalls[i] = openai.ToolCall{
					ID:   tc.ID,
					Type: openai.ToolTypeFunction,
					Function: openai.FunctionCall{
						Name:      tc.Name,
						Arguments: string(argsJSON),
					},
				}
			}
		}

		// 如果是 tool 消息，必须设置 ToolCallID
		if msg.Role == "tool" && msg.ToolCallID != "" {
			deepseekMsg.ToolCallID = msg.ToolCallID
		}

		result = append(result, deepseekMsg)
	}

	return result
}
