package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"io"

	"github.com/k8s-dashboard/backend/internal/agent/provider"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// registerDiagnosticTools 注册诊断类工具
func (r *Registry) registerDiagnosticTools() {
	// get_pod_logs - 获取 Pod 日志
	r.Register(&K8sTool{
		Name:        "get_pod_logs",
		Description: "获取指定 Pod 的容器日志。用于排查问题、了解应用运行状态。",
		Category:    CategoryDiagnostic,
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
				"container": {
					Type:        "string",
					Description: "容器名称（可选，Pod 有多个容器时需要指定）",
				},
				"tail": {
					Type:        "string",
					Description: "显示的日志行数，默认 100",
				},
			},
			Required: []string{"namespace", "name"},
		},
		Handler: r.getPodLogs,
	})

	// describe_pod - 描述 Pod
	r.Register(&K8sTool{
		Name:        "describe_pod",
		Description: "获取 Pod 的详细描述信息，包括事件、容器状态、调度信息等。类似于 kubectl describe pod。",
		Category:    CategoryDiagnostic,
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
		Handler: r.describePod,
	})

	// check_pod_health - 检查 Pod 健康状态
	r.Register(&K8sTool{
		Name:        "check_pod_health",
		Description: "全面检查 Pod 的健康状态，分析可能的问题。",
		Category:    CategoryDiagnostic,
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
		Handler: r.checkPodHealth,
	})

	// analyze_crash_loop - 分析 CrashLoopBackOff
	r.Register(&K8sTool{
		Name:        "analyze_crash_loop",
		Description: "分析 Pod 处于 CrashLoopBackOff 状态的原因。",
		Category:    CategoryDiagnostic,
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
		Handler: r.analyzeCrashLoop,
	})
}

// getPodLogs 获取 Pod 日志
func (r *Registry) getPodLogs(ctx context.Context, args map[string]interface{}) (string, error) {
	namespace := getStringArg(args, "namespace")
	name := getStringArg(args, "name")
	container := getStringArg(args, "container")
	tailStr := getStringArg(args, "tail")

	if namespace == "" || name == "" {
		return "", fmt.Errorf("namespace 和 name 参数是必需的")
	}

	tailLines := int64(100)
	if tailStr != "" {
		fmt.Sscanf(tailStr, "%d", &tailLines)
	}

	opts := &corev1.PodLogOptions{
		TailLines: &tailLines,
	}
	if container != "" {
		opts.Container = container
	}

	req := r.k8sClient.Clientset.CoreV1().Pods(namespace).GetLogs(name, opts)
	logs, err := req.Stream(ctx)
	if err != nil {
		return "", fmt.Errorf("获取日志失败: %w", err)
	}
	defer logs.Close()

	logBytes, err := io.ReadAll(logs)
	if err != nil {
		return "", fmt.Errorf("读取日志失败: %w", err)
	}

	// 限制日志大小
	logContent := string(logBytes)
	if len(logContent) > 10000 {
		logContent = logContent[len(logContent)-10000:]
		logContent = "... (日志已截断) ...\n" + logContent
	}

	return fmt.Sprintf("Pod %s/%s 的日志:\n\n%s", namespace, name, logContent), nil
}

// describePod 描述 Pod
func (r *Registry) describePod(ctx context.Context, args map[string]interface{}) (string, error) {
	namespace := getStringArg(args, "namespace")
	name := getStringArg(args, "name")

	if namespace == "" || name == "" {
		return "", fmt.Errorf("namespace 和 name 参数是必需的")
	}

	pod, err := r.k8sClient.Clientset.CoreV1().Pods(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return "", fmt.Errorf("获取 Pod 失败: %w", err)
	}

	// 获取相关事件
	events, _ := r.k8sClient.Clientset.CoreV1().Events(namespace).List(ctx, metav1.ListOptions{
		FieldSelector: fmt.Sprintf("involvedObject.name=%s,involvedObject.kind=Pod", name),
	})

	// 构建描述信息
	type eventInfo struct {
		Type    string `json:"type"`
		Reason  string `json:"reason"`
		Message string `json:"message"`
		Time    string `json:"time"`
	}

	var eventList []eventInfo
	if events != nil {
		for _, e := range events.Items {
			eventList = append(eventList, eventInfo{
				Type:    e.Type,
				Reason:  e.Reason,
				Message: e.Message,
				Time:    e.LastTimestamp.Format("2006-01-02 15:04:05"),
			})
		}
	}

	result, _ := json.MarshalIndent(map[string]interface{}{
		"name":             pod.Name,
		"namespace":        pod.Namespace,
		"status":           pod.Status.Phase,
		"reason":           pod.Status.Reason,
		"message":          pod.Status.Message,
		"nodeName":         pod.Spec.NodeName,
		"podIP":            pod.Status.PodIP,
		"hostIP":           pod.Status.HostIP,
		"qosClass":         pod.Status.QOSClass,
		"conditions":       pod.Status.Conditions,
		"containerStatuses": pod.Status.ContainerStatuses,
		"events":           eventList,
	}, "", "  ")

	return string(result), nil
}

// checkPodHealth 检查 Pod 健康状态
func (r *Registry) checkPodHealth(ctx context.Context, args map[string]interface{}) (string, error) {
	namespace := getStringArg(args, "namespace")
	name := getStringArg(args, "name")

	if namespace == "" || name == "" {
		return "", fmt.Errorf("namespace 和 name 参数是必需的")
	}

	pod, err := r.k8sClient.Clientset.CoreV1().Pods(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return "", fmt.Errorf("获取 Pod 失败: %w", err)
	}

	issues := []string{}
	warnings := []string{}

	// 检查 Pod 状态
	if pod.Status.Phase != corev1.PodRunning {
		issues = append(issues, fmt.Sprintf("Pod 状态异常: %s", pod.Status.Phase))
	}

	// 检查容器状态
	for _, cs := range pod.Status.ContainerStatuses {
		if !cs.Ready {
			issues = append(issues, fmt.Sprintf("容器 %s 未就绪", cs.Name))
		}

		if cs.RestartCount > 0 {
			warnings = append(warnings, fmt.Sprintf("容器 %s 已重启 %d 次", cs.Name, cs.RestartCount))
		}

		if cs.State.Waiting != nil {
			issues = append(issues, fmt.Sprintf("容器 %s 正在等待: %s - %s",
				cs.Name, cs.State.Waiting.Reason, cs.State.Waiting.Message))
		}

		if cs.State.Terminated != nil {
			issues = append(issues, fmt.Sprintf("容器 %s 已终止: %s (退出码: %d)",
				cs.Name, cs.State.Terminated.Reason, cs.State.Terminated.ExitCode))
		}
	}

	// 检查 Conditions
	for _, cond := range pod.Status.Conditions {
		if cond.Status != corev1.ConditionTrue {
			if cond.Type == corev1.PodReady || cond.Type == corev1.ContainersReady {
				issues = append(issues, fmt.Sprintf("条件 %s 未满足: %s", cond.Type, cond.Message))
			}
		}
	}

	health := "健康"
	if len(issues) > 0 {
		health = "异常"
	} else if len(warnings) > 0 {
		health = "警告"
	}

	result, _ := json.MarshalIndent(map[string]interface{}{
		"podName":   name,
		"namespace": namespace,
		"health":    health,
		"issues":    issues,
		"warnings":  warnings,
		"status":    pod.Status.Phase,
		"restarts":  getTotalRestarts(pod),
	}, "", "  ")

	return string(result), nil
}

// analyzeCrashLoop 分析 CrashLoopBackOff
func (r *Registry) analyzeCrashLoop(ctx context.Context, args map[string]interface{}) (string, error) {
	namespace := getStringArg(args, "namespace")
	name := getStringArg(args, "name")

	if namespace == "" || name == "" {
		return "", fmt.Errorf("namespace 和 name 参数是必需的")
	}

	pod, err := r.k8sClient.Clientset.CoreV1().Pods(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return "", fmt.Errorf("获取 Pod 失败: %w", err)
	}

	analysis := map[string]interface{}{
		"podName":   name,
		"namespace": namespace,
		"findings":  []string{},
		"suggestions": []string{},
	}

	var findings []string
	var suggestions []string

	// 分析每个容器
	for _, cs := range pod.Status.ContainerStatuses {
		if cs.State.Waiting != nil && cs.State.Waiting.Reason == "CrashLoopBackOff" {
			findings = append(findings, fmt.Sprintf("容器 %s 处于 CrashLoopBackOff 状态", cs.Name))

			// 检查上次终止原因
			if cs.LastTerminationState.Terminated != nil {
				term := cs.LastTerminationState.Terminated
				findings = append(findings, fmt.Sprintf("上次退出码: %d, 原因: %s", term.ExitCode, term.Reason))

				switch term.ExitCode {
				case 1:
					suggestions = append(suggestions, "退出码 1 通常表示应用程序错误，请检查应用日志")
				case 137:
					suggestions = append(suggestions, "退出码 137 表示容器被 OOM Killer 终止，考虑增加内存限制")
				case 143:
					suggestions = append(suggestions, "退出码 143 表示容器收到 SIGTERM 信号被优雅终止")
				case 0:
					suggestions = append(suggestions, "退出码 0 表示容器正常退出，可能是启动命令执行完成就退出了")
				}

				if term.Reason == "OOMKilled" {
					suggestions = append(suggestions, "容器因内存不足被终止，建议增加 memory limit")
				}
			}

			findings = append(findings, fmt.Sprintf("容器已重启 %d 次", cs.RestartCount))
		}
	}

	// 获取最近的日志
	tailLines := int64(50)
	logOpts := &corev1.PodLogOptions{
		TailLines: &tailLines,
		Previous:  true,
	}

	for _, container := range pod.Spec.Containers {
		logOpts.Container = container.Name
		req := r.k8sClient.Clientset.CoreV1().Pods(namespace).GetLogs(name, logOpts)
		logs, err := req.Stream(ctx)
		if err == nil {
			logBytes, _ := io.ReadAll(logs)
			logs.Close()
			if len(logBytes) > 0 {
				analysis[fmt.Sprintf("previousLogs_%s", container.Name)] = string(logBytes)
			}
		}
	}

	if len(findings) == 0 {
		findings = append(findings, "Pod 当前未处于 CrashLoopBackOff 状态")
	}

	analysis["findings"] = findings
	analysis["suggestions"] = suggestions

	result, _ := json.MarshalIndent(analysis, "", "  ")
	return string(result), nil
}

// 辅助函数：获取总重启次数
func getTotalRestarts(pod *corev1.Pod) int32 {
	var total int32
	for _, cs := range pod.Status.ContainerStatuses {
		total += cs.RestartCount
	}
	return total
}
