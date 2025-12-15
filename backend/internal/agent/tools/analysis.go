package tools

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/k8s-dashboard/backend/internal/agent/provider"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// registerAnalysisTools 注册分析类工具
func (r *Registry) registerAnalysisTools() {
	// summarize_cluster - 集群状态摘要
	r.Register(&K8sTool{
		Name:        "summarize_cluster",
		Description: "获取 Kubernetes 集群的整体状态摘要，包括节点、Pod、Deployment 等资源的统计信息。",
		Category:    CategoryAnalysis,
		RiskLevel:   RiskLow,
		Parameters: provider.ToolParameters{
			Type:       "object",
			Properties: map[string]provider.ToolProperty{},
		},
		Handler: r.summarizeCluster,
	})

	// find_anomalies - 查找异常资源
	r.Register(&K8sTool{
		Name:        "find_anomalies",
		Description: "扫描集群中的异常资源，包括失败的 Pod、不健康的节点、频繁重启的容器等。",
		Category:    CategoryAnalysis,
		RiskLevel:   RiskLow,
		Parameters: provider.ToolParameters{
			Type:       "object",
			Properties: map[string]provider.ToolProperty{},
		},
		Handler: r.findAnomalies,
	})
}

// summarizeCluster 集群状态摘要
func (r *Registry) summarizeCluster(ctx context.Context, args map[string]interface{}) (string, error) {
	summary := map[string]interface{}{}

	// 节点统计
	nodes, err := r.k8sClient.Clientset.CoreV1().Nodes().List(ctx, metav1.ListOptions{})
	if err == nil {
		readyNodes := 0
		for _, node := range nodes.Items {
			for _, cond := range node.Status.Conditions {
				if cond.Type == corev1.NodeReady && cond.Status == corev1.ConditionTrue {
					readyNodes++
					break
				}
			}
		}
		summary["nodes"] = map[string]int{
			"total": len(nodes.Items),
			"ready": readyNodes,
		}
	}

	// Pod 统计
	pods, err := r.k8sClient.Clientset.CoreV1().Pods("").List(ctx, metav1.ListOptions{})
	if err == nil {
		podStats := map[string]int{
			"total":     len(pods.Items),
			"running":   0,
			"pending":   0,
			"failed":    0,
			"succeeded": 0,
		}
		for _, pod := range pods.Items {
			switch pod.Status.Phase {
			case corev1.PodRunning:
				podStats["running"]++
			case corev1.PodPending:
				podStats["pending"]++
			case corev1.PodFailed:
				podStats["failed"]++
			case corev1.PodSucceeded:
				podStats["succeeded"]++
			}
		}
		summary["pods"] = podStats
	}

	// Deployment 统计
	deployments, err := r.k8sClient.Clientset.AppsV1().Deployments("").List(ctx, metav1.ListOptions{})
	if err == nil {
		readyDeps := 0
		for _, dep := range deployments.Items {
			if dep.Status.ReadyReplicas == dep.Status.Replicas && dep.Status.Replicas > 0 {
				readyDeps++
			}
		}
		summary["deployments"] = map[string]int{
			"total": len(deployments.Items),
			"ready": readyDeps,
		}
	}

	// Service 统计
	services, err := r.k8sClient.Clientset.CoreV1().Services("").List(ctx, metav1.ListOptions{})
	if err == nil {
		summary["services"] = len(services.Items)
	}

	// Namespace 统计
	namespaces, err := r.k8sClient.Clientset.CoreV1().Namespaces().List(ctx, metav1.ListOptions{})
	if err == nil {
		summary["namespaces"] = len(namespaces.Items)
	}

	// 事件统计
	events, err := r.k8sClient.Clientset.CoreV1().Events("").List(ctx, metav1.ListOptions{})
	if err == nil {
		warningCount := 0
		for _, event := range events.Items {
			if event.Type == "Warning" {
				warningCount++
			}
		}
		summary["events"] = map[string]int{
			"total":    len(events.Items),
			"warnings": warningCount,
		}
	}

	result, _ := json.MarshalIndent(summary, "", "  ")
	return string(result), nil
}

// findAnomalies 查找异常资源
func (r *Registry) findAnomalies(ctx context.Context, args map[string]interface{}) (string, error) {
	anomalies := map[string]interface{}{
		"failedPods":          []map[string]string{},
		"pendingPods":         []map[string]string{},
		"crashingPods":        []map[string]string{},
		"unhealthyNodes":      []map[string]string{},
		"notReadyDeployments": []map[string]string{},
	}

	// 查找异常 Pod
	pods, err := r.k8sClient.Clientset.CoreV1().Pods("").List(ctx, metav1.ListOptions{})
	if err == nil {
		var failedPods []map[string]string
		var pendingPods []map[string]string
		var crashingPods []map[string]string

		for _, pod := range pods.Items {
			// 跳过已完成的 Job Pod
			if pod.Status.Phase == corev1.PodSucceeded {
				continue
			}

			podInfo := map[string]string{
				"name":      pod.Name,
				"namespace": pod.Namespace,
			}

			if pod.Status.Phase == corev1.PodFailed {
				podInfo["reason"] = pod.Status.Reason
				failedPods = append(failedPods, podInfo)
			}

			if pod.Status.Phase == corev1.PodPending {
				podInfo["reason"] = pod.Status.Reason
				pendingPods = append(pendingPods, podInfo)
			}

			// 检查是否有 CrashLoopBackOff
			for _, cs := range pod.Status.ContainerStatuses {
				if cs.State.Waiting != nil && cs.State.Waiting.Reason == "CrashLoopBackOff" {
					podInfo["container"] = cs.Name
					podInfo["restarts"] = fmt.Sprintf("%d", cs.RestartCount)
					crashingPods = append(crashingPods, podInfo)
					break
				}
				// 检查频繁重启
				if cs.RestartCount > 5 {
					podInfo["container"] = cs.Name
					podInfo["restarts"] = fmt.Sprintf("%d", cs.RestartCount)
					crashingPods = append(crashingPods, podInfo)
					break
				}
			}
		}

		anomalies["failedPods"] = failedPods
		anomalies["pendingPods"] = pendingPods
		anomalies["crashingPods"] = crashingPods
	}

	// 查找异常节点
	nodes, err := r.k8sClient.Clientset.CoreV1().Nodes().List(ctx, metav1.ListOptions{})
	if err == nil {
		var unhealthyNodes []map[string]string

		for _, node := range nodes.Items {
			for _, cond := range node.Status.Conditions {
				if cond.Type == corev1.NodeReady && cond.Status != corev1.ConditionTrue {
					unhealthyNodes = append(unhealthyNodes, map[string]string{
						"name":    node.Name,
						"status":  string(cond.Status),
						"reason":  cond.Reason,
						"message": cond.Message,
					})
					break
				}
				// 检查其他问题条件
				if (cond.Type == corev1.NodeMemoryPressure ||
					cond.Type == corev1.NodeDiskPressure ||
					cond.Type == corev1.NodePIDPressure) && cond.Status == corev1.ConditionTrue {
					unhealthyNodes = append(unhealthyNodes, map[string]string{
						"name":    node.Name,
						"issue":   string(cond.Type),
						"message": cond.Message,
					})
				}
			}
		}

		anomalies["unhealthyNodes"] = unhealthyNodes
	}

	// 查找未就绪的 Deployment
	deployments, err := r.k8sClient.Clientset.AppsV1().Deployments("").List(ctx, metav1.ListOptions{})
	if err == nil {
		var notReadyDeps []map[string]string

		for _, dep := range deployments.Items {
			if dep.Status.ReadyReplicas < dep.Status.Replicas {
				notReadyDeps = append(notReadyDeps, map[string]string{
					"name":      dep.Name,
					"namespace": dep.Namespace,
					"ready":     fmt.Sprintf("%d/%d", dep.Status.ReadyReplicas, dep.Status.Replicas),
				})
			}
		}

		anomalies["notReadyDeployments"] = notReadyDeps
	}

	// 计算异常总数
	totalAnomalies := 0
	if pods, ok := anomalies["failedPods"].([]map[string]string); ok {
		totalAnomalies += len(pods)
	}
	if pods, ok := anomalies["pendingPods"].([]map[string]string); ok {
		totalAnomalies += len(pods)
	}
	if pods, ok := anomalies["crashingPods"].([]map[string]string); ok {
		totalAnomalies += len(pods)
	}
	if nodes, ok := anomalies["unhealthyNodes"].([]map[string]string); ok {
		totalAnomalies += len(nodes)
	}
	if deps, ok := anomalies["notReadyDeployments"].([]map[string]string); ok {
		totalAnomalies += len(deps)
	}

	anomalies["totalAnomalies"] = totalAnomalies

	result, _ := json.MarshalIndent(anomalies, "", "  ")
	return string(result), nil
}
