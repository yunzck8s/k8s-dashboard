package metrics

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

// Client VictoriaMetrics 客户端
type Client struct {
	baseURL    string
	queryPath  string // vmselect 集群模式的查询路径
	httpClient *http.Client
}

// NewClient 创建 VictoriaMetrics 客户端
// baseURL: VictoriaMetrics 地址，支持 vmauth 代理
func NewClient(baseURL string) *Client {
	return &Client{
		baseURL:   baseURL,
		queryPath: "/select/0/prometheus", // vmselect 集群模式路径
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// QueryResponse Prometheus/VictoriaMetrics 查询响应
type QueryResponse struct {
	Status string `json:"status"`
	Data   struct {
		ResultType string        `json:"resultType"`
		Result     []QueryResult `json:"result"`
	} `json:"data"`
	Error     string `json:"error,omitempty"`
	ErrorType string `json:"errorType,omitempty"`
}

// QueryResult 查询结果
type QueryResult struct {
	Metric map[string]string `json:"metric"`
	Value  []interface{}     `json:"value,omitempty"`  // [timestamp, value]
	Values [][]interface{}   `json:"values,omitempty"` // [[timestamp, value], ...]
}

// Query 执行即时查询
func (c *Client) Query(query string) (*QueryResponse, error) {
	params := url.Values{}
	params.Set("query", query)

	resp, err := c.httpClient.Get(fmt.Sprintf("%s%s/api/v1/query?%s", c.baseURL, c.queryPath, params.Encode()))
	if err != nil {
		return nil, fmt.Errorf("查询失败: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("读取响应失败: %w", err)
	}

	var result QueryResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("解析响应失败: %w", err)
	}

	if result.Status != "success" {
		return nil, fmt.Errorf("查询错误: %s", result.Error)
	}

	return &result, nil
}

// QueryRange 执行范围查询
func (c *Client) QueryRange(query string, start, end time.Time, step string) (*QueryResponse, error) {
	params := url.Values{}
	params.Set("query", query)
	params.Set("start", fmt.Sprintf("%d", start.Unix()))
	params.Set("end", fmt.Sprintf("%d", end.Unix()))
	params.Set("step", step)

	resp, err := c.httpClient.Get(fmt.Sprintf("%s%s/api/v1/query_range?%s", c.baseURL, c.queryPath, params.Encode()))
	if err != nil {
		return nil, fmt.Errorf("范围查询失败: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("读取响应失败: %w", err)
	}

	var result QueryResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("解析响应失败: %w", err)
	}

	if result.Status != "success" {
		return nil, fmt.Errorf("查询错误: %s", result.Error)
	}

	return &result, nil
}

// ClusterMetrics 集群指标概览
type ClusterMetrics struct {
	CPU    ResourceMetric `json:"cpu"`
	Memory ResourceMetric `json:"memory"`
	Pods   ResourceMetric `json:"pods"`
}

// ResourceMetric 资源指标
type ResourceMetric struct {
	Used  float64 `json:"used"`
	Total float64 `json:"total"`
	Unit  string  `json:"unit"`
}

// NodeMetrics 节点指标
type NodeMetrics struct {
	Name        string  `json:"name"`
	CPUUsage    float64 `json:"cpuUsage"`    // 百分比
	MemoryUsage float64 `json:"memoryUsage"` // 百分比
	CPUCores    float64 `json:"cpuCores"`
	MemoryBytes float64 `json:"memoryBytes"`
}

// PodMetrics Pod 指标
type PodMetrics struct {
	Namespace   string  `json:"namespace"`
	Name        string  `json:"name"`
	CPUUsage    float64 `json:"cpuUsage"`    // cores
	MemoryUsage float64 `json:"memoryUsage"` // bytes
}

// GetClusterMetrics 获取集群指标概览
func (c *Client) GetClusterMetrics() (*ClusterMetrics, error) {
	metrics := &ClusterMetrics{}

	// CPU 使用量 (cores)
	cpuUsedResp, err := c.Query(`sum(rate(container_cpu_usage_seconds_total{container!="",container!="POD"}[5m]))`)
	if err == nil && len(cpuUsedResp.Data.Result) > 0 {
		if val, ok := cpuUsedResp.Data.Result[0].Value[1].(string); ok {
			fmt.Sscanf(val, "%f", &metrics.CPU.Used)
		}
	}

	// CPU 总量 (cores) - 使用 kube_node_status_capacity
	cpuTotalResp, err := c.Query(`sum(kube_node_status_capacity{resource="cpu"})`)
	if err == nil && len(cpuTotalResp.Data.Result) > 0 {
		if val, ok := cpuTotalResp.Data.Result[0].Value[1].(string); ok {
			fmt.Sscanf(val, "%f", &metrics.CPU.Total)
		}
	}
	metrics.CPU.Unit = "cores"

	// 内存使用量 (GB)
	memUsedResp, err := c.Query(`sum(container_memory_working_set_bytes{container!="",container!="POD"})`)
	if err == nil && len(memUsedResp.Data.Result) > 0 {
		if val, ok := memUsedResp.Data.Result[0].Value[1].(string); ok {
			var bytes float64
			fmt.Sscanf(val, "%f", &bytes)
			metrics.Memory.Used = bytes / 1024 / 1024 / 1024
		}
	}

	// 内存总量 (GB) - 使用 kube_node_status_capacity
	memTotalResp, err := c.Query(`sum(kube_node_status_capacity{resource="memory"})`)
	if err == nil && len(memTotalResp.Data.Result) > 0 {
		if val, ok := memTotalResp.Data.Result[0].Value[1].(string); ok {
			var bytes float64
			fmt.Sscanf(val, "%f", &bytes)
			metrics.Memory.Total = bytes / 1024 / 1024 / 1024
		}
	}
	metrics.Memory.Unit = "GB"

	// Pod 数量 - 使用 kube_pod_status_phase
	podUsedResp, err := c.Query(`count(kube_pod_status_phase{phase="Running"})`)
	if err == nil && len(podUsedResp.Data.Result) > 0 {
		if val, ok := podUsedResp.Data.Result[0].Value[1].(string); ok {
			fmt.Sscanf(val, "%f", &metrics.Pods.Used)
		}
	}

	// Pod 容量 - 使用 kube_node_status_capacity
	podCapacityResp, err := c.Query(`sum(kube_node_status_capacity{resource="pods"})`)
	if err == nil && len(podCapacityResp.Data.Result) > 0 {
		if val, ok := podCapacityResp.Data.Result[0].Value[1].(string); ok {
			fmt.Sscanf(val, "%f", &metrics.Pods.Total)
		}
	}
	metrics.Pods.Unit = "pods"

	return metrics, nil
}

// GetNodeMetrics 获取节点指标
func (c *Client) GetNodeMetrics(nodeName string) (*NodeMetrics, error) {
	metrics := &NodeMetrics{Name: nodeName}

	// CPU 使用率
	cpuQuery := fmt.Sprintf(`100 - (avg by(instance) (rate(node_cpu_seconds_total{mode="idle",instance=~"%s.*"}[5m])) * 100)`, nodeName)
	cpuResp, err := c.Query(cpuQuery)
	if err == nil && len(cpuResp.Data.Result) > 0 {
		if val, ok := cpuResp.Data.Result[0].Value[1].(string); ok {
			fmt.Sscanf(val, "%f", &metrics.CPUUsage)
		}
	}

	// 内存使用率
	memQuery := fmt.Sprintf(`(1 - (node_memory_MemAvailable_bytes{instance=~"%s.*"} / node_memory_MemTotal_bytes{instance=~"%s.*"})) * 100`, nodeName, nodeName)
	memResp, err := c.Query(memQuery)
	if err == nil && len(memResp.Data.Result) > 0 {
		if val, ok := memResp.Data.Result[0].Value[1].(string); ok {
			fmt.Sscanf(val, "%f", &metrics.MemoryUsage)
		}
	}

	return metrics, nil
}

// GetPodMetrics 获取 Pod 指标
func (c *Client) GetPodMetrics(namespace, podName string) (*PodMetrics, error) {
	metrics := &PodMetrics{
		Namespace: namespace,
		Name:      podName,
	}

	// CPU 使用量
	cpuQuery := fmt.Sprintf(`sum(rate(container_cpu_usage_seconds_total{namespace="%s",pod="%s",container!="",container!="POD"}[5m]))`, namespace, podName)
	cpuResp, err := c.Query(cpuQuery)
	if err == nil && len(cpuResp.Data.Result) > 0 {
		if val, ok := cpuResp.Data.Result[0].Value[1].(string); ok {
			fmt.Sscanf(val, "%f", &metrics.CPUUsage)
		}
	}

	// 内存使用量
	memQuery := fmt.Sprintf(`sum(container_memory_working_set_bytes{namespace="%s",pod="%s",container!="",container!="POD"})`, namespace, podName)
	memResp, err := c.Query(memQuery)
	if err == nil && len(memResp.Data.Result) > 0 {
		if val, ok := memResp.Data.Result[0].Value[1].(string); ok {
			fmt.Sscanf(val, "%f", &metrics.MemoryUsage)
		}
	}

	return metrics, nil
}

// GetAllPodMetrics 批量获取所有 Pod 的指标
func (c *Client) GetAllPodMetrics() ([]PodMetrics, error) {
	var result []PodMetrics
	podMetricsMap := make(map[string]*PodMetrics)

	// 批量查询所有 Pod 的 CPU 使用量
	cpuQuery := `sum by (namespace, pod) (rate(container_cpu_usage_seconds_total{container!="",container!="POD"}[5m]))`
	cpuResp, err := c.Query(cpuQuery)
	if err != nil {
		return nil, fmt.Errorf("查询 CPU 指标失败: %w", err)
	}

	for _, res := range cpuResp.Data.Result {
		ns := res.Metric["namespace"]
		pod := res.Metric["pod"]
		if ns == "" || pod == "" {
			continue
		}

		key := ns + "/" + pod
		if _, exists := podMetricsMap[key]; !exists {
			podMetricsMap[key] = &PodMetrics{
				Namespace: ns,
				Name:      pod,
			}
		}

		if len(res.Value) >= 2 {
			if val, ok := res.Value[1].(string); ok {
				fmt.Sscanf(val, "%f", &podMetricsMap[key].CPUUsage)
			}
		}
	}

	// 批量查询所有 Pod 的内存使用量
	memQuery := `sum by (namespace, pod) (container_memory_working_set_bytes{container!="",container!="POD"})`
	memResp, err := c.Query(memQuery)
	if err != nil {
		return nil, fmt.Errorf("查询内存指标失败: %w", err)
	}

	for _, res := range memResp.Data.Result {
		ns := res.Metric["namespace"]
		pod := res.Metric["pod"]
		if ns == "" || pod == "" {
			continue
		}

		key := ns + "/" + pod
		if _, exists := podMetricsMap[key]; !exists {
			podMetricsMap[key] = &PodMetrics{
				Namespace: ns,
				Name:      pod,
			}
		}

		if len(res.Value) >= 2 {
			if val, ok := res.Value[1].(string); ok {
				fmt.Sscanf(val, "%f", &podMetricsMap[key].MemoryUsage)
			}
		}
	}

	// 转换为切片
	for _, m := range podMetricsMap {
		result = append(result, *m)
	}

	return result, nil
}

// TimeSeriesData 时序数据点
type TimeSeriesData struct {
	Timestamp int64   `json:"timestamp"`
	Value     float64 `json:"value"`
}

// GetCPUHistory 获取 CPU 历史数据
func (c *Client) GetCPUHistory(duration string, step string) ([]TimeSeriesData, error) {
	end := time.Now()
	start := end.Add(-parseDuration(duration))

	query := `sum(rate(container_cpu_usage_seconds_total{container!="",container!="POD"}[5m]))`
	resp, err := c.QueryRange(query, start, end, step)
	if err != nil {
		return nil, err
	}

	return extractTimeSeries(resp), nil
}

// GetMemoryHistory 获取内存历史数据
func (c *Client) GetMemoryHistory(duration string, step string) ([]TimeSeriesData, error) {
	end := time.Now()
	start := end.Add(-parseDuration(duration))

	query := `sum(container_memory_working_set_bytes{container!="",container!="POD"}) / 1024 / 1024 / 1024`
	resp, err := c.QueryRange(query, start, end, step)
	if err != nil {
		return nil, err
	}

	return extractTimeSeries(resp), nil
}

// 解析时间范围
func parseDuration(d string) time.Duration {
	switch d {
	case "1h":
		return time.Hour
	case "6h":
		return 6 * time.Hour
	case "24h":
		return 24 * time.Hour
	case "7d":
		return 7 * 24 * time.Hour
	default:
		return time.Hour
	}
}

// 从响应中提取时序数据
func extractTimeSeries(resp *QueryResponse) []TimeSeriesData {
	var result []TimeSeriesData
	if len(resp.Data.Result) == 0 {
		return result
	}

	for _, v := range resp.Data.Result[0].Values {
		if len(v) >= 2 {
			ts, _ := v[0].(float64)
			var val float64
			if strVal, ok := v[1].(string); ok {
				fmt.Sscanf(strVal, "%f", &val)
			}
			result = append(result, TimeSeriesData{
				Timestamp: int64(ts),
				Value:     val,
			})
		}
	}

	return result
}
