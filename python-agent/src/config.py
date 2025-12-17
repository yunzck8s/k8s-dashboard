"""配置管理模块

Agent 服务配置，支持多种 LLM 提供商和存储后端。
"""
from pydantic_settings import BaseSettings
from pydantic import Field
from typing import Optional


class Settings(BaseSettings):
    """应用配置"""

    # 服务配置
    host: str = Field(default="0.0.0.0", description="服务监听地址")
    port: int = Field(default=8000, description="服务端口")

    # 数据库配置
    database_url: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/k8s_agent",
        description="PostgreSQL 连接字符串",
    )

    # LLM 配置
    default_model: str = Field(
        default="deepseek:deepseek-chat",
        description="默认模型，格式: provider:model_name",
    )
    openai_api_key: Optional[str] = Field(default=None, description="OpenAI API Key")
    openai_base_url: Optional[str] = Field(default=None, description="OpenAI Base URL")
    anthropic_api_key: Optional[str] = Field(default=None, description="Anthropic API Key")
    deepseek_api_key: Optional[str] = Field(default=None, description="DeepSeek API Key")

    # Checkpointer 配置
    checkpointer_type: str = Field(
        default="postgres",
        description="Checkpointer 类型: memory, postgres",
    )

    # 日志配置
    log_level: str = Field(default="INFO", description="日志级别")
    log_format: str = Field(default="console", description="日志格式: json/console")

    # API Key 加密密钥
    encryption_key: Optional[str] = Field(
        default=None,
        description="用于加密存储 API Key 的密钥（Fernet）",
    )

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


# 全局配置实例
settings = Settings()
