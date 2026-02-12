package observation

import (
	"context"
	"fmt"
	"time"

	"github.com/k8s-dashboard/backend/internal/alertmanager"
	"github.com/k8s-dashboard/backend/internal/k8s"
	"github.com/k8s-dashboard/backend/internal/metrics"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// Service 集群观测服务
type Service struct {
	k8s     *k8s.Client
	metrics *metrics.Client
	alerts  *alertmanager.Client
}

// NewService 创建观测服务
func NewService(k8sClient *k8s.Client, metricsClient *metrics.Client, alertClient *alertmanager.Client) *Service {
	return &Service{
		k8s:     k8sClient,
		metrics: metricsClient,
		alerts:  alertClient,
	}
}

// WithK8sClient 返回绑定到指定集群客户端的服务副本。
func (s *Service) WithK8sClient(client *k8s.Client) *Service {
	if client == nil {
		return s
	}
	clone := *s
	clone.k8s = client
	return &clone
}

// GetSummary 获取异常状态汇总
func (s *Service) GetSummary(ctx context.Context) (*ObservationSummary, error) {
	summary := &ObservationSummary{}

	// 获取 Pod 异常数量
	podAnomalies, err := s.GetPodAnomalies(ctx, "")
	if err == nil {
		summary.PodAnomalyCount = len(podAnomalies)
	}

	// 获取节点异常数量
	nodeAnomalies, err := s.GetNodeAnomalies(ctx)
	if err == nil {
		summary.NodeAnomalyCount = len(nodeAnomalies)
	}

	// 获取资源超限数量
	resourceExcess, err := s.GetResourceExcess(ctx, "")
	if err == nil {
		summary.ResourceExcessCount = len(resourceExcess)
	}

	// 获取活跃告警数量
	if s.alerts != nil {
		alertSummary, err := s.alerts.GetAlertSummary()
		if err == nil {
			summary.ActiveAlertCount = alertSummary.Critical + alertSummary.Warning
		}
	}

	return summary, nil
}

// GetPodAnomalies 获取异常 Pod 列表
func (s *Service) GetPodAnomalies(ctx context.Context, namespace string) ([]PodAnomaly, error) {
	var anomalies []PodAnomaly

	// 获取所有 Pod
	var pods *corev1.PodList
	var err error
	if namespace == "" {
		pods, err = s.k8s.Clientset.CoreV1().Pods("").List(ctx, metav1.ListOptions{})
	} else {
		pods, err = s.k8s.Clientset.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{})
	}
	if err != nil {
		return nil, err
	}

	now := time.Now()

	for _, pod := range pods.Items {
		// 检查 Pod 是否处于异常状态
		anomaly := s.checkPodAnomaly(&pod, now)
		if anomaly != nil {
			anomalies = append(anomalies, *anomaly)
		}
	}

	return anomalies, nil
}

// checkPodAnomaly 检查单个 Pod 是否异常
func (s *Service) checkPodAnomaly(pod *corev1.Pod, now time.Time) *PodAnomaly {
	// 检查 Pod 状态
	phase := pod.Status.Phase

	// Pending 状态超过 5 分钟
	if phase == corev1.PodPending {
		duration := now.Sub(pod.CreationTimestamp.Time)
		if duration > 5*time.Minute {
			return &PodAnomaly{
				Name:      pod.Name,
				Namespace: pod.Namespace,
				Reason:    string(ReasonPending),
				Message:   getPodConditionMessage(pod),
				Duration:  formatDuration(duration),
				NodeName:  pod.Spec.NodeName,
			}
		}
	}

	// 检查容器状态
	for _, cs := range pod.Status.ContainerStatuses {
		// CrashLoopBackOff
		if cs.State.Waiting != nil && cs.State.Waiting.Reason == "CrashLoopBackOff" {
			return &PodAnomaly{
				Name:         pod.Name,
				Namespace:    pod.Namespace,
				Reason:       string(ReasonCrashLoopBackOff),
				Message:      cs.State.Waiting.Message,
				RestartCount: int(cs.RestartCount),
				Duration:     formatDuration(now.Sub(pod.CreationTimestamp.Time)),
				NodeName:     pod.Spec.NodeName,
			}
		}

		// ImagePullBackOff / ErrImagePull
		if cs.State.Waiting != nil &&
			(cs.State.Waiting.Reason == "ImagePullBackOff" || cs.State.Waiting.Reason == "ErrImagePull") {
			return &PodAnomaly{
				Name:         pod.Name,
				Namespace:    pod.Namespace,
				Reason:       cs.State.Waiting.Reason,
				Message:      cs.State.Waiting.Message,
				RestartCount: int(cs.RestartCount),
				Duration:     formatDuration(now.Sub(pod.CreationTimestamp.Time)),
				NodeName:     pod.Spec.NodeName,
			}
		}

		// OOMKilled（最近终止状态）
		if cs.LastTerminationState.Terminated != nil &&
			cs.LastTerminationState.Terminated.Reason == "OOMKilled" {
			// 只报告最近 1 小时内的 OOMKilled
			if now.Sub(cs.LastTerminationState.Terminated.FinishedAt.Time) < time.Hour {
				return &PodAnomaly{
					Name:         pod.Name,
					Namespace:    pod.Namespace,
					Reason:       string(ReasonOOMKilled),
					Message:      "Container was killed due to OOM",
					RestartCount: int(cs.RestartCount),
					Duration:     formatDuration(now.Sub(cs.LastTerminationState.Terminated.FinishedAt.Time)),
					NodeName:     pod.Spec.NodeName,
				}
			}
		}

		// 高重启次数（超过 5 次）
		if cs.RestartCount > 5 && cs.State.Running != nil {
			return &PodAnomaly{
				Name:         pod.Name,
				Namespace:    pod.Namespace,
				Reason:       "HighRestartCount",
				Message:      fmt.Sprintf("Container has restarted %d times", cs.RestartCount),
				RestartCount: int(cs.RestartCount),
				Duration:     formatDuration(now.Sub(pod.CreationTimestamp.Time)),
				NodeName:     pod.Spec.NodeName,
			}
		}
	}

	return nil
}

// GetNodeAnomalies 获取异常节点列表
func (s *Service) GetNodeAnomalies(ctx context.Context) ([]NodeAnomaly, error) {
	var anomalies []NodeAnomaly

	nodes, err := s.k8s.Clientset.CoreV1().Nodes().List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	now := time.Now()

	for _, node := range nodes.Items {
		for _, cond := range node.Status.Conditions {
			var anomaly *NodeAnomaly

			switch cond.Type {
			case corev1.NodeReady:
				if cond.Status != corev1.ConditionTrue {
					// 获取该节点上的 Pod 数量
					pods, _ := s.k8s.Clientset.CoreV1().Pods("").List(ctx, metav1.ListOptions{
						FieldSelector: fmt.Sprintf("spec.nodeName=%s", node.Name),
					})
					affectedPods := 0
					if pods != nil {
						affectedPods = len(pods.Items)
					}

					anomaly = &NodeAnomaly{
						Name:         node.Name,
						Reason:       string(NodeConditionNotReady),
						Message:      cond.Message,
						Duration:     formatDuration(now.Sub(cond.LastTransitionTime.Time)),
						AffectedPods: affectedPods,
					}
				}
			case corev1.NodeMemoryPressure:
				if cond.Status == corev1.ConditionTrue {
					anomaly = &NodeAnomaly{
						Name:     node.Name,
						Reason:   string(NodeConditionMemoryPressure),
						Message:  cond.Message,
						Duration: formatDuration(now.Sub(cond.LastTransitionTime.Time)),
					}
				}
			case corev1.NodeDiskPressure:
				if cond.Status == corev1.ConditionTrue {
					anomaly = &NodeAnomaly{
						Name:     node.Name,
						Reason:   string(NodeConditionDiskPressure),
						Message:  cond.Message,
						Duration: formatDuration(now.Sub(cond.LastTransitionTime.Time)),
					}
				}
			case corev1.NodePIDPressure:
				if cond.Status == corev1.ConditionTrue {
					anomaly = &NodeAnomaly{
						Name:     node.Name,
						Reason:   string(NodeConditionPIDPressure),
						Message:  cond.Message,
						Duration: formatDuration(now.Sub(cond.LastTransitionTime.Time)),
					}
				}
			}

			if anomaly != nil {
				anomalies = append(anomalies, *anomaly)
			}
		}
	}

	return anomalies, nil
}

// GetResourceExcess 获取资源超限列表
func (s *Service) GetResourceExcess(ctx context.Context, namespace string) ([]ResourceExcess, error) {
	var excess []ResourceExcess

	if s.metrics == nil {
		return excess, nil
	}

	// 查询 CPU 超限的 Pod
	cpuResp, err := s.metrics.Query(QueryHighCPUPods)
	if err == nil {
		for _, result := range cpuResp.Data.Result {
			ns := result.Metric["namespace"]
			pod := result.Metric["pod"]
			if namespace != "" && ns != namespace {
				continue
			}
			var usage float64
			if len(result.Value) >= 2 {
				if val, ok := result.Value[1].(string); ok {
					fmt.Sscanf(val, "%f", &usage)
				}
			}
			excess = append(excess, ResourceExcess{
				Type:         string(ResourceTypeCPU),
				ResourceName: pod,
				Namespace:    ns,
				UsagePercent: usage * 100,
				Threshold:    DefaultCPUThreshold * 100,
			})
		}
	}

	// 查询内存超限的 Pod
	memResp, err := s.metrics.Query(QueryHighMemoryPods)
	if err == nil {
		for _, result := range memResp.Data.Result {
			ns := result.Metric["namespace"]
			pod := result.Metric["pod"]
			if namespace != "" && ns != namespace {
				continue
			}
			var usage float64
			if len(result.Value) >= 2 {
				if val, ok := result.Value[1].(string); ok {
					fmt.Sscanf(val, "%f", &usage)
				}
			}
			excess = append(excess, ResourceExcess{
				Type:         string(ResourceTypeMemory),
				ResourceName: pod,
				Namespace:    ns,
				UsagePercent: usage * 100,
				Threshold:    DefaultMemoryThreshold * 100,
			})
		}
	}

	return excess, nil
}

// GetResourceTrend 获取资源使用趋势
func (s *Service) GetResourceTrend(ctx context.Context, resourceType ResourceType, timeRange TimeRange) (*ResourceTrend, error) {
	if s.metrics == nil {
		return nil, fmt.Errorf("metrics client not configured")
	}

	var query string
	switch resourceType {
	case ResourceTypeCPU:
		query = QueryCPUUsagePercent
	case ResourceTypeMemory:
		query = QueryMemoryUsagePercent
	default:
		return nil, fmt.Errorf("unsupported resource type: %s", resourceType)
	}

	trend := &ResourceTrend{}
	end := time.Now()
	duration := timeRange.Duration()
	if duration == 0 {
		duration = time.Hour // 默认 1 小时
	}
	start := end.Add(-duration)
	step := timeRange.Step()

	// 当前周期数据
	resp, err := s.metrics.QueryRange(query, start, end, step)
	if err != nil {
		return nil, err
	}
	trend.Current = extractTimeSeriesPoints(resp)

	// 计算周环比（上周同期）
	prevStart := start.Add(-7 * 24 * time.Hour)
	prevEnd := end.Add(-7 * 24 * time.Hour)
	prevResp, err := s.metrics.QueryRange(query, prevStart, prevEnd, step)
	if err == nil {
		trend.Previous = extractTimeSeriesPoints(prevResp)
	}

	// 计算同比环比
	trend.Comparison = calculateComparison(trend.Current, trend.Previous)

	return trend, nil
}

// GetAlertTrend 获取告警趋势
func (s *Service) GetAlertTrend(ctx context.Context, timeRange TimeRange) (*AlertTrend, error) {
	// 由于告警数据来自 Alertmanager，这里返回模拟数据
	// 实际实现需要从 Alertmanager API 获取历史数据
	trend := &AlertTrend{
		Current:    []AlertTrendPoint{},
		Previous:   []AlertTrendPoint{},
		Comparison: ComparisonResult{},
	}

	if s.alerts != nil {
		// 获取当前告警摘要作为基础数据
		summary, err := s.alerts.GetAlertSummary()
		if err == nil {
			// 简化处理：使用当前数据作为趋势点
			today := time.Now().Format("2006-01-02")
			trend.Current = []AlertTrendPoint{
				{Date: today, Count: summary.Critical + summary.Warning + summary.Info},
			}
			trend.Comparison.CurrentAvg = float64(summary.Critical + summary.Warning + summary.Info)
		}
	}

	return trend, nil
}

// GetRestartTrend 获取 Pod 重启趋势
func (s *Service) GetRestartTrend(ctx context.Context, timeRange TimeRange) (*RestartTrend, error) {
	if s.metrics == nil {
		return nil, fmt.Errorf("metrics client not configured")
	}

	trend := &RestartTrend{}
	end := time.Now()
	duration := timeRange.Duration()
	if duration == 0 {
		duration = time.Hour
	}
	start := end.Add(-duration)
	step := timeRange.Step()

	// 查询重启次数趋势
	resp, err := s.metrics.QueryRange(QueryPodRestarts, start, end, step)
	if err != nil {
		return nil, err
	}

	// 转换为 RestartTrendPoint
	points := extractTimeSeriesPoints(resp)
	for _, p := range points {
		trend.Current = append(trend.Current, RestartTrendPoint{
			Date:  time.Unix(p.Timestamp, 0).Format("2006-01-02 15:04"),
			Count: int(p.Value),
		})
	}

	// 计算周环比
	prevStart := start.Add(-7 * 24 * time.Hour)
	prevEnd := end.Add(-7 * 24 * time.Hour)
	prevResp, err := s.metrics.QueryRange(QueryPodRestarts, prevStart, prevEnd, step)
	if err == nil {
		prevPoints := extractTimeSeriesPoints(prevResp)
		for _, p := range prevPoints {
			trend.Previous = append(trend.Previous, RestartTrendPoint{
				Date:  time.Unix(p.Timestamp, 0).Format("2006-01-02 15:04"),
				Count: int(p.Value),
			})
		}
	}

	// 计算同比环比
	currentSum := 0.0
	for _, p := range trend.Current {
		currentSum += float64(p.Count)
	}
	previousSum := 0.0
	for _, p := range trend.Previous {
		previousSum += float64(p.Count)
	}

	if len(trend.Current) > 0 {
		trend.Comparison.CurrentAvg = currentSum / float64(len(trend.Current))
	}
	if previousSum > 0 {
		trend.Comparison.WoW = (currentSum - previousSum) / previousSum * 100
	}
	if currentSum > previousSum {
		trend.Comparison.Trend = "up"
	} else if currentSum < previousSum {
		trend.Comparison.Trend = "down"
	} else {
		trend.Comparison.Trend = "stable"
	}

	return trend, nil
}

// 辅助函数

func getPodConditionMessage(pod *corev1.Pod) string {
	for _, cond := range pod.Status.Conditions {
		if cond.Status != corev1.ConditionTrue && cond.Message != "" {
			return cond.Message
		}
	}
	return "Pod is pending"
}

func formatDuration(d time.Duration) string {
	if d < time.Minute {
		return fmt.Sprintf("%ds", int(d.Seconds()))
	}
	if d < time.Hour {
		return fmt.Sprintf("%dm", int(d.Minutes()))
	}
	if d < 24*time.Hour {
		return fmt.Sprintf("%dh", int(d.Hours()))
	}
	return fmt.Sprintf("%dd", int(d.Hours()/24))
}

func extractTimeSeriesPoints(resp *metrics.QueryResponse) []TimeSeriesPoint {
	var points []TimeSeriesPoint
	if len(resp.Data.Result) == 0 {
		return points
	}

	for _, v := range resp.Data.Result[0].Values {
		if len(v) >= 2 {
			ts, _ := v[0].(float64)
			var val float64
			if strVal, ok := v[1].(string); ok {
				fmt.Sscanf(strVal, "%f", &val)
			}
			points = append(points, TimeSeriesPoint{
				Timestamp: int64(ts),
				Value:     val,
			})
		}
	}

	return points
}

func calculateComparison(current, previous []TimeSeriesPoint) ComparisonResult {
	result := ComparisonResult{}

	// 计算当前平均值
	currentSum := 0.0
	for _, p := range current {
		currentSum += p.Value
	}
	if len(current) > 0 {
		result.CurrentAvg = currentSum / float64(len(current))
	}

	// 计算上周平均值（周环比）
	previousSum := 0.0
	for _, p := range previous {
		previousSum += p.Value
	}
	if len(previous) > 0 {
		previousAvg := previousSum / float64(len(previous))
		if previousAvg > 0 {
			result.WoW = (result.CurrentAvg - previousAvg) / previousAvg * 100
		}
	}

	// 判断趋势
	if result.WoW > 5 {
		result.Trend = "up"
	} else if result.WoW < -5 {
		result.Trend = "down"
	} else {
		result.Trend = "stable"
	}

	return result
}
