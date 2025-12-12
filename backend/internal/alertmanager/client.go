package alertmanager

import (
	"bytes"
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

// AlertFilter 告警过滤条件
type AlertFilter struct {
	Severity  string // critical, warning, info
	Namespace string
	AlertName string
	State     string // active, suppressed, unprocessed
}

// GetActiveAlerts 获取活跃告警（按严重级别排序）
func (c *Client) GetActiveAlerts() ([]Alert, error) {
	return c.GetFilteredAlerts(AlertFilter{State: "active"})
}

// GetFilteredAlerts 获取过滤后的告警（按严重级别排序）
func (c *Client) GetFilteredAlerts(filter AlertFilter) ([]Alert, error) {
	alerts, err := c.GetAlerts()
	if err != nil {
		return nil, err
	}

	// 过滤告警
	var filteredAlerts []Alert
	for _, alert := range alerts {
		// 状态过滤（默认只显示活跃告警）
		if filter.State != "" && alert.Status.State != filter.State {
			continue
		}

		// 严重级别过滤
		if filter.Severity != "" && alert.Labels["severity"] != filter.Severity {
			continue
		}

		// 命名空间过滤
		if filter.Namespace != "" && alert.Labels["namespace"] != filter.Namespace {
			continue
		}

		// 告警名称过滤
		if filter.AlertName != "" && alert.Labels["alertname"] != filter.AlertName {
			continue
		}

		filteredAlerts = append(filteredAlerts, alert)
	}

	// 按严重级别排序: critical > warning > info
	severityOrder := map[string]int{
		"critical": 0,
		"warning":  1,
		"info":     2,
	}

	for i := 0; i < len(filteredAlerts)-1; i++ {
		for j := i + 1; j < len(filteredAlerts); j++ {
			si := severityOrder[filteredAlerts[i].Labels["severity"]]
			sj := severityOrder[filteredAlerts[j].Labels["severity"]]
			if si > sj {
				filteredAlerts[i], filteredAlerts[j] = filteredAlerts[j], filteredAlerts[i]
			}
		}
	}

	return filteredAlerts, nil
}

// GetAlertByFingerprint 根据 fingerprint 获取单个告警
func (c *Client) GetAlertByFingerprint(fingerprint string) (*Alert, error) {
	alerts, err := c.GetAlerts()
	if err != nil {
		return nil, err
	}

	for _, alert := range alerts {
		if alert.Fingerprint == fingerprint {
			return &alert, nil
		}
	}

	return nil, fmt.Errorf("告警未找到: %s", fingerprint)
}

// GetAlertNames 获取所有告警名称（用于过滤器下拉选项）
func (c *Client) GetAlertNames() ([]string, error) {
	alerts, err := c.GetAlerts()
	if err != nil {
		return nil, err
	}

	nameMap := make(map[string]bool)
	for _, alert := range alerts {
		if name := alert.Labels["alertname"]; name != "" {
			nameMap[name] = true
		}
	}

	names := make([]string, 0, len(nameMap))
	for name := range nameMap {
		names = append(names, name)
	}

	return names, nil
}

// ========== 静默管理 ==========

// Silence 静默规则结构
type Silence struct {
	ID        string                   `json:"id"`
	Matchers  []Matcher                `json:"matchers"`
	StartsAt  time.Time                `json:"startsAt"`
	EndsAt    time.Time                `json:"endsAt"`
	CreatedBy string                   `json:"createdBy"`
	Comment   string                   `json:"comment"`
	Status    SilenceStatus            `json:"status"`
}

// Matcher 标签匹配器
type Matcher struct {
	Name    string `json:"name"`
	Value   string `json:"value"`
	IsRegex bool   `json:"isRegex"`
	IsEqual bool   `json:"isEqual"` // true = =, false = !=
}

// SilenceStatus 静默状态
type SilenceStatus struct {
	State string `json:"state"` // active, pending, expired
}

// GetSilences 获取所有静默规则
func (c *Client) GetSilences() ([]Silence, error) {
	resp, err := c.httpClient.Get(fmt.Sprintf("%s/api/v2/silences", c.baseURL))
	if err != nil {
		return nil, fmt.Errorf("获取静默规则失败: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("读取响应失败: %w", err)
	}

	var silences []Silence
	if err := json.Unmarshal(body, &silences); err != nil {
		return nil, fmt.Errorf("解析静默规则失败: %w", err)
	}

	return silences, nil
}

// GetSilence 获取单个静默规则
func (c *Client) GetSilence(id string) (*Silence, error) {
	resp, err := c.httpClient.Get(fmt.Sprintf("%s/api/v2/silence/%s", c.baseURL, id))
	if err != nil {
		return nil, fmt.Errorf("获取静默规则失败: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == 404 {
		return nil, fmt.Errorf("静默规则不存在: %s", id)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("读取响应失败: %w", err)
	}

	var silence Silence
	if err := json.Unmarshal(body, &silence); err != nil {
		return nil, fmt.Errorf("解析静默规则失败: %w", err)
	}

	return &silence, nil
}

// CreateSilence 创建静默规则
func (c *Client) CreateSilence(silence *Silence) (string, error) {
	data, err := json.Marshal(silence)
	if err != nil {
		return "", fmt.Errorf("序列化静默规则失败: %w", err)
	}

	resp, err := c.httpClient.Post(
		fmt.Sprintf("%s/api/v2/silences", c.baseURL),
		"application/json",
		bytes.NewBuffer(data),
	)
	if err != nil {
		return "", fmt.Errorf("创建静默规则失败: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("创建静默规则失败: %s", string(body))
	}

	// 读取返回的 silence ID
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("读取响应失败: %w", err)
	}

	var result struct {
		SilenceID string `json:"silenceID"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return "", fmt.Errorf("解析响应失败: %w", err)
	}

	return result.SilenceID, nil
}

// DeleteSilence 删除静默规则
func (c *Client) DeleteSilence(id string) error {
	req, err := http.NewRequest(
		"DELETE",
		fmt.Sprintf("%s/api/v2/silence/%s", c.baseURL, id),
		nil,
	)
	if err != nil {
		return fmt.Errorf("创建请求失败: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("删除静默规则失败: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("删除静默规则失败: %s", string(body))
	}

	return nil
}

