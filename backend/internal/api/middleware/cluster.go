package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/k8s-dashboard/backend/internal/clusters"
	"github.com/k8s-dashboard/backend/internal/k8s"
)

const (
	ContextClusterNameKey   = "cluster"
	ContextClusterClientKey = "clusterClient"
)

// ClusterSelector 根据请求头 X-Cluster 解析目标集群，并注入请求上下文。
func ClusterSelector(manager *clusters.Manager) gin.HandlerFunc {
	return func(c *gin.Context) {
		if manager == nil || shouldSkipClusterResolution(c.Request.URL.Path) {
			c.Next()
			return
		}

		requested := strings.TrimSpace(c.GetHeader("X-Cluster"))
		if requested == "" {
			requested = strings.TrimSpace(c.Query("cluster"))
		}

		client, clusterName, err := manager.GetClientForRequest(requested)
		if err != nil {
			if clusterName == "" {
				clusterName = requested
			}
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"code":    "CLUSTER_UNAVAILABLE",
				"cluster": clusterName,
				"error":   err.Error(),
			})
			c.Abort()
			return
		}

		c.Set(ContextClusterNameKey, clusterName)
		c.Set(ContextClusterClientKey, client)
		c.Next()
	}
}

func shouldSkipClusterResolution(path string) bool {
	skips := []string{
		"/api/v1/auth",
		"/api/v1/clusters",
		"/api/v1/audit",
		"/api/v1/alerts",
		"/api/v1/silences",
		"/api/v1/approvals",
	}
	for _, prefix := range skips {
		if strings.HasPrefix(path, prefix) {
			return true
		}
	}
	return false
}

// GetClusterName 从上下文读取当前请求集群名。
func GetClusterName(c *gin.Context) string {
	value, ok := c.Get(ContextClusterNameKey)
	if !ok {
		return ""
	}
	name, _ := value.(string)
	return name
}

// GetClusterClient 从上下文读取当前请求集群客户端。
func GetClusterClient(c *gin.Context) *k8s.Client {
	value, ok := c.Get(ContextClusterClientKey)
	if !ok {
		return nil
	}
	client, _ := value.(*k8s.Client)
	return client
}
