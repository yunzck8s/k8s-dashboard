"""Master Agent 模块

使用 DeepAgents 框架构建 K8s 智能运维助手。

核心能力：
1. 规划工具 (write_todos) - 任务分解和进度跟踪
2. 文件系统 - 上下文管理和长期记忆
3. 子代理 - 复杂任务隔离执行
4. Human-in-the-Loop - 危险操作审批
"""
from typing import Any, Optional, Dict
from dataclasses import dataclass, field
import structlog

from deepagents import create_deep_agent
from deepagents.backends import CompositeBackend, StateBackend, StoreBackend
from langgraph.prebuilt import create_react_agent
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic
from langchain_deepseek import ChatDeepSeek
from langgraph.checkpoint.memory import MemorySaver
from langgraph.store.memory import InMemoryStore

from src.config import settings
from src.tools.query import (
    list_pods,
    get_pod,
    list_deployments,
    get_deployment,
    list_services,
    list_nodes,
    list_events,
    list_namespaces,
)
from src.tools.diagnostic import (
    get_pod_logs,
    describe_pod,
    check_pod_health,
    get_resource_usage,
    analyze_crash_loop,
)
from src.tools.action import (
    scale_deployment,
    restart_deployment,
    delete_pod,
)

logger = structlog.get_logger()


@dataclass
class AgentFeatures:
    """DeepAgents 特性配置（由前端传入）"""
    enable_planning: bool = True      # 启用规划工具 (write_todos)
    enable_filesystem: bool = True    # 启用文件系统
    enable_subagents: bool = True     # 启用子代理
    enable_memory: bool = True        # 启用长期记忆 (/memories/)

# Master Agent 系统提示词
MASTER_SYSTEM_PROMPT = """你是 K8s 集群智能运维助手，基于 DeepAgents 框架构建。

## 核心职责

1. **理解用户意图**：分析用户的问题，识别是查询、诊断还是操作类请求
2. **任务规划**：对于复杂任务，使用 write_todos 工具分解为可执行步骤
3. **任务执行**：使用 K8s 工具执行相应的操作
4. **结果汇总**：整合结果，生成清晰的诊断报告

## 工具分类

### 查询类工具（安全，可直接使用）
- list_pods: 列出 Pod
- get_pod: 获取 Pod 详情
- list_deployments: 列出 Deployment
- get_deployment: 获取 Deployment 详情
- list_services: 列出 Service
- list_nodes: 列出节点
- list_events: 获取事件
- list_namespaces: 列出命名空间

### 诊断类工具（安全，可直接使用）
- get_pod_logs: 获取 Pod 日志
- describe_pod: 描述 Pod 状态
- check_pod_health: 检查 Pod 健康状态
- get_resource_usage: 获取资源使用情况
- analyze_crash_loop: 分析 CrashLoopBackOff

### 操作类工具（⚠️ 需要用户确认）
- scale_deployment: 扩缩容 Deployment
- restart_deployment: 重启 Deployment
- delete_pod: 删除 Pod

## 工作流程

1. **接收请求**：分析用户问题，判断任务类型
2. **制定计划**：对于复杂任务，使用 write_todos 创建任务列表
3. **执行任务**：
   - 查询/诊断类：直接执行
   - 操作类：系统会自动请求用户确认
4. **汇总结果**：将执行结果整理为清晰的报告

## 子代理使用

对于复杂的诊断任务（如全面健康检查），可以使用 task 工具委派给 diagnostics 子代理，保持主对话上下文清洁。

## 注意事项

- 始终先查询相关资源状态，再建议操作
- 对于操作类工具，等待用户确认后再执行
- 使用中文输出，保持简洁清晰
- 复杂诊断可保存到 /workspace/ 目录供后续引用
- 用户偏好可保存到 /memories/ 目录持久化
"""

# 诊断子代理系统提示词
DIAGNOSTICS_SYSTEM_PROMPT = """你是 K8s 诊断专家子代理。

你的职责是执行深度诊断任务，包括：
- 全面健康检查
- 问题根因分析
- 性能瓶颈定位

## 工作方式

1. 收集所有相关信息（日志、状态、事件、指标）
2. 分析问题关联性
3. 生成简洁的诊断报告

## 输出格式

返回结构化的诊断报告：
- **问题摘要**：2-3 句话概述
- **关键发现**：bullet points
- **建议操作**：具体的修复步骤

保持输出简洁（<500 字），避免返回原始数据。
"""


def get_llm(model: str = None):
    """根据配置获取 LLM 实例

    Args:
        model: 模型标识，格式为 "provider:model_name"，如 "openai:gpt-4o"

    Returns:
        LangChain Chat Model 实例
    """
    model = model or settings.default_model

    if model.startswith("deepseek:"):
        # 使用原生 DeepSeek 支持（正确处理函数调用）
        model_name = model.split(":", 1)[1]
        return ChatDeepSeek(
            model=model_name,
            api_key=settings.openai_api_key,  # DeepSeek API Key
        )
    elif model.startswith("openai:"):
        model_name = model.split(":", 1)[1]
        # 检查是否是 DeepSeek 模型（通过 base_url 判断）
        if settings.openai_base_url and "deepseek" in settings.openai_base_url.lower():
            return ChatDeepSeek(
                model=model_name,
                api_key=settings.openai_api_key,
            )
        return ChatOpenAI(
            model=model_name,
            api_key=settings.openai_api_key,
            base_url=settings.openai_base_url,
        )
    elif model.startswith("anthropic:"):
        model_name = model.split(":", 1)[1]
        return ChatAnthropic(
            model=model_name,
            api_key=settings.anthropic_api_key,
        )
    else:
        # 默认使用 OpenAI
        return ChatOpenAI(
            model=model,
            api_key=settings.openai_api_key,
            base_url=settings.openai_base_url,
        )


def get_k8s_tools():
    """获取所有 K8s 工具"""
    return [
        # 查询类
        list_pods,
        get_pod,
        list_deployments,
        get_deployment,
        list_services,
        list_nodes,
        list_events,
        list_namespaces,
        # 诊断类
        get_pod_logs,
        describe_pod,
        check_pod_health,
        get_resource_usage,
        analyze_crash_loop,
        # 操作类
        scale_deployment,
        restart_deployment,
        delete_pod,
    ]


def get_diagnostic_tools():
    """获取诊断类工具（用于子代理）"""
    return [
        # 查询类
        list_pods,
        get_pod,
        list_deployments,
        get_deployment,
        list_services,
        list_nodes,
        list_events,
        # 诊断类
        get_pod_logs,
        describe_pod,
        check_pod_health,
        get_resource_usage,
        analyze_crash_loop,
    ]


def get_interrupt_config() -> Dict[str, Any]:
    """获取 Human-in-the-Loop 配置

    操作类工具需要用户确认才能执行
    """
    return {
        # 操作类工具需要审批
        "scale_deployment": {
            "allowed_decisions": ["approve", "edit", "reject"],
        },
        "restart_deployment": {
            "allowed_decisions": ["approve", "reject"],
        },
        "delete_pod": {
            "allowed_decisions": ["approve", "edit", "reject"],
        },
        # 查询/诊断类工具无需审批
        "list_pods": False,
        "get_pod": False,
        "list_deployments": False,
        "get_deployment": False,
        "list_services": False,
        "list_nodes": False,
        "list_events": False,
        "list_namespaces": False,
        "get_pod_logs": False,
        "describe_pod": False,
        "check_pod_health": False,
        "get_resource_usage": False,
        "analyze_crash_loop": False,
    }


def create_backend_factory(store: Optional[Any] = None):
    """创建文件系统后端工厂

    配置 CompositeBackend：
    - / 路径使用 StateBackend（临时存储）
    - /memories/ 路径使用 StoreBackend（持久化存储）

    Args:
        store: LangGraph Store 实例，用于持久化存储

    Returns:
        Backend 工厂函数
    """
    if store is not None:
        # 启用持久化存储
        def backend_factory(runtime):
            return CompositeBackend(
                default=StateBackend(runtime),
                routes={
                    "/memories/": StoreBackend(runtime),
                }
            )
        return backend_factory
    else:
        # 仅使用临时存储
        def backend_factory(runtime):
            return StateBackend(runtime)
        return backend_factory


def create_master_agent(
    model: str = None,
    checkpointer: Optional[Any] = None,
    store: Optional[Any] = None,
    features: Optional[AgentFeatures] = None,
) -> Any:
    """创建 Master Agent

    使用 DeepAgents 的 create_deep_agent 创建具有以下能力的 Agent：
    - 规划工具 (write_todos) - 可通过 features.enable_planning 控制
    - 文件系统 (ls, read_file, write_file, edit_file, glob, grep) - 可通过 features.enable_filesystem 控制
    - 子代理 (task) - 可通过 features.enable_subagents 控制
    - 长期记忆 (/memories/) - 可通过 features.enable_memory 控制
    - Human-in-the-Loop (interrupt_on) - 始终启用

    Args:
        model: LLM 模型标识，格式为 "provider:model_name"
        checkpointer: 检查点管理器，用于状态持久化和 HITL
        store: Store 实例，用于跨线程持久化存储
        features: DeepAgents 特性配置，控制启用哪些能力

    Returns:
        配置好的 DeepAgent 实例（CompiledGraph）
    """
    # 默认启用所有特性
    if features is None:
        features = AgentFeatures()

    model_id = model or settings.default_model
    llm = get_llm(model_id)
    tools = get_k8s_tools()

    logger.info(
        "创建 Master Agent",
        model=model_id,
        tools_count=len(tools),
        enable_planning=features.enable_planning,
        enable_filesystem=features.enable_filesystem,
        enable_subagents=features.enable_subagents,
        enable_memory=features.enable_memory,
    )

    # 如果所有 DeepAgents 特性都关闭，回退到简单的 ReAct Agent
    if not any([
        features.enable_planning,
        features.enable_filesystem,
        features.enable_subagents,
        features.enable_memory,
    ]):
        logger.info("所有 DeepAgents 特性关闭，使用简单 ReAct Agent")
        if checkpointer is None:
            checkpointer = MemorySaver()
        return create_react_agent(
            model=llm,
            tools=tools,
            checkpointer=checkpointer,
            prompt=MASTER_SYSTEM_PROMPT,
        )

    # 使用 MemorySaver 作为默认 checkpointer（HITL 必需）
    if checkpointer is None:
        checkpointer = MemorySaver()

    # Store 配置（仅在启用 memory 时需要）
    if features.enable_memory:
        if store is None:
            store = InMemoryStore()
    else:
        store = None

    # 子代理配置
    subagents = None
    if features.enable_subagents:
        subagents = [
            {
                "name": "diagnostics",
                "description": "执行深度诊断任务，包括全面健康检查、问题根因分析、性能瓶颈定位。"
                               "适合需要大量工具调用的复杂诊断场景。",
                "system_prompt": DIAGNOSTICS_SYSTEM_PROMPT,
                "tools": get_diagnostic_tools(),
                "model": model_id,
            },
        ]

    # Backend 配置
    backend = None
    if features.enable_filesystem:
        backend = create_backend_factory(store if features.enable_memory else None)

    # 创建 DeepAgent
    agent = create_deep_agent(
        model=llm,
        tools=tools,
        system_prompt=MASTER_SYSTEM_PROMPT,
        subagents=subagents,
        interrupt_on=get_interrupt_config(),
        backend=backend,
        checkpointer=checkpointer,
        store=store,
    )

    return agent


def create_simple_agent(
    model: str = None,
    checkpointer: Optional[Any] = None,
) -> Any:
    """创建简化版 Agent（不带子代理和持久化）

    用于简单场景或测试

    Args:
        model: LLM 模型标识
        checkpointer: 检查点管理器

    Returns:
        配置好的 DeepAgent 实例
    """
    model_id = model or settings.default_model
    llm = get_llm(model_id)
    tools = get_k8s_tools()

    if checkpointer is None:
        checkpointer = MemorySaver()

    agent = create_deep_agent(
        model=llm,
        tools=tools,
        system_prompt=MASTER_SYSTEM_PROMPT,
        interrupt_on=get_interrupt_config(),
        checkpointer=checkpointer,
    )

    return agent
