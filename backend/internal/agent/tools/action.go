package tools

import (
	"context"
	"fmt"
	"time"

	"github.com/k8s-dashboard/backend/internal/agent/provider"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// registerActionTools 注册操作类工具（需要审批）
func (r *Registry) registerActionTools() {
	// scale_deployment - 扩缩容 Deployment
	r.Register(&K8sTool{
		Name:        "scale_deployment",
		Description: "调整 Deployment 的副本数量。此操作需要用户确认。",
		Category:    CategoryAction,
		RiskLevel:   RiskMedium,
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
				"replicas": {
					Type:        "string",
					Description: "目标副本数",
				},
			},
			Required: []string{"namespace", "name", "replicas"},
		},
		Handler: r.scaleDeployment,
	})

	// restart_deployment - 重启 Deployment
	r.Register(&K8sTool{
		Name:        "restart_deployment",
		Description: "重启 Deployment 的所有 Pod（滚动重启）。此操作需要用户确认。",
		Category:    CategoryAction,
		RiskLevel:   RiskMedium,
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
		Handler: r.restartDeployment,
	})

	// delete_pod - 删除 Pod
	r.Register(&K8sTool{
		Name:        "delete_pod",
		Description: "删除指定的 Pod。如果 Pod 由控制器管理，会自动创建新的 Pod。此操作需要用户确认。",
		Category:    CategoryAction,
		RiskLevel:   RiskMedium,
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
		Handler: r.deletePod,
	})

	// delete_deployment - 删除 Deployment
	r.Register(&K8sTool{
		Name:        "delete_deployment",
		Description: "删除 Deployment 及其所有 Pod。此操作不可恢复，需要用户确认。",
		Category:    CategoryAction,
		RiskLevel:   RiskHigh,
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
		Handler: r.deleteDeployment,
	})

	// cordon_node - 标记节点不可调度
	r.Register(&K8sTool{
		Name:        "cordon_node",
		Description: "将节点标记为不可调度，新的 Pod 不会被调度到该节点。此操作需要用户确认。",
		Category:    CategoryAction,
		RiskLevel:   RiskMedium,
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
		Handler: r.cordonNode,
	})

	// uncordon_node - 取消节点不可调度标记
	r.Register(&K8sTool{
		Name:        "uncordon_node",
		Description: "取消节点的不可调度标记，允许新的 Pod 调度到该节点。此操作需要用户确认。",
		Category:    CategoryAction,
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
		Handler: r.uncordonNode,
	})
}

// scaleDeployment 扩缩容 Deployment
func (r *Registry) scaleDeployment(ctx context.Context, args map[string]interface{}) (string, error) {
	namespace := getStringArg(args, "namespace")
	name := getStringArg(args, "name")
	replicas := getIntArg(args, "replicas")

	if namespace == "" || name == "" {
		return "", fmt.Errorf("namespace 和 name 参数是必需的")
	}

	scale, err := r.k8sClient.Clientset.AppsV1().Deployments(namespace).GetScale(ctx, name, metav1.GetOptions{})
	if err != nil {
		return "", fmt.Errorf("获取 Deployment 失败: %w", err)
	}

	oldReplicas := scale.Spec.Replicas
	scale.Spec.Replicas = int32(replicas)

	_, err = r.k8sClient.Clientset.AppsV1().Deployments(namespace).UpdateScale(ctx, name, scale, metav1.UpdateOptions{})
	if err != nil {
		return "", fmt.Errorf("扩缩容失败: %w", err)
	}

	return fmt.Sprintf("成功将 %s/%s 的副本数从 %d 调整为 %d", namespace, name, oldReplicas, replicas), nil
}

// restartDeployment 重启 Deployment
func (r *Registry) restartDeployment(ctx context.Context, args map[string]interface{}) (string, error) {
	namespace := getStringArg(args, "namespace")
	name := getStringArg(args, "name")

	if namespace == "" || name == "" {
		return "", fmt.Errorf("namespace 和 name 参数是必需的")
	}

	dep, err := r.k8sClient.Clientset.AppsV1().Deployments(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return "", fmt.Errorf("获取 Deployment 失败: %w", err)
	}

	// 添加重启注解
	if dep.Spec.Template.Annotations == nil {
		dep.Spec.Template.Annotations = make(map[string]string)
	}
	dep.Spec.Template.Annotations["kubectl.kubernetes.io/restartedAt"] = time.Now().Format(time.RFC3339)

	_, err = r.k8sClient.Clientset.AppsV1().Deployments(namespace).Update(ctx, dep, metav1.UpdateOptions{})
	if err != nil {
		return "", fmt.Errorf("重启失败: %w", err)
	}

	return fmt.Sprintf("已触发 %s/%s 的滚动重启", namespace, name), nil
}

// deletePod 删除 Pod
func (r *Registry) deletePod(ctx context.Context, args map[string]interface{}) (string, error) {
	namespace := getStringArg(args, "namespace")
	name := getStringArg(args, "name")

	if namespace == "" || name == "" {
		return "", fmt.Errorf("namespace 和 name 参数是必需的")
	}

	err := r.k8sClient.Clientset.CoreV1().Pods(namespace).Delete(ctx, name, metav1.DeleteOptions{})
	if err != nil {
		return "", fmt.Errorf("删除 Pod 失败: %w", err)
	}

	return fmt.Sprintf("已删除 Pod %s/%s", namespace, name), nil
}

// deleteDeployment 删除 Deployment
func (r *Registry) deleteDeployment(ctx context.Context, args map[string]interface{}) (string, error) {
	namespace := getStringArg(args, "namespace")
	name := getStringArg(args, "name")

	if namespace == "" || name == "" {
		return "", fmt.Errorf("namespace 和 name 参数是必需的")
	}

	propagation := metav1.DeletePropagationForeground
	err := r.k8sClient.Clientset.AppsV1().Deployments(namespace).Delete(ctx, name, metav1.DeleteOptions{
		PropagationPolicy: &propagation,
	})
	if err != nil {
		return "", fmt.Errorf("删除 Deployment 失败: %w", err)
	}

	return fmt.Sprintf("已删除 Deployment %s/%s 及其所有 Pod", namespace, name), nil
}

// cordonNode 标记节点不可调度
func (r *Registry) cordonNode(ctx context.Context, args map[string]interface{}) (string, error) {
	name := getStringArg(args, "name")

	if name == "" {
		return "", fmt.Errorf("name 参数是必需的")
	}

	node, err := r.k8sClient.Clientset.CoreV1().Nodes().Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return "", fmt.Errorf("获取节点失败: %w", err)
	}

	if node.Spec.Unschedulable {
		return fmt.Sprintf("节点 %s 已经是不可调度状态", name), nil
	}

	node.Spec.Unschedulable = true
	_, err = r.k8sClient.Clientset.CoreV1().Nodes().Update(ctx, node, metav1.UpdateOptions{})
	if err != nil {
		return "", fmt.Errorf("标记节点失败: %w", err)
	}

	return fmt.Sprintf("已将节点 %s 标记为不可调度", name), nil
}

// uncordonNode 取消节点不可调度标记
func (r *Registry) uncordonNode(ctx context.Context, args map[string]interface{}) (string, error) {
	name := getStringArg(args, "name")

	if name == "" {
		return "", fmt.Errorf("name 参数是必需的")
	}

	node, err := r.k8sClient.Clientset.CoreV1().Nodes().Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return "", fmt.Errorf("获取节点失败: %w", err)
	}

	if !node.Spec.Unschedulable {
		return fmt.Sprintf("节点 %s 已经是可调度状态", name), nil
	}

	node.Spec.Unschedulable = false
	_, err = r.k8sClient.Clientset.CoreV1().Nodes().Update(ctx, node, metav1.UpdateOptions{})
	if err != nil {
		return "", fmt.Errorf("取消标记失败: %w", err)
	}

	return fmt.Sprintf("已将节点 %s 恢复为可调度", name), nil
}

// formatAge 格式化时间差
func formatAge(t time.Time) string {
	d := time.Since(t)
	if d.Hours() > 24 {
		days := int(d.Hours() / 24)
		return fmt.Sprintf("%dd", days)
	}
	if d.Hours() >= 1 {
		return fmt.Sprintf("%dh", int(d.Hours()))
	}
	if d.Minutes() >= 1 {
		return fmt.Sprintf("%dm", int(d.Minutes()))
	}
	return fmt.Sprintf("%ds", int(d.Seconds()))
}
