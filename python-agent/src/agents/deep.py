"""Deep Agent 实现

使用 DeepAgents 框架创建具有完整能力的 Agent。
"""
from typing import Any, Optional, Dict
import structlog

from deepagents import create_deep_agent
from deepagents.backends import CompositeBackend, StateBackend, StoreBackend
from langgraph.checkpoint.memory import MemorySaver
from langgraph.store.memory import InMemoryStore

from src.agents.react import get_llm, get_k8s_tools, get_interrupt_config

logger = structlog.get_logger()

# Deep Agent 系统提示词
DEEP_SYSTEM_PROMPT = """你是 K8s 集群智能运维助手，基于 DeepAgents 框架构建。

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


def get_diagnostic_tools():
    """获取诊断类工具（用于子代理）"""
    from src.tools.query import (
        list_pods,
        get_pod,
        list_deployments,
        get_deployment,
        list_services,
        list_nodes,
        list_events,
    )
    from src.tools.diagnostic import (
        get_pod_logs,
        describe_pod,
        check_pod_health,
        get_resource_usage,
        analyze_crash_loop,
    )

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


def create_backend_factory(store: Optional[Any] = None):
    """创建文件系统后端工厂

    配置 CompositeBackend：
    - / 路径使用 StateBackend（临时存储）
    - /memories/ 路径使用 StoreBackend（持久化存储）
    """
    if store is not None:
        def backend_factory(runtime):
            return CompositeBackend(
                default=StateBackend(runtime),
                routes={
                    "/memories/": StoreBackend(runtime),
                }
            )
        return backend_factory
    else:
        def backend_factory(runtime):
            return StateBackend(runtime)
        return backend_factory


def create_deep_agent_instance(
    model: str,
    checkpointer: Optional[Any] = None,
    store: Optional[Any] = None,
    features: Optional[Dict[str, bool]] = None,
) -> Any:
    """创建 Deep Agent

    Args:
        model: LLM 模型标识，格式为 "provider:model_name"
        checkpointer: 检查点管理器
        store: Store 实例，用于跨线程持久化存储
        features: DeepAgents 特性配置

    Returns:
        配置好的 DeepAgent 实例
    """
    # 默认启用所有特性
    if features is None:
        features = {
            "enable_planning": True,
            "enable_filesystem": True,
            "enable_subagents": True,
            "enable_memory": True,
        }

    llm = get_llm(model)
    tools = get_k8s_tools()

    logger.info(
        "创建 Deep Agent",
        model=model,
        tools_count=len(tools),
        features=features,
    )

    # 如果所有 DeepAgents 特性都关闭，回退到简单的 ReAct Agent
    if not any(features.values()):
        from src.agents.react import create_react_agent_instance
        logger.info("所有 DeepAgents 特性关闭，使用简单 ReAct Agent")
        return create_react_agent_instance(model, checkpointer)

    # 使用 MemorySaver 作为默认 checkpointer
    if checkpointer is None:
        checkpointer = MemorySaver()

    # Store 配置
    if features.get("enable_memory", True):
        if store is None:
            store = InMemoryStore()
    else:
        store = None

    # 子代理配置
    subagents = None
    if features.get("enable_subagents", True):
        subagents = [
            {
                "name": "diagnostics",
                "description": "执行深度诊断任务，包括全面健康检查、问题根因分析、性能瓶颈定位。"
                               "适合需要大量工具调用的复杂诊断场景。",
                "system_prompt": DIAGNOSTICS_SYSTEM_PROMPT,
                "tools": get_diagnostic_tools(),
                "model": model,
            },
        ]

    # Backend 配置
    backend = None
    if features.get("enable_filesystem", True):
        backend = create_backend_factory(store if features.get("enable_memory", True) else None)

    # 创建 DeepAgent
    agent = create_deep_agent(
        model=llm,
        tools=tools,
        system_prompt=DEEP_SYSTEM_PROMPT,
        subagents=subagents,
        interrupt_on=get_interrupt_config(),
        backend=backend,
        checkpointer=checkpointer,
        store=store,
    )

    return agent
