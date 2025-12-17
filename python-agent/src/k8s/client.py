"""K8s 客户端封装

使用 kubernetes Python 库直接访问 K8s API。
"""
import asyncio
from typing import List, Optional, Dict, Any
from functools import partial
import structlog

from kubernetes import client, config
from kubernetes.client.rest import ApiException

logger = structlog.get_logger()


class K8sClient:
    """K8s 客户端封装"""

    def __init__(self):
        """初始化 K8s 客户端"""
        self._load_config()
        self.core_v1 = client.CoreV1Api()
        self.apps_v1 = client.AppsV1Api()
        self.networking_v1 = client.NetworkingV1Api()

    def _load_config(self):
        """加载 K8s 配置"""
        try:
            # 优先尝试 in-cluster 配置
            config.load_incluster_config()
            logger.info("使用 in-cluster K8s 配置")
        except config.ConfigException:
            # 回退到 kubeconfig
            config.load_kube_config()
            logger.info("使用 kubeconfig K8s 配置")

    async def _run_in_executor(self, func, *args, **kwargs):
        """在线程池中执行同步操作"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, partial(func, *args, **kwargs))

    # ==================== 查询类 ====================

    async def list_namespaces(self) -> List[Dict[str, Any]]:
        """列出所有命名空间"""
        try:
            result = await self._run_in_executor(self.core_v1.list_namespace)
            return [self._format_namespace(ns) for ns in result.items]
        except ApiException as e:
            logger.error("列出命名空间失败", error=str(e))
            raise

    async def list_pods(
        self,
        namespace: str = "default",
        label_selector: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """列出 Pod"""
        try:
            kwargs = {"namespace": namespace}
            if label_selector:
                kwargs["label_selector"] = label_selector
            result = await self._run_in_executor(
                self.core_v1.list_namespaced_pod, **kwargs
            )
            return [self._format_pod(pod) for pod in result.items]
        except ApiException as e:
            logger.error("列出 Pod 失败", namespace=namespace, error=str(e))
            raise

    async def get_pod(self, namespace: str, name: str) -> Dict[str, Any]:
        """获取 Pod 详情"""
        try:
            result = await self._run_in_executor(
                self.core_v1.read_namespaced_pod, name=name, namespace=namespace
            )
            return self._format_pod(result, detailed=True)
        except ApiException as e:
            logger.error("获取 Pod 失败", namespace=namespace, name=name, error=str(e))
            raise

    async def list_deployments(
        self,
        namespace: str = "default",
        label_selector: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """列出 Deployment"""
        try:
            kwargs = {"namespace": namespace}
            if label_selector:
                kwargs["label_selector"] = label_selector
            result = await self._run_in_executor(
                self.apps_v1.list_namespaced_deployment, **kwargs
            )
            return [self._format_deployment(dep) for dep in result.items]
        except ApiException as e:
            logger.error("列出 Deployment 失败", namespace=namespace, error=str(e))
            raise

    async def get_deployment(self, namespace: str, name: str) -> Dict[str, Any]:
        """获取 Deployment 详情"""
        try:
            result = await self._run_in_executor(
                self.apps_v1.read_namespaced_deployment, name=name, namespace=namespace
            )
            return self._format_deployment(result, detailed=True)
        except ApiException as e:
            logger.error("获取 Deployment 失败", namespace=namespace, name=name, error=str(e))
            raise

    async def list_services(
        self,
        namespace: str = "default",
        label_selector: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """列出 Service"""
        try:
            kwargs = {"namespace": namespace}
            if label_selector:
                kwargs["label_selector"] = label_selector
            result = await self._run_in_executor(
                self.core_v1.list_namespaced_service, **kwargs
            )
            return [self._format_service(svc) for svc in result.items]
        except ApiException as e:
            logger.error("列出 Service 失败", namespace=namespace, error=str(e))
            raise

    async def list_nodes(self) -> List[Dict[str, Any]]:
        """列出节点"""
        try:
            result = await self._run_in_executor(self.core_v1.list_node)
            return [self._format_node(node) for node in result.items]
        except ApiException as e:
            logger.error("列出节点失败", error=str(e))
            raise

    async def list_events(
        self,
        namespace: str = "default",
        involved_object: Optional[str] = None,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        """列出事件"""
        try:
            kwargs = {"namespace": namespace, "limit": limit}
            if involved_object:
                kwargs["field_selector"] = f"involvedObject.name={involved_object}"
            result = await self._run_in_executor(
                self.core_v1.list_namespaced_event, **kwargs
            )
            return [self._format_event(event) for event in result.items]
        except ApiException as e:
            logger.error("列出事件失败", namespace=namespace, error=str(e))
            raise

    # ==================== 诊断类 ====================

    async def get_pod_logs(
        self,
        namespace: str,
        name: str,
        container: Optional[str] = None,
        tail_lines: int = 100,
        previous: bool = False,
    ) -> str:
        """获取 Pod 日志"""
        try:
            kwargs = {
                "name": name,
                "namespace": namespace,
                "tail_lines": tail_lines,
                "previous": previous,
            }
            if container:
                kwargs["container"] = container
            result = await self._run_in_executor(
                self.core_v1.read_namespaced_pod_log, **kwargs
            )
            return result
        except ApiException as e:
            logger.error("获取 Pod 日志失败", namespace=namespace, name=name, error=str(e))
            raise

    async def describe_pod(self, namespace: str, name: str) -> Dict[str, Any]:
        """描述 Pod（包含事件）"""
        pod = await self.get_pod(namespace, name)
        events = await self.list_events(namespace, involved_object=name)
        return {
            "pod": pod,
            "events": events,
        }

    async def check_pod_health(self, namespace: str, name: str) -> Dict[str, Any]:
        """检查 Pod 健康状态"""
        pod = await self.get_pod(namespace, name)
        events = await self.list_events(namespace, involved_object=name, limit=20)

        issues = []
        recommendations = []

        # 检查 Pod 状态
        phase = pod.get("status", {}).get("phase", "Unknown")
        if phase != "Running":
            issues.append(f"Pod 状态异常: {phase}")

        # 检查容器状态
        containers = pod.get("status", {}).get("containerStatuses", [])
        for container in containers:
            if not container.get("ready", False):
                issues.append(f"容器 {container.get('name')} 未就绪")
            restart_count = container.get("restartCount", 0)
            if restart_count > 5:
                issues.append(f"容器 {container.get('name')} 重启次数过多: {restart_count}")
                recommendations.append("检查容器日志和事件，找出重启原因")

        # 检查事件
        for event in events:
            if event.get("type") == "Warning":
                issues.append(f"警告事件: {event.get('reason')} - {event.get('message')}")

        return {
            "healthy": len(issues) == 0,
            "pod_name": name,
            "namespace": namespace,
            "phase": phase,
            "issues": issues,
            "recommendations": recommendations,
        }

    async def get_resource_usage(
        self,
        resource_type: str,
        namespace: str = "default",
        name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """获取资源使用情况（需要 metrics-server）"""
        # 注意：这需要 metrics-server 安装，暂时返回基础信息
        if resource_type == "pod" and name:
            pod = await self.get_pod(namespace, name)
            containers = pod.get("spec", {}).get("containers", [])
            return {
                "resource_type": resource_type,
                "name": name,
                "namespace": namespace,
                "containers": [
                    {
                        "name": c.get("name"),
                        "requests": c.get("resources", {}).get("requests", {}),
                        "limits": c.get("resources", {}).get("limits", {}),
                    }
                    for c in containers
                ],
            }
        return {"error": "metrics-server 未配置或资源类型不支持"}

    async def analyze_crash_loop(self, namespace: str, name: str) -> Dict[str, Any]:
        """分析 CrashLoopBackOff"""
        pod = await self.get_pod(namespace, name)
        logs = ""
        try:
            logs = await self.get_pod_logs(namespace, name, previous=True, tail_lines=50)
        except ApiException:
            pass  # 可能没有前一个实例

        events = await self.list_events(namespace, involved_object=name)

        analysis = {
            "pod_name": name,
            "namespace": namespace,
            "crash_count": 0,
            "last_exit_code": None,
            "possible_causes": [],
            "recent_logs": logs[-2000:] if logs else "无日志",
            "recent_events": events[:10],
        }

        # 分析容器状态
        containers = pod.get("status", {}).get("containerStatuses", [])
        for container in containers:
            restart_count = container.get("restartCount", 0)
            analysis["crash_count"] = max(analysis["crash_count"], restart_count)

            last_state = container.get("lastState", {})
            if "terminated" in last_state:
                terminated = last_state["terminated"]
                analysis["last_exit_code"] = terminated.get("exitCode")
                analysis["last_reason"] = terminated.get("reason")

        # 推断可能原因
        if analysis["last_exit_code"] == 137:
            analysis["possible_causes"].append("OOMKilled - 内存不足")
        elif analysis["last_exit_code"] == 1:
            analysis["possible_causes"].append("应用程序错误")
        elif analysis["last_exit_code"] == 0:
            analysis["possible_causes"].append("正常退出但可能配置了不正确的重启策略")

        return analysis

    # ==================== 操作类 ====================

    async def scale_deployment(
        self,
        namespace: str,
        name: str,
        replicas: int,
    ) -> Dict[str, Any]:
        """扩缩容 Deployment"""
        try:
            body = {"spec": {"replicas": replicas}}
            result = await self._run_in_executor(
                self.apps_v1.patch_namespaced_deployment_scale,
                name=name,
                namespace=namespace,
                body=body,
            )
            logger.info("扩缩容成功", namespace=namespace, name=name, replicas=replicas)
            return {
                "success": True,
                "name": name,
                "namespace": namespace,
                "replicas": replicas,
            }
        except ApiException as e:
            logger.error("扩缩容失败", namespace=namespace, name=name, error=str(e))
            raise

    async def restart_deployment(self, namespace: str, name: str) -> Dict[str, Any]:
        """重启 Deployment（通过更新注解触发滚动重启）"""
        try:
            from datetime import datetime

            body = {
                "spec": {
                    "template": {
                        "metadata": {
                            "annotations": {
                                "kubectl.kubernetes.io/restartedAt": datetime.utcnow().isoformat()
                            }
                        }
                    }
                }
            }
            await self._run_in_executor(
                self.apps_v1.patch_namespaced_deployment,
                name=name,
                namespace=namespace,
                body=body,
            )
            logger.info("重启 Deployment 成功", namespace=namespace, name=name)
            return {
                "success": True,
                "name": name,
                "namespace": namespace,
                "message": "滚动重启已触发",
            }
        except ApiException as e:
            logger.error("重启 Deployment 失败", namespace=namespace, name=name, error=str(e))
            raise

    async def delete_pod(
        self,
        namespace: str,
        name: str,
        force: bool = False,
    ) -> Dict[str, Any]:
        """删除 Pod"""
        try:
            kwargs = {"name": name, "namespace": namespace}
            if force:
                kwargs["grace_period_seconds"] = 0
            await self._run_in_executor(
                self.core_v1.delete_namespaced_pod, **kwargs
            )
            logger.info("删除 Pod 成功", namespace=namespace, name=name, force=force)
            return {
                "success": True,
                "name": name,
                "namespace": namespace,
                "force": force,
            }
        except ApiException as e:
            logger.error("删除 Pod 失败", namespace=namespace, name=name, error=str(e))
            raise

    # ==================== 格式化方法 ====================

    def _format_namespace(self, ns) -> Dict[str, Any]:
        """格式化命名空间"""
        return {
            "name": ns.metadata.name,
            "status": ns.status.phase,
            "created_at": ns.metadata.creation_timestamp.isoformat() if ns.metadata.creation_timestamp else None,
            "labels": ns.metadata.labels or {},
        }

    def _format_pod(self, pod, detailed: bool = False) -> Dict[str, Any]:
        """格式化 Pod"""
        result = {
            "name": pod.metadata.name,
            "namespace": pod.metadata.namespace,
            "status": {
                "phase": pod.status.phase,
                "conditions": [
                    {"type": c.type, "status": c.status}
                    for c in (pod.status.conditions or [])
                ],
                "containerStatuses": [
                    {
                        "name": cs.name,
                        "ready": cs.ready,
                        "restartCount": cs.restart_count,
                        "state": self._format_container_state(cs.state),
                    }
                    for cs in (pod.status.container_statuses or [])
                ],
            },
            "labels": pod.metadata.labels or {},
            "created_at": pod.metadata.creation_timestamp.isoformat() if pod.metadata.creation_timestamp else None,
        }

        if detailed:
            result["spec"] = {
                "containers": [
                    {
                        "name": c.name,
                        "image": c.image,
                        "ports": [{"containerPort": p.container_port} for p in (c.ports or [])],
                        "resources": {
                            "requests": dict(c.resources.requests) if c.resources and c.resources.requests else {},
                            "limits": dict(c.resources.limits) if c.resources and c.resources.limits else {},
                        },
                    }
                    for c in pod.spec.containers
                ],
                "nodeName": pod.spec.node_name,
                "serviceAccount": pod.spec.service_account_name,
            }

        return result

    def _format_container_state(self, state) -> Dict[str, Any]:
        """格式化容器状态"""
        if state.running:
            return {"running": {"startedAt": state.running.started_at.isoformat() if state.running.started_at else None}}
        elif state.waiting:
            return {"waiting": {"reason": state.waiting.reason, "message": state.waiting.message}}
        elif state.terminated:
            return {
                "terminated": {
                    "exitCode": state.terminated.exit_code,
                    "reason": state.terminated.reason,
                }
            }
        return {}

    def _format_deployment(self, dep, detailed: bool = False) -> Dict[str, Any]:
        """格式化 Deployment"""
        result = {
            "name": dep.metadata.name,
            "namespace": dep.metadata.namespace,
            "replicas": {
                "desired": dep.spec.replicas,
                "ready": dep.status.ready_replicas or 0,
                "available": dep.status.available_replicas or 0,
                "updated": dep.status.updated_replicas or 0,
            },
            "labels": dep.metadata.labels or {},
            "created_at": dep.metadata.creation_timestamp.isoformat() if dep.metadata.creation_timestamp else None,
        }

        if detailed:
            result["spec"] = {
                "selector": dep.spec.selector.match_labels if dep.spec.selector else {},
                "strategy": dep.spec.strategy.type if dep.spec.strategy else "RollingUpdate",
            }
            result["conditions"] = [
                {
                    "type": c.type,
                    "status": c.status,
                    "reason": c.reason,
                    "message": c.message,
                }
                for c in (dep.status.conditions or [])
            ]

        return result

    def _format_service(self, svc) -> Dict[str, Any]:
        """格式化 Service"""
        return {
            "name": svc.metadata.name,
            "namespace": svc.metadata.namespace,
            "type": svc.spec.type,
            "clusterIP": svc.spec.cluster_ip,
            "ports": [
                {
                    "name": p.name,
                    "port": p.port,
                    "targetPort": p.target_port,
                    "protocol": p.protocol,
                }
                for p in (svc.spec.ports or [])
            ],
            "selector": svc.spec.selector or {},
            "created_at": svc.metadata.creation_timestamp.isoformat() if svc.metadata.creation_timestamp else None,
        }

    def _format_node(self, node) -> Dict[str, Any]:
        """格式化节点"""
        conditions = {c.type: c.status for c in (node.status.conditions or [])}
        return {
            "name": node.metadata.name,
            "status": "Ready" if conditions.get("Ready") == "True" else "NotReady",
            "roles": [
                k.replace("node-role.kubernetes.io/", "")
                for k in (node.metadata.labels or {}).keys()
                if k.startswith("node-role.kubernetes.io/")
            ],
            "version": node.status.node_info.kubelet_version if node.status.node_info else "Unknown",
            "os": node.status.node_info.os_image if node.status.node_info else "Unknown",
            "capacity": {
                "cpu": node.status.capacity.get("cpu") if node.status.capacity else "Unknown",
                "memory": node.status.capacity.get("memory") if node.status.capacity else "Unknown",
                "pods": node.status.capacity.get("pods") if node.status.capacity else "Unknown",
            },
            "conditions": conditions,
            "created_at": node.metadata.creation_timestamp.isoformat() if node.metadata.creation_timestamp else None,
        }

    def _format_event(self, event) -> Dict[str, Any]:
        """格式化事件"""
        return {
            "type": event.type,
            "reason": event.reason,
            "message": event.message,
            "involvedObject": {
                "kind": event.involved_object.kind,
                "name": event.involved_object.name,
                "namespace": event.involved_object.namespace,
            },
            "count": event.count,
            "firstTimestamp": event.first_timestamp.isoformat() if event.first_timestamp else None,
            "lastTimestamp": event.last_timestamp.isoformat() if event.last_timestamp else None,
        }


# 全局 K8s 客户端实例
_k8s_client: Optional[K8sClient] = None


def get_k8s_client() -> K8sClient:
    """获取 K8s 客户端单例"""
    global _k8s_client
    if _k8s_client is None:
        _k8s_client = K8sClient()
    return _k8s_client
