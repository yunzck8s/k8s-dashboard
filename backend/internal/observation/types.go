package observation

import "time"

// ObservationSummary 异常状态汇总
type ObservationSummary struct {
	PodAnomalyCount     int `json:"podAnomalyCount"`
	NodeAnomalyCount    int `json:"nodeAnomalyCount"`
	ResourceExcessCount int `json:"resourceExcessCount"`
	ActiveAlertCount    int `json:"activeAlertCount"`
}

// PodAnomaly Pod 异常
type PodAnomaly struct {
	Name         string `json:"name"`
	Namespace    string `json:"namespace"`
	Reason       string `json:"reason"`       // CrashLoopBackOff, OOMKilled, ImagePullBackOff, Pending 等
	Message      string `json:"message"`
	RestartCount int    `json:"restartCount"`
	Duration     string `json:"duration"`
	NodeName     string `json:"nodeName,omitempty"`
}

// NodeAnomaly 节点异常
type NodeAnomaly struct {
	Name         string `json:"name"`
	Reason       string `json:"reason"`   // NotReady, MemoryPressure, DiskPressure, PIDPressure
	Message      string `json:"message"`
	Duration     string `json:"duration"`
	AffectedPods int    `json:"affectedPods"`
}

// ResourceExcess 资源超限
type ResourceExcess struct {
	Type         string  `json:"type"`         // cpu, memory, disk
	ResourceName string  `json:"resourceName"` // Pod 名称或节点名称
	Namespace    string  `json:"namespace,omitempty"`
	UsagePercent float64 `json:"usagePercent"`
	Threshold    float64 `json:"threshold"`
}

// TimeSeriesPoint 时序数据点
type TimeSeriesPoint struct {
	Timestamp int64   `json:"timestamp"`
	Value     float64 `json:"value"`
}

// ComparisonResult 同比环比结果
type ComparisonResult struct {
	WoW        float64 `json:"wow"`        // 周环比（Week-over-Week）
	MoM        float64 `json:"mom"`        // 月同比（Month-over-Month）
	Trend      string  `json:"trend"`      // up, down, stable
	CurrentAvg float64 `json:"currentAvg"` // 当前周期平均值
}

// ResourceTrend 资源使用趋势（含同比环比）
type ResourceTrend struct {
	Current    []TimeSeriesPoint `json:"current"`
	Previous   []TimeSeriesPoint `json:"previous,omitempty"`
	Comparison ComparisonResult  `json:"comparison"`
}

// AlertTrendPoint 告警趋势数据点
type AlertTrendPoint struct {
	Date  string `json:"date"`  // 日期字符串 (YYYY-MM-DD)
	Count int    `json:"count"` // 告警数量
}

// AlertTrend 告警趋势（含同比环比）
type AlertTrend struct {
	Current    []AlertTrendPoint `json:"current"`
	Previous   []AlertTrendPoint `json:"previous,omitempty"`
	Comparison ComparisonResult  `json:"comparison"`
}

// RestartTrendPoint Pod 重启趋势数据点
type RestartTrendPoint struct {
	Date    string `json:"date"`
	Count   int    `json:"count"`
	PodName string `json:"podName,omitempty"`
}

// RestartTrend Pod 重启趋势
type RestartTrend struct {
	Current    []RestartTrendPoint `json:"current"`
	Previous   []RestartTrendPoint `json:"previous,omitempty"`
	Comparison ComparisonResult    `json:"comparison"`
}

// TimeRange 时间范围类型
type TimeRange string

const (
	TimeRangeRealtime TimeRange = "realtime"
	TimeRange1Hour    TimeRange = "1h"
	TimeRange24Hours  TimeRange = "24h"
	TimeRange7Days    TimeRange = "7d"
	TimeRange30Days   TimeRange = "30d"
)

// ParseTimeRange 解析时间范围字符串
func ParseTimeRange(s string) TimeRange {
	switch s {
	case "1h":
		return TimeRange1Hour
	case "24h":
		return TimeRange24Hours
	case "7d":
		return TimeRange7Days
	case "30d":
		return TimeRange30Days
	default:
		return TimeRangeRealtime
	}
}

// Duration 获取时间范围对应的 time.Duration
func (tr TimeRange) Duration() time.Duration {
	switch tr {
	case TimeRange1Hour:
		return time.Hour
	case TimeRange24Hours:
		return 24 * time.Hour
	case TimeRange7Days:
		return 7 * 24 * time.Hour
	case TimeRange30Days:
		return 30 * 24 * time.Hour
	default:
		return 0 // 实时数据
	}
}

// Step 获取查询步长
func (tr TimeRange) Step() string {
	switch tr {
	case TimeRange1Hour:
		return "1m"
	case TimeRange24Hours:
		return "5m"
	case TimeRange7Days:
		return "1h"
	case TimeRange30Days:
		return "4h"
	default:
		return "1m"
	}
}

// ResourceType 资源类型
type ResourceType string

const (
	ResourceTypeCPU    ResourceType = "cpu"
	ResourceTypeMemory ResourceType = "memory"
)

// AnomalyReason Pod 异常原因
type AnomalyReason string

const (
	ReasonCrashLoopBackOff AnomalyReason = "CrashLoopBackOff"
	ReasonOOMKilled        AnomalyReason = "OOMKilled"
	ReasonImagePullBackOff AnomalyReason = "ImagePullBackOff"
	ReasonErrImagePull     AnomalyReason = "ErrImagePull"
	ReasonPending          AnomalyReason = "Pending"
	ReasonContainerCreating AnomalyReason = "ContainerCreating"
)

// NodeCondition 节点状态
type NodeCondition string

const (
	NodeConditionNotReady       NodeCondition = "NotReady"
	NodeConditionMemoryPressure NodeCondition = "MemoryPressure"
	NodeConditionDiskPressure   NodeCondition = "DiskPressure"
	NodeConditionPIDPressure    NodeCondition = "PIDPressure"
)

// 默认阈值
const (
	DefaultCPUThreshold    = 0.8  // 80%
	DefaultMemoryThreshold = 0.8  // 80%
	DefaultDiskThreshold   = 0.85 // 85%
)
