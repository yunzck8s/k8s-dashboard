package middleware

import (
	"bytes"
	"io"
	"regexp"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/k8s-dashboard/backend/internal/audit"
)

// 需要记录审计日志的操作（写操作）
var auditableMethods = map[string]bool{
	"POST":   true,
	"PUT":    true,
	"PATCH":  true,
	"DELETE": true,
}

// 敏感字段过滤
var sensitiveFields = regexp.MustCompile(`(?i)"(password|secret|token|key|credential|authorization)":\s*"[^"]*"`)

// 资源路径模式
var resourcePatterns = []struct {
	pattern  *regexp.Regexp
	resource string
}{
	{regexp.MustCompile(`/api/v1/namespaces/([^/]+)/pods/([^/]+)`), "pods"},
	{regexp.MustCompile(`/api/v1/namespaces/([^/]+)/deployments/([^/]+)`), "deployments"},
	{regexp.MustCompile(`/api/v1/namespaces/([^/]+)/statefulsets/([^/]+)`), "statefulsets"},
	{regexp.MustCompile(`/api/v1/namespaces/([^/]+)/daemonsets/([^/]+)`), "daemonsets"},
	{regexp.MustCompile(`/api/v1/namespaces/([^/]+)/services/([^/]+)`), "services"},
	{regexp.MustCompile(`/api/v1/namespaces/([^/]+)/configmaps/([^/]+)`), "configmaps"},
	{regexp.MustCompile(`/api/v1/namespaces/([^/]+)/secrets/([^/]+)`), "secrets"},
	{regexp.MustCompile(`/api/v1/namespaces/([^/]+)/ingresses/([^/]+)`), "ingresses"},
	{regexp.MustCompile(`/api/v1/namespaces/([^/]+)/jobs/([^/]+)`), "jobs"},
	{regexp.MustCompile(`/api/v1/namespaces/([^/]+)/cronjobs/([^/]+)`), "cronjobs"},
	{regexp.MustCompile(`/api/v1/namespaces/([^/]+)/persistentvolumeclaims/([^/]+)`), "persistentvolumeclaims"},
	{regexp.MustCompile(`/api/v1/nodes/([^/]+)`), "nodes"},
	{regexp.MustCompile(`/api/v1/persistentvolumes/([^/]+)`), "persistentvolumes"},
	{regexp.MustCompile(`/api/v1/storageclasses/([^/]+)`), "storageclasses"},
	{regexp.MustCompile(`/api/v1/namespaces/([^/]+)`), "namespaces"},
}

// 解析资源信息
func parseResourceInfo(path string) (resource, namespace, name string) {
	for _, p := range resourcePatterns {
		matches := p.pattern.FindStringSubmatch(path)
		if matches != nil {
			resource = p.resource
			if len(matches) == 3 {
				namespace = matches[1]
				name = matches[2]
			} else if len(matches) == 2 {
				name = matches[1]
			}
			return
		}
	}

	// 如果没有匹配到具体模式，尝试从路径提取
	parts := strings.Split(strings.TrimPrefix(path, "/api/v1/"), "/")
	if len(parts) > 0 {
		resource = parts[0]
	}
	return
}

// 过滤敏感信息
func filterSensitiveData(body string) string {
	return sensitiveFields.ReplaceAllString(body, `"$1":"[FILTERED]"`)
}

// AuditMiddleware 审计日志中间件
func AuditMiddleware(auditClient *audit.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 如果审计客户端未初始化，跳过
		if auditClient == nil {
			c.Next()
			return
		}

		// 只记录写操作和重要的读操作
		if !auditableMethods[c.Request.Method] {
			// 对于 GET 请求，只记录特定的敏感资源
			if c.Request.Method == "GET" && !strings.Contains(c.Request.URL.Path, "/secrets/") {
				c.Next()
				return
			}
		}

		// 跳过非 API 路径
		if !strings.HasPrefix(c.Request.URL.Path, "/api/") {
			c.Next()
			return
		}

		// 跳过审计日志自身的查询，避免循环
		if strings.HasPrefix(c.Request.URL.Path, "/api/v1/audit") {
			c.Next()
			return
		}

		startTime := time.Now()

		// 读取请求体
		var requestBody string
		if c.Request.Body != nil && c.Request.Method != "GET" {
			bodyBytes, _ := io.ReadAll(c.Request.Body)
			c.Request.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
			requestBody = filterSensitiveData(string(bodyBytes))
			// 限制请求体长度
			if len(requestBody) > 2000 {
				requestBody = requestBody[:2000] + "...[truncated]"
			}
		}

		// 处理请求
		c.Next()

		// 计算耗时
		duration := time.Since(startTime).Milliseconds()

		// 解析资源信息
		resource, namespace, resourceName := parseResourceInfo(c.Request.URL.Path)

		// 获取用户信息（从请求头或上下文）
		user := c.GetHeader("X-User")
		if user == "" {
			user = c.GetHeader("Authorization")
			if user != "" {
				user = "authenticated"
			} else {
				user = "anonymous"
			}
		}

		// 获取集群信息
		cluster := c.GetHeader("X-Cluster")
		if cluster == "" {
			cluster = "default"
		}

		// 生成操作描述
		message := generateActionMessage(c.Request.Method, resource, resourceName, namespace)

		// 创建审计日志
		log := &audit.AuditLog{
			Timestamp:    startTime,
			User:         user,
			Action:       c.Request.Method,
			Resource:     resource,
			ResourceName: resourceName,
			Namespace:    namespace,
			Cluster:      cluster,
			StatusCode:   c.Writer.Status(),
			ClientIP:     c.ClientIP(),
			UserAgent:    c.Request.UserAgent(),
			RequestBody:  requestBody,
			Duration:     duration,
			Message:      message,
		}

		// 异步写入数据库
		go func(l *audit.AuditLog) {
			if err := auditClient.Log(l); err != nil {
				// 记录错误但不影响请求
				println("审计日志写入失败:", err.Error())
			}
		}(log)
	}
}

// 生成操作描述
func generateActionMessage(method, resource, name, namespace string) string {
	var action string
	switch method {
	case "POST":
		action = "创建"
	case "PUT", "PATCH":
		action = "更新"
	case "DELETE":
		action = "删除"
	case "GET":
		action = "查看"
	default:
		action = method
	}

	if name != "" {
		if namespace != "" {
			return action + " " + resource + " " + namespace + "/" + name
		}
		return action + " " + resource + " " + name
	}
	return action + " " + resource
}
