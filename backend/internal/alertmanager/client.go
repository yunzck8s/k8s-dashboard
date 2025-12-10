package alertmanager

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// Client Alertmanager 客户端
type Client struct {
	baseURL    string
	httpClient *http.Client
}

// NewClient 创建 Alertmanager 客户端
func NewClient(baseURL string) *Client {
	return &Client{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// Alert Alertmanager 告警结构
type Alert struct {
	Labels       map[string]string `json:"labels"`
	Annotations  map[string]string `json:"annotations"`
	StartsAt     time.Time         `json:"startsAt"`
	EndsAt       time.Time         `json:"endsAt"`
	GeneratorURL string            `json:"generatorURL"`
	Fingerprint  string            `json:"fingerprint"`
	Status       AlertStatus       `json:"status"`
	Receivers    []Receiver        `json:"receivers"`
	UpdatedAt    time.Time         `json:"updatedAt"`
}

// AlertStatus 告警状态
type AlertStatus struct {
	State       string   `json:"state"`
	SilencedBy  []string `json:"silencedBy"`
	InhibitedBy []string `json:"inhibitedBy"`
	MutedBy     []string `json:"mutedBy"`
}

// Receiver 接收器
type Receiver struct {
	Name string `json:"name"`
}

// AlertSummary 告警摘要（用于仪表盘）
type AlertSummary struct {
	Total    int `json:"total"`
	Critical int `json:"critical"`
	Warning  int `json:"warning"`
	Info     int `json:"info"`
}

// AlertGroup 告警分组
type AlertGroup struct {
	Labels   map[string]string `json:"labels"`
	Receiver Receiver          `json:"receiver"`
	Alerts   []Alert           `json:"alerts"`
}

// GetAlerts 获取所有告警
func (c *Client) GetAlerts() ([]Alert, error) {
	resp, err := c.httpClient.Get(fmt.Sprintf("%s/api/v2/alerts", c.baseURL))
	if err != nil {
		return nil, fmt.Errorf("获取告警失败: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("读取响应失败: %w", err)
	}

	var alerts []Alert
	if err := json.Unmarshal(body, &alerts); err != nil {
		return nil, fmt.Errorf("解析告警失败: %w", err)
	}

	return alerts, nil
}

// GetAlertGroups 获取告警分组
func (c *Client) GetAlertGroups() ([]AlertGroup, error) {
	resp, err := c.httpClient.Get(fmt.Sprintf("%s/api/v2/alerts/groups", c.baseURL))
	if err != nil {
		return nil, fmt.Errorf("获取告警分组失败: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("读取响应失败: %w", err)
	}

	var groups []AlertGroup
	if err := json.Unmarshal(body, &groups); err != nil {
		return nil, fmt.Errorf("解析告警分组失败: %w", err)
	}

	return groups, nil
}

// GetAlertSummary 获取告警摘要
func (c *Client) GetAlertSummary() (*AlertSummary, error) {
	alerts, err := c.GetAlerts()
	if err != nil {
		return nil, err
	}

	summary := &AlertSummary{
		Total: len(alerts),
	}

	for _, alert := range alerts {
		// 只统计活跃状态的告警
		if alert.Status.State != "active" {
			continue
		}

		severity := alert.Labels["severity"]
		switch severity {
		case "critical":
			summary.Critical++
		case "warning":
			summary.Warning++
		case "info":
			summary.Info++
		default:
			// 没有指定严重级别的告警，默认为 warning
			summary.Warning++
		}
	}

	return summary, nil
}

// GetActiveAlerts 获取活跃告警（按严重级别排序）
func (c *Client) GetActiveAlerts() ([]Alert, error) {
	alerts, err := c.GetAlerts()
	if err != nil {
		return nil, err
	}

	// 过滤活跃告警并排序
	var activeAlerts []Alert
	for _, alert := range alerts {
		if alert.Status.State == "active" {
			activeAlerts = append(activeAlerts, alert)
		}
	}

	// 按严重级别排序: critical > warning > info
	severityOrder := map[string]int{
		"critical": 0,
		"warning":  1,
		"info":     2,
	}

	for i := 0; i < len(activeAlerts)-1; i++ {
		for j := i + 1; j < len(activeAlerts); j++ {
			si := severityOrder[activeAlerts[i].Labels["severity"]]
			sj := severityOrder[activeAlerts[j].Labels["severity"]]
			if si > sj {
				activeAlerts[i], activeAlerts[j] = activeAlerts[j], activeAlerts[i]
			}
		}
	}

	return activeAlerts, nil
}
