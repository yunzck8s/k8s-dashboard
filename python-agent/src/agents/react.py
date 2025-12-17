"""React Agent 实现

使用 LangGraph 的 create_react_agent 创建简单的 ReAct Agent。
"""
from typing import Any, Optional, Dict
import structlog

from langgraph.prebuilt import create_react_agent
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic
from langchain_deepseek import ChatDeepSeek

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

# React Agent 系统提示词
REACT_SYSTEM_PROMPT = """你是 K8s 集群智能运维助手。

## 核心职责

1. **理解用户意图**：分析用户的问题，识别是查询、诊断还是操作类请求
2. **执行任务**：使用 K8s 工具执行相应的操作
3. **结果汇总**：整理结果，生成清晰的响应

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

## 注意事项

- 始终先查询相关资源状态，再建议操作
- 对于操作类工具，等待用户确认后再执行
- 使用中文输出，保持简洁清晰
"""


def get_llm(model: str, api_key: Optional[str] = None, base_url: Optional[str] = None):
    """根据模型标识获取 LLM 实例

    Args:
        model: 模型标识，格式为 "provider:model_name"
        api_key: API Key（优先使用，否则从环境变量读取）
        base_url: 自定义 Base URL

    Returns:
        LangChain Chat Model 实例
    """
    model = model or settings.default_model

    if model.startswith("deepseek:"):
        model_name = model.split(":", 1)[1]
        return ChatDeepSeek(
            model=model_name,
            api_key=api_key or settings.deepseek_api_key or settings.openai_api_key,
        )
    elif model.startswith("openai:"):
        model_name = model.split(":", 1)[1]
        effective_base_url = base_url or settings.openai_base_url
        effective_api_key = api_key or settings.openai_api_key
        # 检查是否是通过 OpenAI 兼容 API 使用 DeepSeek
        if effective_base_url and "deepseek" in effective_base_url.lower():
            return ChatDeepSeek(
                model=model_name,
                api_key=effective_api_key,
            )
        return ChatOpenAI(
            model=model_name,
            api_key=effective_api_key,
            base_url=effective_base_url,
        )
    elif model.startswith("anthropic:"):
        model_name = model.split(":", 1)[1]
        return ChatAnthropic(
            model=model_name,
            api_key=api_key or settings.anthropic_api_key,
        )
    elif model.startswith("qwen:"):
        model_name = model.split(":", 1)[1]
        # 通义千问使用 OpenAI 兼容 API
        return ChatOpenAI(
            model=model_name,
            api_key=api_key,
            base_url=base_url or "https://dashscope.aliyuncs.com/compatible-mode/v1",
        )
    elif model.startswith("doubao:"):
        model_name = model.split(":", 1)[1]
        # 豆包使用 OpenAI 兼容 API
        return ChatOpenAI(
            model=model_name,
            api_key=api_key,
            base_url=base_url or "https://ark.cn-beijing.volces.com/api/v3",
        )
    else:
        # 默认使用 DeepSeek
        return ChatDeepSeek(
            model=model,
            api_key=api_key or settings.deepseek_api_key or settings.openai_api_key,
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


def create_react_agent_instance(
    model: str,
    checkpointer: Optional[Any] = None,
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
) -> Any:
    """创建 React Agent

    Args:
        model: LLM 模型标识
        checkpointer: 检查点管理器
        api_key: API Key（从数据库读取）
        base_url: 自定义 Base URL

    Returns:
        配置好的 React Agent 实例
    """
    llm = get_llm(model, api_key=api_key, base_url=base_url)
    tools = get_k8s_tools()

    logger.info(
        "创建 React Agent",
        model=model,
        tools_count=len(tools),
    )

    agent = create_react_agent(
        model=llm,
        tools=tools,
        checkpointer=checkpointer,
        prompt=REACT_SYSTEM_PROMPT,
    )

    return agent
