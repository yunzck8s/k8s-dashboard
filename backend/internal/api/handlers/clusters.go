package handlers

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

type clusterTestRequest struct {
	Kubeconfig string `json:"kubeconfig" binding:"required"`
}

type clusterAddRequest struct {
	Name       string `json:"name" binding:"required"`
	Kubeconfig string `json:"kubeconfig" binding:"required"`
}

func (h *Handler) ListClusters(c *gin.Context) {
	if h.clusters == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "multi-cluster is not enabled"})
		return
	}

	items, err := h.clusters.List(context.Background())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, items)
}

func (h *Handler) GetCluster(c *gin.Context) {
	if h.clusters == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "multi-cluster is not enabled"})
		return
	}

	name := strings.TrimSpace(c.Param("name"))
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cluster name is required"})
		return
	}

	info, err := h.clusters.Get(context.Background(), name)
	if err != nil {
		status := http.StatusInternalServerError
		if strings.Contains(err.Error(), "not found") {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, info)
}

func (h *Handler) TestCluster(c *gin.Context) {
	if h.clusters == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "multi-cluster is not enabled"})
		return
	}

	var req clusterTestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	info, err := h.clusters.TestKubeconfig(context.Background(), req.Kubeconfig)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "cluster is reachable",
		"cluster": info,
	})
}

func (h *Handler) AddCluster(c *gin.Context) {
	if h.clusters == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "multi-cluster is not enabled"})
		return
	}

	var req clusterAddRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	info, err := h.clusters.Add(context.Background(), req.Name, req.Kubeconfig)
	if err != nil {
		status := http.StatusBadRequest
		if strings.Contains(err.Error(), "already exists") {
			status = http.StatusConflict
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, info)
}

func (h *Handler) DeleteCluster(c *gin.Context) {
	if h.clusters == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "multi-cluster is not enabled"})
		return
	}

	name := strings.TrimSpace(c.Param("name"))
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cluster name is required"})
		return
	}

	if err := h.clusters.Delete(name); err != nil {
		status := http.StatusBadRequest
		if errors.Is(err, context.Canceled) {
			status = http.StatusRequestTimeout
		}
		if strings.Contains(err.Error(), "not found") {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

func (h *Handler) SwitchCluster(c *gin.Context) {
	if h.clusters == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "multi-cluster is not enabled"})
		return
	}

	name := strings.TrimSpace(c.Param("name"))
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cluster name is required"})
		return
	}

	info, err := h.clusters.Switch(context.Background(), name)
	if err != nil {
		status := http.StatusBadRequest
		if strings.Contains(err.Error(), "not found") {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, info)
}
