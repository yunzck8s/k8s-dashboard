"""K8s Middleware 模块

提供 K8s 相关工具的中间件封装，用于 DeepAgents 框架。
"""
from typing import List, Any

# 尝试导入 AgentMiddleware，如果不存在则定义基类
try:
    from langchain.agents.middleware import AgentMiddleware
except ImportError:
    # 如果 AgentMiddleware 不存在，定义一个基础类
    class AgentMiddleware:
        """Agent 中间件基类"""
        tools: List[Any] = []
        system_prompt: str = ""


from ..tools.query import (
    list_pods,
    get_pod,
    list_deployments,
    get_deployment,
    list_services,
    list_nodes,
    list_events,
    list_namespaces,
)
from ..tools.diagnostic import (
    get_pod_logs,
    describe_pod,
    check_pod_health,
    get_resource_usage,
    analyze_crash_loop,
)
from ..tools.action import (
    scale_deployment,
    restart_deployment,
    delete_pod,
)


class K8sMiddleware(AgentMiddleware):
    """K8s 工具中间件

    提供所有 K8s 相关工具，包括：
    - 查询类工具（list_pods, get_pod, ...）
    - 诊断类工具（get_pod_logs, describe_pod, ...）
    - 操作类工具（scale_deployment, restart_deployment, delete_pod）

    操作类工具会被 interrupt_on 配置拦截，需要用户确认。
    """

    tools = [
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
        # 操作类（需审批）
        scale_deployment,
        restart_deployment,
        delete_pod,
    ]

    system_prompt = """你可以使用 K8s 工具来查询和管理集群资源。

## 工具分类

### 查询类（安全，无需确认）
- list_pods: 列出 Pod
- get_pod: 获取 Pod 详情
- list_deployments: 列出 Deployment
- get_deployment: 获取 Deployment 详情
- list_services: 列出 Service
- list_nodes: 列出节点
- list_events: 获取事件
- list_namespaces: 列出命名空间

### 诊断类（安全，无需确认）
- get_pod_logs: 获取 Pod 日志
- describe_pod: 描述 Pod 状态
- check_pod_health: 检查 Pod 健康状态
- get_resource_usage: 获取资源使用情况
- analyze_crash_loop: 分析 CrashLoopBackOff

### 操作类（需要用户确认）
- scale_deployment: 扩缩容 Deployment
- restart_deployment: 重启 Deployment
- delete_pod: 删除 Pod

对于操作类工具，系统会自动请求用户确认后再执行。
"""
