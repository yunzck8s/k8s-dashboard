package tools

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/k8s-dashboard/backend/internal/agent/provider"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// registerQueryTools 注册查询类工具
func (r *Registry) registerQueryTools() {
	// list_pods - 列出 Pod
	r.Register(&K8sTool{
		Name:        "list_pods",
		Description: "列出 Kubernetes 集群中的 Pod。可以按命名空间过滤，也可以使用标签选择器筛选。",
		Category:    CategoryQuery,
		RiskLevel:   RiskLow,
		Parameters: provider.ToolParameters{
			Type: "object",
			Properties: map[string]provider.ToolProperty{
				"namespace": {
					Type:        "string",
					Description: "命名空间名称，留空表示查询所有命名空间",
				},
				"labelSelector": {
					Type:        "string",
					Description: "标签选择器，例如 'app=nginx'",
				},
			},
		},
		Handler: r.listPods,
	})

	// get_pod - 获取 Pod 详情
	r.Register(&K8sTool{
		Name:        "get_pod",
		Description: "获取指定 Pod 的详细信息，包括状态、容器、事件等。",
		Category:    CategoryQuery,
		RiskLevel:   RiskLow,
		Parameters: provider.ToolParameters{
			Type: "object",
			Properties: map[string]provider.ToolProperty{
				"namespace": {
					Type:        "string",
					Description: "Pod 所在的命名空间",
				},
				"name": {
					Type:        "string",
					Description: "Pod 名称",
				},
			},
			Required: []string{"namespace", "name"},
		},
		Handler: r.getPod,
	})

	// list_deployments - 列出 Deployment
	r.Register(&K8sTool{
		Name:        "list_deployments",
		Description: "列出 Kubernetes 集群中的 Deployment。",
		Category:    CategoryQuery,
		RiskLevel:   RiskLow,
		Parameters: provider.ToolParameters{
			Type: "object",
			Properties: map[string]provider.ToolProperty{
				"namespace": {
					Type:        "string",
					Description: "命名空间名称，留空表示查询所有命名空间",
				},
			},
		},
		Handler: r.listDeployments,
	})

	// get_deployment - 获取 Deployment 详情
	r.Register(&K8sTool{
		Name:        "get_deployment",
		Description: "获取指定 Deployment 的详细信息。",
		Category:    CategoryQuery,
		RiskLevel:   RiskLow,
		Parameters: provider.ToolParameters{
			Type: "object",
			Properties: map[string]provider.ToolProperty{
				"namespace": {
					Type:        "string",
					Description: "Deployment 所在的命名空间",
				},
				"name": {
					Type:        "string",
					Description: "Deployment 名称",
				},
			},
			Required: []string{"namespace", "name"},
		},
		Handler: r.getDeployment,
	})

	// list_services - 列出 Service
	r.Register(&K8sTool{
		Name:        "list_services",
		Description: "列出 Kubernetes 集群中的 Service。",
		Category:    CategoryQuery,
		RiskLevel:   RiskLow,
		Parameters: provider.ToolParameters{
			Type: "object",
			Properties: map[string]provider.ToolProperty{
				"namespace": {
					Type:        "string",
					Description: "命名空间名称，留空表示查询所有命名空间",
				},
			},
		},
		Handler: r.listServices,
	})

	// list_nodes - 列出节点
	r.Register(&K8sTool{
		Name:        "list_nodes",
		Description: "列出 Kubernetes 集群中的所有节点及其状态。",
		Category:    CategoryQuery,
		RiskLevel:   RiskLow,
		Parameters: provider.ToolParameters{
			Type:       "object",
			Properties: map[string]provider.ToolProperty{},
		},
		Handler: r.listNodes,
	})

	// get_node - 获取节点详情
	r.Register(&K8sTool{
		Name:        "get_node",
		Description: "获取指定节点的详细信息。",
		Category:    CategoryQuery,
		RiskLevel:   RiskLow,
		Parameters: provider.ToolParameters{
			Type: "object",
			Properties: map[string]provider.ToolProperty{
				"name": {
					Type:        "string",
					Description: "节点名称",
				},
			},
			Required: []string{"name"},
		},
		Handler: r.getNode,
	})

	// list_namespaces - 列出命名空间
	r.Register(&K8sTool{
		Name:        "list_namespaces",
		Description: "列出 Kubernetes 集群中的所有命名空间。",
		Category:    CategoryQuery,
		RiskLevel:   RiskLow,
		Parameters: provider.ToolParameters{
			Type:       "object",
			Properties: map[string]provider.ToolProperty{},
		},
		Handler: r.listNamespaces,
	})

	// list_events - 列出事件
	r.Register(&K8sTool{
		Name:        "list_events",
		Description: "列出 Kubernetes 集群中的事件，可以按命名空间过滤。",
		Category:    CategoryQuery,
		RiskLevel:   RiskLow,
		Parameters: provider.ToolParameters{
			Type: "object",
			Properties: map[string]provider.ToolProperty{
				"namespace": {
					Type:        "string",
					Description: "命名空间名称，留空表示查询所有命名空间",
				},
				"type": {
					Type:        "string",
					Description: "事件类型：Normal 或 Warning",
					Enum:        []string{"Normal", "Warning"},
				},
			},
		},
		Handler: r.listEvents,
	})
}

// listPods 列出 Pod
func (r *Registry) listPods(ctx context.Context, args map[string]interface{}) (string, error) {
	namespace := getStringArg(args, "namespace")
	labelSelector := getStringArg(args, "labelSelector")

	opts := metav1.ListOptions{}
	if labelSelector != "" {
		opts.LabelSelector = labelSelector
	}

	pods, err := r.k8sClient.Clientset.CoreV1().Pods(namespace).List(ctx, opts)
	if err != nil {
		return "", fmt.Errorf("获取 Pod 列表失败: %w", err)
	}

	// 构建简化的响应
	type podSummary struct {
		Name      string `json:"name"`
		Namespace string `json:"namespace"`
		Status    string `json:"status"`
		Ready     string `json:"ready"`
		Restarts  int32  `json:"restarts"`
		Age       string `json:"age"`
	}

	var summaries []podSummary
	for _, pod := range pods.Items {
		ready := 0
		total := len(pod.Status.ContainerStatuses)
		var restarts int32
		for _, cs := range pod.Status.ContainerStatuses {
			if cs.Ready {
				ready++
			}
			restarts += cs.RestartCount
		}

		summaries = append(summaries, podSummary{
			Name:      pod.Name,
			Namespace: pod.Namespace,
			Status:    string(pod.Status.Phase),
			Ready:     fmt.Sprintf("%d/%d", ready, total),
			Restarts:  restarts,
			Age:       formatAge(pod.CreationTimestamp.Time),
		})
	}

	result, _ := json.MarshalIndent(map[string]interface{}{
		"total": len(summaries),
		"pods":  summaries,
	}, "", "  ")

	return string(result), nil
}

// getPod 获取 Pod 详情
func (r *Registry) getPod(ctx context.Context, args map[string]interface{}) (string, error) {
	namespace := getStringArg(args, "namespace")
	name := getStringArg(args, "name")

	if namespace == "" || name == "" {
		return "", fmt.Errorf("namespace 和 name 参数是必需的")
	}

	pod, err := r.k8sClient.Clientset.CoreV1().Pods(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return "", fmt.Errorf("获取 Pod 失败: %w", err)
	}

	// 构建详细响应
	type containerStatus struct {
		Name         string `json:"name"`
		Ready        bool   `json:"ready"`
		RestartCount int32  `json:"restartCount"`
		State        string `json:"state"`
	}

	var containers []containerStatus
	for _, cs := range pod.Status.ContainerStatuses {
		state := "unknown"
		if cs.State.Running != nil {
			state = "running"
		} else if cs.State.Waiting != nil {
			state = fmt.Sprintf("waiting: %s", cs.State.Waiting.Reason)
		} else if cs.State.Terminated != nil {
			state = fmt.Sprintf("terminated: %s", cs.State.Terminated.Reason)
		}

		containers = append(containers, containerStatus{
			Name:         cs.Name,
			Ready:        cs.Ready,
			RestartCount: cs.RestartCount,
			State:        state,
		})
	}

	result, _ := json.MarshalIndent(map[string]interface{}{
		"name":       pod.Name,
		"namespace":  pod.Namespace,
		"status":     pod.Status.Phase,
		"nodeName":   pod.Spec.NodeName,
		"podIP":      pod.Status.PodIP,
		"containers": containers,
		"conditions": pod.Status.Conditions,
		"created":    pod.CreationTimestamp.Format("2006-01-02 15:04:05"),
	}, "", "  ")

	return string(result), nil
}

// listDeployments 列出 Deployment
func (r *Registry) listDeployments(ctx context.Context, args map[string]interface{}) (string, error) {
	namespace := getStringArg(args, "namespace")

	deployments, err := r.k8sClient.Clientset.AppsV1().Deployments(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return "", fmt.Errorf("获取 Deployment 列表失败: %w", err)
	}

	type deploymentSummary struct {
		Name      string `json:"name"`
		Namespace string `json:"namespace"`
		Ready     string `json:"ready"`
		Available int32  `json:"available"`
		Age       string `json:"age"`
	}

	var summaries []deploymentSummary
	for _, dep := range deployments.Items {
		summaries = append(summaries, deploymentSummary{
			Name:      dep.Name,
			Namespace: dep.Namespace,
			Ready:     fmt.Sprintf("%d/%d", dep.Status.ReadyReplicas, dep.Status.Replicas),
			Available: dep.Status.AvailableReplicas,
			Age:       formatAge(dep.CreationTimestamp.Time),
		})
	}

	result, _ := json.MarshalIndent(map[string]interface{}{
		"total":       len(summaries),
		"deployments": summaries,
	}, "", "  ")

	return string(result), nil
}

// getDeployment 获取 Deployment 详情
func (r *Registry) getDeployment(ctx context.Context, args map[string]interface{}) (string, error) {
	namespace := getStringArg(args, "namespace")
	name := getStringArg(args, "name")

	if namespace == "" || name == "" {
		return "", fmt.Errorf("namespace 和 name 参数是必需的")
	}

	dep, err := r.k8sClient.Clientset.AppsV1().Deployments(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return "", fmt.Errorf("获取 Deployment 失败: %w", err)
	}

	result, _ := json.MarshalIndent(map[string]interface{}{
		"name":              dep.Name,
		"namespace":         dep.Namespace,
		"replicas":          dep.Status.Replicas,
		"readyReplicas":     dep.Status.ReadyReplicas,
		"availableReplicas": dep.Status.AvailableReplicas,
		"strategy":          dep.Spec.Strategy.Type,
		"selector":          dep.Spec.Selector,
		"conditions":        dep.Status.Conditions,
		"created":           dep.CreationTimestamp.Format("2006-01-02 15:04:05"),
	}, "", "  ")

	return string(result), nil
}

// listServices 列出 Service
func (r *Registry) listServices(ctx context.Context, args map[string]interface{}) (string, error) {
	namespace := getStringArg(args, "namespace")

	services, err := r.k8sClient.Clientset.CoreV1().Services(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return "", fmt.Errorf("获取 Service 列表失败: %w", err)
	}

	type serviceSummary struct {
		Name        string   `json:"name"`
		Namespace   string   `json:"namespace"`
		Type        string   `json:"type"`
		ClusterIP   string   `json:"clusterIP"`
		ExternalIPs []string `json:"externalIPs,omitempty"`
		Ports       []string `json:"ports"`
	}

	var summaries []serviceSummary
	for _, svc := range services.Items {
		var ports []string
		for _, p := range svc.Spec.Ports {
			ports = append(ports, fmt.Sprintf("%d/%s", p.Port, p.Protocol))
		}

		summaries = append(summaries, serviceSummary{
			Name:        svc.Name,
			Namespace:   svc.Namespace,
			Type:        string(svc.Spec.Type),
			ClusterIP:   svc.Spec.ClusterIP,
			ExternalIPs: svc.Spec.ExternalIPs,
			Ports:       ports,
		})
	}

	result, _ := json.MarshalIndent(map[string]interface{}{
		"total":    len(summaries),
		"services": summaries,
	}, "", "  ")

	return string(result), nil
}

// listNodes 列出节点
func (r *Registry) listNodes(ctx context.Context, args map[string]interface{}) (string, error) {
	nodes, err := r.k8sClient.Clientset.CoreV1().Nodes().List(ctx, metav1.ListOptions{})
	if err != nil {
		return "", fmt.Errorf("获取节点列表失败: %w", err)
	}

	type nodeSummary struct {
		Name    string `json:"name"`
		Status  string `json:"status"`
		Roles   string `json:"roles"`
		Version string `json:"version"`
		Age     string `json:"age"`
	}

	var summaries []nodeSummary
	for _, node := range nodes.Items {
		status := "NotReady"
		for _, cond := range node.Status.Conditions {
			if cond.Type == "Ready" && cond.Status == "True" {
				status = "Ready"
				break
			}
		}

		roles := ""
		for key := range node.Labels {
			if key == "node-role.kubernetes.io/control-plane" || key == "node-role.kubernetes.io/master" {
				roles = "control-plane"
			}
		}
		if roles == "" {
			roles = "worker"
		}

		summaries = append(summaries, nodeSummary{
			Name:    node.Name,
			Status:  status,
			Roles:   roles,
			Version: node.Status.NodeInfo.KubeletVersion,
			Age:     formatAge(node.CreationTimestamp.Time),
		})
	}

	result, _ := json.MarshalIndent(map[string]interface{}{
		"total": len(summaries),
		"nodes": summaries,
	}, "", "  ")

	return string(result), nil
}

// getNode 获取节点详情
func (r *Registry) getNode(ctx context.Context, args map[string]interface{}) (string, error) {
	name := getStringArg(args, "name")

	if name == "" {
		return "", fmt.Errorf("name 参数是必需的")
	}

	node, err := r.k8sClient.Clientset.CoreV1().Nodes().Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return "", fmt.Errorf("获取节点失败: %w", err)
	}

	result, _ := json.MarshalIndent(map[string]interface{}{
		"name":         node.Name,
		"status":       node.Status.Conditions,
		"addresses":    node.Status.Addresses,
		"capacity":     node.Status.Capacity,
		"allocatable":  node.Status.Allocatable,
		"nodeInfo":     node.Status.NodeInfo,
		"unschedulable": node.Spec.Unschedulable,
	}, "", "  ")

	return string(result), nil
}

// listNamespaces 列出命名空间
func (r *Registry) listNamespaces(ctx context.Context, args map[string]interface{}) (string, error) {
	namespaces, err := r.k8sClient.Clientset.CoreV1().Namespaces().List(ctx, metav1.ListOptions{})
	if err != nil {
		return "", fmt.Errorf("获取命名空间列表失败: %w", err)
	}

	type nsSummary struct {
		Name   string `json:"name"`
		Status string `json:"status"`
		Age    string `json:"age"`
	}

	var summaries []nsSummary
	for _, ns := range namespaces.Items {
		summaries = append(summaries, nsSummary{
			Name:   ns.Name,
			Status: string(ns.Status.Phase),
			Age:    formatAge(ns.CreationTimestamp.Time),
		})
	}

	result, _ := json.MarshalIndent(map[string]interface{}{
		"total":      len(summaries),
		"namespaces": summaries,
	}, "", "  ")

	return string(result), nil
}

// listEvents 列出事件
func (r *Registry) listEvents(ctx context.Context, args map[string]interface{}) (string, error) {
	namespace := getStringArg(args, "namespace")
	eventType := getStringArg(args, "type")

	events, err := r.k8sClient.Clientset.CoreV1().Events(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return "", fmt.Errorf("获取事件列表失败: %w", err)
	}

	type eventSummary struct {
		Type      string `json:"type"`
		Reason    string `json:"reason"`
		Object    string `json:"object"`
		Message   string `json:"message"`
		Count     int32  `json:"count"`
		FirstSeen string `json:"firstSeen"`
		LastSeen  string `json:"lastSeen"`
	}

	var summaries []eventSummary
	for _, event := range events.Items {
		// 按类型过滤
		if eventType != "" && event.Type != eventType {
			continue
		}

		summaries = append(summaries, eventSummary{
			Type:      event.Type,
			Reason:    event.Reason,
			Object:    fmt.Sprintf("%s/%s", event.InvolvedObject.Kind, event.InvolvedObject.Name),
			Message:   event.Message,
			Count:     event.Count,
			FirstSeen: event.FirstTimestamp.Format("2006-01-02 15:04:05"),
			LastSeen:  event.LastTimestamp.Format("2006-01-02 15:04:05"),
		})
	}

	// 限制返回数量
	if len(summaries) > 50 {
		summaries = summaries[:50]
	}

	result, _ := json.MarshalIndent(map[string]interface{}{
		"total":  len(summaries),
		"events": summaries,
	}, "", "  ")

	return string(result), nil
}
