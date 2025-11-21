package api

import (
	"context"
	"fmt"
	"net/http"

	"k8s-dashboard-backend/internal/k8s"

	"github.com/gin-gonic/gin"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// GetPodMetrics returns metrics for a specific pod
func GetPodMetrics(c *gin.Context) {
	namespace := c.Param("namespace")
	name := c.Param("name")

	metrics, err := k8s.MetricsClient.MetricsV1beta1().PodMetricses(namespace).Get(context.TODO(), name, metav1.GetOptions{})
	if err != nil {
		fmt.Printf("Error fetching metrics for %s/%s: %v\n", namespace, name, err)
		c.JSON(http.StatusNotFound, gin.H{"error": "Metrics not available"})
		return
	}

	c.JSON(http.StatusOK, metrics)
}

// GetNodeMetrics returns metrics for a specific node
func GetNodeMetrics(c *gin.Context) {
	name := c.Param("name")

	metrics, err := k8s.MetricsClient.MetricsV1beta1().NodeMetricses().Get(context.TODO(), name, metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Metrics not available"})
		return
	}

	c.JSON(http.StatusOK, metrics)
}

// GetAllNodeMetrics returns metrics for all nodes
func GetAllNodeMetrics(c *gin.Context) {
	metrics, err := k8s.MetricsClient.MetricsV1beta1().NodeMetricses().List(context.TODO(), metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, metrics)
}
