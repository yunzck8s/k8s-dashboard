"""LLM Model 适配器

将 provider:model_name 格式转换为 Agno Model 对象。
"""
from typing import Optional
from agno.models.openai import OpenAIChat
from agno.models.anthropic import Claude


def get_agno_model(
    model: str,
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
):
    """将 provider:model_name 格式转换为 Agno Model

    Args:
        model: 格式为 "provider:model_name"，如 "openai:gpt-4"
        api_key: API Key
        base_url: 自定义 Base URL

    Returns:
        Agno Model 实例

    支持的 Provider:
        - openai: OpenAI 官方模型
        - anthropic: Claude 模型
        - deepseek: DeepSeek 模型
        - qwen: 阿里通义千问
        - doubao: 字节跳动豆包
        - 其他: 使用 OpenAI-compatible API
    """
    provider, model_name = model.split(":", 1)

    if provider == "openai":
        return OpenAIChat(
            id=model_name,
            api_key=api_key,
            base_url=base_url,
        )
    elif provider == "anthropic":
        return Claude(
            id=model_name,
            api_key=api_key,
        )
    elif provider == "deepseek":
        from agno.models.deepseek import DeepSeek
        return DeepSeek(
            id=model_name,
            api_key=api_key,
        )
    elif provider == "qwen":
        # 通义千问使用 OpenAI-compatible API
        return OpenAIChat(
            id=model_name,
            api_key=api_key,
            base_url=base_url or "https://dashscope.aliyuncs.com/compatible-mode/v1",
        )
    elif provider == "doubao":
        # 豆包使用 OpenAI-compatible API
        return OpenAIChat(
            id=model_name,
            api_key=api_key,
            base_url=base_url or "https://ark.cn-beijing.volces.com/api/v3",
        )
    else:
        # 默认使用 OpenAI-compatible API（适用于自定义模型）
        return OpenAIChat(
            id=model_name,
            api_key=api_key,
            base_url=base_url,
        )
