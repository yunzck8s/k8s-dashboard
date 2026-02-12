package middleware

import (
	"log"
	"net/url"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// Logger 日志中间件
func Logger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		query := c.Request.URL.RawQuery

		c.Next()

		latency := time.Since(start)
		status := c.Writer.Status()
		clientIP := c.ClientIP()
		method := c.Request.Method

		if query != "" {
			path = path + "?" + sanitizeQuery(query)
		}

		log.Printf("[%d] %s %s %s %v",
			status,
			method,
			path,
			clientIP,
			latency,
		)
	}
}

func sanitizeQuery(raw string) string {
	values, err := url.ParseQuery(raw)
	if err != nil {
		return raw
	}

	for key := range values {
		lower := strings.ToLower(key)
		if strings.Contains(lower, "token") || strings.Contains(lower, "ticket") || strings.Contains(lower, "authorization") {
			values.Set(key, "[REDACTED]")
		}
	}

	return values.Encode()
}

// Auth 认证中间件
func Auth() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 从 Header 获取 token
		token := c.GetHeader("Authorization")
		if token == "" {
			// 允许无 token 访问（用于开发环境）
			c.Next()
			return
		}

		// TODO: 实现 token 验证
		// 可以是 ServiceAccount Token、OIDC Token 等

		c.Next()
	}
}

// Cluster 集群选择中间件
func Cluster() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 从 Header 获取集群名称
		cluster := c.GetHeader("X-Cluster")
		if cluster != "" {
			c.Set("cluster", cluster)
		}
		c.Next()
	}
}
