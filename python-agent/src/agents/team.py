"""Agno Team 创建

创建 K8s Operations Team，包含 3 个专业 Agent：
- Query Agent: 查询集群资源（8个工具）
- Diagnostic Agent: 诊断问题（5个工具）
- Action Agent: 执行变更操作（3个工具，需审批）
"""
from typing import Optional
from agno.team import Team
from agno.agent import Agent
from agno.db.postgres import PostgresDb
import structlog

from src.agents.models import get_agno_model
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

K8S_SYSTEM_PROMPT = """你是 K8s 运维专家，负责协调团队成员处理 Kubernetes 集群问题。

团队成员：
- Query Agent：查询集群资源（Pod、Deployment、Service、Node、Event、Namespace）
- Diagnostic Agent：诊断问题（日志分析、健康检查、资源使用监控、CrashLoop 分析）
- Action Agent：执行变更操作（扩缩容、重启、删除），所有操作需要用户确认

工作流程：
1. 理解用户意图
2. 根据任务类型委派给合适的 Agent
3. 汇总结果并提供解决方案
4. 危险操作必须等待用户确认

安全原则：
- 所有写操作（扩缩容、重启、删除）必须通过 Action Agent
- 提供清晰的操作影响说明
- 先查询再诊断，最后才操作
- 确保用户完全理解操作后果

响应要求：
- 使用清晰的中文回答
- 提供具体的数据和事实
- 明确指出问题根因
- 给出可行的解决方案
"""


def create_k8s_team(
    model: str,
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
    db: Optional[PostgresDb] = None,
) -> Team:
    """创建 K8s Operations Team

    Args:
        model: LLM 模型，格式为 "provider:model_name"
        api_key: API Key
        base_url: 自定义 Base URL
        db: PostgresDb 实例用于会话持久化

    Returns:
        Team 实例
    """
    # 获取 LLM Model
    llm = get_agno_model(model, api_key, base_url)

    logger.info(
        "创建 K8s Operations Team",
        model=model,
        has_db=db is not None,
    )

    # 创建 Query Agent
    query_agent = Agent(
        name="Query Agent",
        role="查询 Kubernetes 集群资源（Pod、Deployment、Service、Node、Event、Namespace）",
        tools=[
            list_pods,
            get_pod,
            list_deployments,
            get_deployment,
            list_services,
            list_nodes,
            list_events,
            list_namespaces,
        ],
        model=llm,
        instructions="""你负责查询 Kubernetes 集群资源。

工具说明：
- list_pods: 列出指定命名空间的所有 Pod
- get_pod: 获取单个 Pod 的详细信息
- list_deployments: 列出 Deployment
- get_deployment: 获取 Deployment 详细信息
- list_services: 列出 Service
- list_nodes: 列出集群节点
- list_events: 列出事件
- list_namespaces: 列出所有命名空间

工作原则：
- 根据用户请求选择合适的工具
- 提供准确、结构化的数据
- 如果查询失败，说明可能的原因""",
    )

    # 创建 Diagnostic Agent
    diagnostic_agent = Agent(
        name="Diagnostic Agent",
        role="诊断 Kubernetes 问题（日志分析、健康检查、资源使用监控、CrashLoop 分析）",
        tools=[
            get_pod_logs,
            describe_pod,
            check_pod_health,
            get_resource_usage,
            analyze_crash_loop,
        ],
        model=llm,
        instructions="""你负责诊断 Kubernetes 问题。

工具说明：
- get_pod_logs: 获取 Pod 日志
- describe_pod: 获取 Pod 的详细描述信息
- check_pod_health: 检查 Pod 健康状态
- get_resource_usage: 获取资源使用情况
- analyze_crash_loop: 分析 CrashLoopBackOff 问题

工作原则：
- 系统化诊断问题（日志 → 状态 → 资源）
- 提供明确的问题根因分析
- 给出具体的修复建议
- 必要时建议查看更多信息""",
    )

    # 创建 Action Agent
    action_agent = Agent(
        name="Action Agent",
        role="执行需要确认的操作（扩缩容、重启、删除）。所有操作必须等待用户确认后才能执行。",
        tools=[
            scale_deployment,
            restart_deployment,
            delete_pod,
        ],
        model=llm,
        instructions="""你负责执行需要确认的危险操作。

工具说明：
- scale_deployment: 扩缩容 Deployment（需确认）
- restart_deployment: 重启 Deployment（需确认）
- delete_pod: 删除 Pod（需确认）

工作原则：
- 所有操作必须等待用户确认
- 在请求确认前，清晰说明：
  * 操作内容
  * 预期影响
  * 潜在风险
- 确认后立即执行
- 执行后报告结果""",
    )

    # 创建 Team
    team = Team(
        name="K8s Operations Team",
        members=[query_agent, diagnostic_agent, action_agent],
        model=llm,
        db=db,
        enable_agentic_memory=True,  # 启用自动记忆管理
        instructions=K8S_SYSTEM_PROMPT,
        markdown=True,  # 支持 Markdown 格式输出
        show_tool_calls=True,  # 显示工具调用
    )

    logger.info("K8s Operations Team 创建完成")

    return team
