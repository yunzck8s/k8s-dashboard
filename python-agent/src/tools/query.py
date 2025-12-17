"""K8s 查询类工具

使用原生 kubernetes Python 客户端访问 K8s API。
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
            # 如果已经在异步上下文中，创建任务
            import nest_asyncio
            nest_asyncio.apply()
            return loop.run_until_complete(coro)
        return loop.run_until_complete(coro)
    except RuntimeError:
        return asyncio.run(coro)


@tool
def list_pods(
    namespace: Optional[str] = "default",
    label_selector: Optional[str] = None,
) -> str:
    """列出指定命名空间的 Pod 列表

    Args:
        namespace: 命名空间，默认为 "default"
        label_selector: 标签选择器，如 "app=nginx"

    Returns:
        Pod 列表的 JSON 字符串
    """
    try:
        k8s = get_k8s_client()
        result = _run_async(k8s.list_pods(namespace=namespace or "default", label_selector=label_selector))
        return json.dumps(result, ensure_ascii=False, indent=2)
    except Exception as e:
        return json.dumps({"error": str(e)}, ensure_ascii=False)


@tool
def get_pod(namespace: str, name: str) -> str:
    """获取指定 Pod 的详细信息

    Args:
        namespace: 命名空间
        name: Pod 名称

    Returns:
        Pod 详情的 JSON 字符串
    """
    try:
        k8s = get_k8s_client()
        result = _run_async(k8s.get_pod(namespace=namespace, name=name))
        return json.dumps(result, ensure_ascii=False, indent=2)
    except Exception as e:
        return json.dumps({"error": str(e)}, ensure_ascii=False)


@tool
def list_deployments(
    namespace: Optional[str] = "default",
    label_selector: Optional[str] = None,
) -> str:
    """列出指定命名空间的 Deployment 列表

    Args:
        namespace: 命名空间，默认为 "default"
        label_selector: 标签选择器

    Returns:
        Deployment 列表的 JSON 字符串
    """
    try:
        k8s = get_k8s_client()
        result = _run_async(k8s.list_deployments(namespace=namespace or "default", label_selector=label_selector))
        return json.dumps(result, ensure_ascii=False, indent=2)
    except Exception as e:
        return json.dumps({"error": str(e)}, ensure_ascii=False)


@tool
def get_deployment(namespace: str, name: str) -> str:
    """获取指定 Deployment 的详细信息

    Args:
        namespace: 命名空间
        name: Deployment 名称

    Returns:
        Deployment 详情的 JSON 字符串
    """
    try:
        k8s = get_k8s_client()
        result = _run_async(k8s.get_deployment(namespace=namespace, name=name))
        return json.dumps(result, ensure_ascii=False, indent=2)
    except Exception as e:
        return json.dumps({"error": str(e)}, ensure_ascii=False)


@tool
def list_services(
    namespace: Optional[str] = "default",
    label_selector: Optional[str] = None,
) -> str:
    """列出指定命名空间的 Service 列表

    Args:
        namespace: 命名空间，默认为 "default"
        label_selector: 标签选择器

    Returns:
        Service 列表的 JSON 字符串
    """
    try:
        k8s = get_k8s_client()
        result = _run_async(k8s.list_services(namespace=namespace or "default", label_selector=label_selector))
        return json.dumps(result, ensure_ascii=False, indent=2)
    except Exception as e:
        return json.dumps({"error": str(e)}, ensure_ascii=False)


@tool
def list_nodes() -> str:
    """列出集群所有节点

    Returns:
        节点列表的 JSON 字符串
    """
    try:
        k8s = get_k8s_client()
        result = _run_async(k8s.list_nodes())
        return json.dumps(result, ensure_ascii=False, indent=2)
    except Exception as e:
        return json.dumps({"error": str(e)}, ensure_ascii=False)


@tool
def list_events(
    namespace: Optional[str] = "default",
    involved_object: Optional[str] = None,
    limit: int = 50,
) -> str:
    """获取集群事件列表

    Args:
        namespace: 命名空间，默认为 "default"
        involved_object: 相关对象名称
        limit: 返回事件数量限制，默认 50

    Returns:
        事件列表的 JSON 字符串
    """
    try:
        k8s = get_k8s_client()
        result = _run_async(k8s.list_events(namespace=namespace or "default", involved_object=involved_object, limit=limit))
        return json.dumps(result, ensure_ascii=False, indent=2)
    except Exception as e:
        return json.dumps({"error": str(e)}, ensure_ascii=False)


@tool
def list_namespaces() -> str:
    """列出集群所有命名空间

    Returns:
        命名空间列表的 JSON 字符串
    """
    try:
        k8s = get_k8s_client()
        result = _run_async(k8s.list_namespaces())
        return json.dumps(result, ensure_ascii=False, indent=2)
    except Exception as e:
        return json.dumps({"error": str(e)}, ensure_ascii=False)
