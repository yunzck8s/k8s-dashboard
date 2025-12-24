"""K8s 操作类工具

使用原生 kubernetes Python 客户端执行变更操作。
这些工具需要用户审批才能执行（Human-in-the-Loop）。
"""
import json
import asyncio
from agno.tools import tool

from src.k8s.client import get_k8s_client


def _run_async(coro):
    """在同步上下文中运行异步函数"""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import nest_asyncio
            nest_asyncio.apply()
            return loop.run_until_complete(coro)
        return loop.run_until_complete(coro)
    except RuntimeError:
        return asyncio.run(coro)


@tool(requires_confirmation=True)
def scale_deployment(namespace: str, name: str, replicas: int) -> str:
    """扩缩容 Deployment - 需要用户确认

    Args:
        namespace: 命名空间
        name: Deployment 名称
        replicas: 目标副本数

    Returns:
        操作结果的 JSON 字符串
    """
    try:
        k8s = get_k8s_client()
        result = _run_async(k8s.scale_deployment(
            namespace=namespace,
            name=name,
            replicas=replicas,
        ))
        return json.dumps(result, ensure_ascii=False, indent=2)
    except Exception as e:
        return json.dumps({"error": str(e), "success": False}, ensure_ascii=False)


@tool(requires_confirmation=True)
def restart_deployment(namespace: str, name: str) -> str:
    """重启 Deployment（滚动重启所有 Pod）- 需要用户确认

    Args:
        namespace: 命名空间
        name: Deployment 名称

    Returns:
        操作结果的 JSON 字符串
    """
    try:
        k8s = get_k8s_client()
        result = _run_async(k8s.restart_deployment(
            namespace=namespace,
            name=name,
        ))
        return json.dumps(result, ensure_ascii=False, indent=2)
    except Exception as e:
        return json.dumps({"error": str(e), "success": False}, ensure_ascii=False)


@tool(requires_confirmation=True)
def delete_pod(namespace: str, name: str, force: bool = False) -> str:
    """删除 Pod - 需要用户确认

    Args:
        namespace: 命名空间
        name: Pod 名称
        force: 是否强制删除（跳过 grace period）

    Returns:
        操作结果的 JSON 字符串
    """
    try:
        k8s = get_k8s_client()
        result = _run_async(k8s.delete_pod(
            namespace=namespace,
            name=name,
            force=force,
        ))
        return json.dumps(result, ensure_ascii=False, indent=2)
    except Exception as e:
        return json.dumps({"error": str(e), "success": False}, ensure_ascii=False)
