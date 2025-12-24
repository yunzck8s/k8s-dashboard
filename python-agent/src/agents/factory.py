"""Agent 工厂（重构为 Team 工厂）

创建 K8s Operations Team，替代原来的 React/Deep Agent 分支逻辑。
"""
from typing import Optional
from dataclasses import dataclass
import structlog

from agno.db.postgres import PostgresDb
from agno.db.in_memory import InMemoryDb

from src.agents.team import create_k8s_team

logger = structlog.get_logger()


@dataclass
class TeamConfig:
    """Team 配置

    简化版配置，移除了原有的 use_deep_agent 和 features 字段。
    """
    model: str  # 格式: provider:model_name（如 "deepseek:deepseek-chat"）
    api_key: Optional[str] = None  # 从数据库读取的 API Key
    base_url: Optional[str] = None  # 自定义 Base URL


def create_team(
    config: TeamConfig,
    db: Optional[PostgresDb] = None,
):
    """创建 Agno Team（替代原来的 create_agent）

    Args:
        config: Team 配置
        db: PostgresDb 实例用于会话持久化，None 时使用内存存储

    Returns:
        Team 实例（CompiledGraph）
    """
    if db is None:
        db = InMemoryDb()

    logger.info(
        "创建 K8s Operations Team",
        model=config.model,
        has_api_key=bool(config.api_key),
        has_base_url=bool(config.base_url),
    )

    return create_k8s_team(
        model=config.model,
        api_key=config.api_key,
        base_url=config.base_url,
        db=db,
    )
