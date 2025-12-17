"""K8s 诊断类工具

使用原生 kubernetes Python 客户端进行诊断操作。
"""
import json
import asyncio
from typing import Optional
from langchain_core.tools import tool

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


@tool
def get_pod_logs(
    namespace: str,
    name: str,
    container: Optional[str] = None,
    tail: int = 100,
    previous: bool = False,
) -> str:
    """获取 Pod 日志

    Args:
        namespace: 命名空间
        name: Pod 名称
        container: 容器名称，多容器 Pod 时必须指定
        tail: 返回最后 N 行日志，默认 100
        previous: 是否获取前一个实例的日志，默认 False

    Returns:
        日志内容字符串
    """
    try:
        k8s = get_k8s_client()
        result = _run_async(k8s.get_pod_logs(
            namespace=namespace,
            name=name,
            container=container,
            tail_lines=tail,
            previous=previous,
        ))
        return result
    except Exception as e:
        return f"获取日志失败: {str(e)}"


@tool
def describe_pod(namespace: str, name: str) -> str:
    """获取 Pod 的详细描述，包括状态、事件等

    Args:
        namespace: 命名空间
        name: Pod 名称

    Returns:
        Pod 描述的 JSON 字符串
    """
    try:
        k8s = get_k8s_client()
        result = _run_async(k8s.describe_pod(namespace=namespace, name=name))
        return json.dumps(result, ensure_ascii=False, indent=2)
    except Exception as e:
        return json.dumps({"error": str(e)}, ensure_ascii=False)


@tool
def check_pod_health(namespace: str, name: str) -> str:
    """检查 Pod 健康状态，识别潜在问题

    Args:
        namespace: 命名空间
        name: Pod 名称

    Returns:
        健康检查报告的 JSON 字符串，包含 issues 和 recommendations
    """
    try:
        k8s = get_k8s_client()
        result = _run_async(k8s.check_pod_health(namespace=namespace, name=name))
        return json.dumps(result, ensure_ascii=False, indent=2)
    except Exception as e:
        return json.dumps({"error": str(e)}, ensure_ascii=False)


@tool
def get_resource_usage(
    resource_type: str,
    namespace: str = "default",
    name: Optional[str] = None,
) -> str:
    """获取资源使用情况（CPU/内存）

    Args:
        resource_type: 资源类型，如 "pod", "node"
        namespace: 命名空间，默认 "default"
        name: 资源名称，获取特定资源时指定

    Returns:
        资源使用情况的 JSON 字符串
    """
    try:
        k8s = get_k8s_client()
        result = _run_async(k8s.get_resource_usage(
            resource_type=resource_type,
            namespace=namespace,
            name=name,
        ))
        return json.dumps(result, ensure_ascii=False, indent=2)
    except Exception as e:
        return json.dumps({"error": str(e)}, ensure_ascii=False)


@tool
def analyze_crash_loop(namespace: str, name: str) -> str:
    """分析 CrashLoopBackOff 状态的 Pod

    Args:
        namespace: 命名空间
        name: Pod 名称

    Returns:
        分析报告的 JSON 字符串，包含可能的原因和建议
    """
    try:
        k8s = get_k8s_client()
        result = _run_async(k8s.analyze_crash_loop(namespace=namespace, name=name))
        return json.dumps(result, ensure_ascii=False, indent=2)
    except Exception as e:
        return json.dumps({"error": str(e)}, ensure_ascii=False)
