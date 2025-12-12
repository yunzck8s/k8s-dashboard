package handlers

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/k8s-dashboard/backend/internal/observation"
)

// ObservationHandler 集群观测处理器
type ObservationHandler struct {
	service *observation.Service
}

// NewObservationHandler 创建观测处理器
func NewObservationHandler(service *observation.Service) *ObservationHandler {
	return &ObservationHandler{
		service: service,
	}
}

// GetObservationSummary 获取异常状态汇总
func (h *ObservationHandler) GetObservationSummary(c *gin.Context) {
	ctx := context.Background()

	summary, err := h.service.GetSummary(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, summary)
}

// GetPodAnomalies 获取异常 Pod 列表
func (h *ObservationHandler) GetPodAnomalies(c *gin.Context) {
	ctx := context.Background()
	namespace := c.Query("namespace")

	anomalies, err := h.service.GetPodAnomalies(ctx, namespace)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"items": anomalies,
		"total": len(anomalies),
	})
}

// GetNodeAnomalies 获取异常节点列表
func (h *ObservationHandler) GetNodeAnomalies(c *gin.Context) {
	ctx := context.Background()

	anomalies, err := h.service.GetNodeAnomalies(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"items": anomalies,
		"total": len(anomalies),
	})
}

// GetResourceExcess 获取资源超限列表
func (h *ObservationHandler) GetResourceExcess(c *gin.Context) {
	ctx := context.Background()
	namespace := c.Query("namespace")

	excess, err := h.service.GetResourceExcess(ctx, namespace)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"items": excess,
		"total": len(excess),
	})
}

// GetResourceTrend 获取资源使用趋势
func (h *ObservationHandler) GetResourceTrend(c *gin.Context) {
	ctx := context.Background()
	resourceType := observation.ResourceType(c.DefaultQuery("type", "cpu"))
	timeRange := observation.ParseTimeRange(c.DefaultQuery("range", "24h"))

	trend, err := h.service.GetResourceTrend(ctx, resourceType, timeRange)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, trend)
}

// GetAlertTrend 获取告警趋势
func (h *ObservationHandler) GetAlertTrend(c *gin.Context) {
	ctx := context.Background()
	timeRange := observation.ParseTimeRange(c.DefaultQuery("range", "7d"))

	trend, err := h.service.GetAlertTrend(ctx, timeRange)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, trend)
}

// GetRestartTrend 获取 Pod 重启趋势
func (h *ObservationHandler) GetRestartTrend(c *gin.Context) {
	ctx := context.Background()
	timeRange := observation.ParseTimeRange(c.DefaultQuery("range", "24h"))

	trend, err := h.service.GetRestartTrend(ctx, timeRange)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, trend)
}
