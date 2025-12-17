"""数据库模型定义

Provider 配置和会话存储模型。
"""
from datetime import datetime
from typing import Optional, List
from sqlalchemy import String, Boolean, DateTime, JSON, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from src.storage.database import Base


class ProviderConfig(Base):
    """LLM Provider 配置"""
    __tablename__ = "provider_configs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    provider_type: Mapped[str] = mapped_column(String(50), nullable=False)  # openai, anthropic, deepseek, qwen, doubao
    api_key_encrypted: Mapped[str] = mapped_column(Text, nullable=False)  # 加密存储
    base_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    default_model: Mapped[str] = mapped_column(String(100), nullable=False)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # 关联会话
    sessions: Mapped[List["ChatSession"]] = relationship("ChatSession", back_populates="provider")


class ChatSession(Base):
    """聊天会话"""
    __tablename__ = "chat_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    title: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    provider_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("provider_configs.id"), nullable=True)
    model: Mapped[str] = mapped_column(String(100), nullable=False)
    use_deep_agent: Mapped[bool] = mapped_column(Boolean, default=False)
    messages: Mapped[dict] = mapped_column(JSON, default=list)  # 消息历史
    metadata_: Mapped[Optional[dict]] = mapped_column("metadata", JSON, nullable=True)  # 额外元数据
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # 关联 Provider
    provider: Mapped[Optional["ProviderConfig"]] = relationship("ProviderConfig", back_populates="sessions")


class ToolApprovalLog(Base):
    """工具审批日志"""
    __tablename__ = "tool_approval_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    session_id: Mapped[str] = mapped_column(String(36), ForeignKey("chat_sessions.id"), nullable=False)
    tool_name: Mapped[str] = mapped_column(String(100), nullable=False)
    tool_args: Mapped[dict] = mapped_column(JSON, nullable=False)
    decision: Mapped[str] = mapped_column(String(20), nullable=False)  # approve, reject, edit
    edited_args: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    result: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
