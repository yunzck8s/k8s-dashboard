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

// DoubaoProvider 字节跳动豆包提供商 (兼容 OpenAI API)
type DoubaoProvider struct {
	client  *openai.Client
	config  ProviderConfig
	models  []Model
	enabled bool
}

// 豆包模型列表
var doubaoModels = []Model{
	{
		ID:          "doubao-lite-4k",
		Name:        "豆包 Lite 4K",
		MaxTokens:   4000,
		PriceInput:  0.0003,
		PriceOutput: 0.0006,
	},
	{
		ID:          "doubao-lite-32k",
		Name:        "豆包 Lite 32K",
		MaxTokens:   32000,
		PriceInput:  0.0003,
		PriceOutput: 0.0006,
	},
	{
		ID:          "doubao-pro-4k",
		Name:        "豆包 Pro 4K",
		MaxTokens:   4000,
		PriceInput:  0.0008,
		PriceOutput: 0.002,
	},
	{
		ID:          "doubao-pro-32k",
		Name:        "豆包 Pro 32K",
		MaxTokens:   32000,
		PriceInput:  0.0008,
		PriceOutput: 0.002,
	},
}

// NewDoubaoProvider 创建豆包提供商
func NewDoubaoProvider(config ProviderConfig) *DoubaoProvider {
	if config.APIKey == "" {
		return &DoubaoProvider{
			enabled: false,
			models:  doubaoModels,
		}
	}

	clientConfig := openai.DefaultConfig(config.APIKey)
	clientConfig.BaseURL = "https://ark.cn-beijing.volces.com/api/v3"

	return &DoubaoProvider{
		client:  openai.NewClientWithConfig(clientConfig),
		config:  config,
		models:  doubaoModels,
		enabled: config.Enabled,
	}
}

func (p *DoubaoProvider) Name() string {
	return "doubao"
}

func (p *DoubaoProvider) Info() ProviderInfo {
	return ProviderInfo{
		Name:           "doubao",
		DisplayName:    "豆包",
		Description:    "字节跳动豆包大模型，高性价比 AI 服务",
		DefaultModel:   "doubao-lite-4k",
		Models:         p.models,
		SupportsTools:  true,
		SupportsStream: true,
		Enabled:        p.enabled,
	}
}

func (p *DoubaoProvider) Chat(ctx context.Context, messages []Message, opts ...Option) (*Message, error) {
	if !p.enabled {
		return nil, errors.New("Doubao provider is not enabled")
	}

	options := ApplyOptions(opts...)
	doubaoMessages := convertToDoubaoMessages(messages, options.SystemPrompt)

	req := openai.ChatCompletionRequest{
		Model:       "doubao-lite-4k",
		Messages:    doubaoMessages,
		Temperature: float32(options.Temperature),
		MaxTokens:   options.MaxTokens,
	}

	resp, err := p.client.CreateChatCompletion(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("Doubao API error: %w", err)
	}

	if len(resp.Choices) == 0 {
		return nil, errors.New("no response from Doubao")
	}

	return &Message{
		ID:        uuid.New().String(),
		Role:      "assistant",
		Content:   resp.Choices[0].Message.Content,
		CreatedAt: time.Now(),
	}, nil
}

func (p *DoubaoProvider) ChatStream(ctx context.Context, messages []Message, opts ...Option) (<-chan StreamChunk, error) {
	if !p.enabled {
		return nil, errors.New("Doubao provider is not enabled")
	}

	options := ApplyOptions(opts...)
	doubaoMessages := convertToDoubaoMessages(messages, options.SystemPrompt)

	req := openai.ChatCompletionRequest{
		Model:       "doubao-lite-4k",
		Messages:    doubaoMessages,
		Temperature: float32(options.Temperature),
		MaxTokens:   options.MaxTokens,
		Stream:      true,
	}

	stream, err := p.client.CreateChatCompletionStream(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("Doubao stream error: %w", err)
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

func (p *DoubaoProvider) ChatWithTools(ctx context.Context, messages []Message, tools []Tool, opts ...Option) (*ToolCallResponse, error) {
	if !p.enabled {
		return nil, errors.New("Doubao provider is not enabled")
	}

	options := ApplyOptions(opts...)
	doubaoMessages := convertToDoubaoMessages(messages, options.SystemPrompt)

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
		Model:       "doubao-lite-4k",
		Messages:    doubaoMessages,
		Tools:       openaiTools,
		Temperature: float32(options.Temperature),
		MaxTokens:   options.MaxTokens,
	}

	resp, err := p.client.CreateChatCompletion(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("Doubao tools error: %w", err)
	}

	if len(resp.Choices) == 0 {
		return nil, errors.New("no response from Doubao")
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
func (p *DoubaoProvider) ChatStreamWithTools(ctx context.Context, messages []Message, tools []Tool, opts ...Option) (<-chan StreamChunk, error) {
	if !p.enabled {
		return nil, errors.New("Doubao provider is not enabled")
	}

	options := ApplyOptions(opts...)
	doubaoMessages := convertToDoubaoMessages(messages, options.SystemPrompt)

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
		Model:       "doubao-lite-4k",
		Messages:    doubaoMessages,
		Tools:       openaiTools,
		Temperature: float32(options.Temperature),
		MaxTokens:   options.MaxTokens,
		Stream:      true,
	}

	stream, err := p.client.CreateChatCompletionStream(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("Doubao stream error: %w", err)
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

// convertToDoubaoMessages 转换消息格式
func convertToDoubaoMessages(messages []Message, systemPrompt string) []openai.ChatCompletionMessage {
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
