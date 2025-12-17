"""Agent 工厂

根据配置创建 React Agent 或 Deep Agent。
"""
from typing import Any, Optional, Dict
from dataclasses import dataclass, field
import structlog

from langgraph.checkpoint.memory import MemorySaver
from langgraph.store.memory import InMemoryStore

from src.agents.react import create_react_agent_instance
from src.agents.deep import create_deep_agent_instance

logger = structlog.get_logger()


@dataclass
class AgentConfig:
    """Agent 配置"""
    model: str  # 格式: provider:model_name
    use_deep_agent: bool = False
    api_key: Optional[str] = None  # 从数据库读取的 API Key
    base_url: Optional[str] = None  # 自定义 Base URL
    features: Dict[str, bool] = field(default_factory=lambda: {
        "enable_planning": True,
        "enable_filesystem": True,
        "enable_subagents": True,
        "enable_memory": True,
    })


def create_agent(
    config: AgentConfig,
    checkpointer: Optional[Any] = None,
    store: Optional[Any] = None,
) -> Any:
    """根据配置创建 Agent

    Args:
        config: Agent 配置
        checkpointer: LangGraph checkpointer，用于状态持久化
        store: LangGraph store，用于跨会话存储

    Returns:
        Agent 实例（CompiledGraph）
    """
    if checkpointer is None:
        checkpointer = MemorySaver()

    if config.use_deep_agent:
        logger.info(
            "创建 Deep Agent",
            model=config.model,
            features=config.features,
        )
        if store is None:
            store = InMemoryStore()
        return create_deep_agent_instance(
            model=config.model,
            checkpointer=checkpointer,
            store=store,
            features=config.features,
        )
    else:
        logger.info(
            "创建 React Agent",
            model=config.model,
        )
        return create_react_agent_instance(
            model=config.model,
            checkpointer=checkpointer,
            api_key=config.api_key,
            base_url=config.base_url,
        )
