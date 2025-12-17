"""K8s 模块

提供 K8s API 访问功能。
"""
from src.k8s.client import K8sClient, get_k8s_client

__all__ = ["K8sClient", "get_k8s_client"]
