package middleware

import (
	"bytes"
	"encoding/json"
	"io"
	"regexp"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/k8s-dashboard/backend/internal/audit"
	"sigs.k8s.io/yaml"
)

// 需要记录审计日志的操作（写操作）
var auditableMethods = map[string]bool{
	"POST":   true,
	"PUT":    true,
	"PATCH":  true,
	"DELETE": true,
}

var sensitiveKeyPattern = regexp.MustCompile(`(?i)(password|secret|token|key|credential|authorization|stringdata|data)`)

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
	{regexp.MustCompile(`/api/v1/namespace/([^/]+)`), "namespaces"},
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

	parts := strings.Split(strings.TrimPrefix(path, "/api/v1/"), "/")
	if len(parts) > 0 {
		resource = parts[0]
	}
	return
}

// AuditMiddleware 审计日志中间件
func AuditMiddleware(auditClient *audit.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		if auditClient == nil {
			c.Next()
			return
		}

		if !shouldAudit(c.Request.Method, c.Request.URL.Path) {
			c.Next()
			return
		}

		startTime := time.Now()

		var requestBody string
		if c.Request.Body != nil && c.Request.Method != "GET" {
			bodyBytes, _ := io.ReadAll(c.Request.Body)
			c.Request.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))

			if shouldStoreRequestBody(c.Request.URL.Path) {
				requestBody = sanitizeRequestBody(bodyBytes, c.ContentType())
			} else {
				requestBody = "[FILTERED]"
			}
		}

		c.Next()

		duration := time.Since(startTime).Milliseconds()
		resource, namespace, resourceName := parseResourceInfo(c.Request.URL.Path)
		user := resolveAuditUser(c)
		cluster := resolveCluster(c)
		message := generateActionMessage(c.Request.Method, c.Request.URL.Path, resource, resourceName, namespace)

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

		go func(l *audit.AuditLog) {
			if err := auditClient.Log(l); err != nil {
				println("审计日志写入失败:", err.Error())
			}
		}(log)
	}
}

func shouldAudit(method, path string) bool {
	if !strings.HasPrefix(path, "/api/") {
		return false
	}
	if strings.HasPrefix(path, "/api/v1/audit") {
		return false
	}
	if auditableMethods[method] {
		return true
	}
	return method == "GET" && strings.Contains(path, "/secrets/")
}

func shouldStoreRequestBody(path string) bool {
	// Secret/YAML 相关请求默认不记录 payload，仅保留摘要。
	return !strings.Contains(path, "/secrets") && !strings.Contains(path, "/yaml")
}

func resolveAuditUser(c *gin.Context) string {
	if user := GetCurrentUser(c); user != nil {
		if user.Username != "" {
			return user.Username
		}
		return "authenticated"
	}
	return "anonymous"
}

func resolveCluster(c *gin.Context) string {
	if cluster := GetClusterName(c); cluster != "" {
		return cluster
	}
	cluster := c.GetHeader("X-Cluster")
	if cluster == "" {
		cluster = "default"
	}
	return cluster
}

func sanitizeRequestBody(body []byte, contentType string) string {
	if len(body) == 0 {
		return ""
	}

	redacted := redactStructuredPayload(body, contentType)
	if redacted == "" {
		redacted = fallbackMask(string(body))
	}

	if len(redacted) > 2000 {
		return redacted[:2000] + "...[truncated]"
	}
	return redacted
}

func redactStructuredPayload(body []byte, contentType string) string {
	jsonBody := body

	trimmed := strings.TrimSpace(string(body))
	if strings.Contains(contentType, "yaml") || looksLikeYAML(trimmed) {
		converted, err := yaml.YAMLToJSON(body)
		if err != nil {
			return ""
		}
		jsonBody = converted
	}

	var payload interface{}
	if err := json.Unmarshal(jsonBody, &payload); err != nil {
		return ""
	}

	redacted := redactAny(payload)
	data, err := json.Marshal(redacted)
	if err != nil {
		return ""
	}
	return string(data)
}

func looksLikeYAML(body string) bool {
	return strings.Contains(body, "\n") && strings.Contains(body, ":")
}

func redactAny(value interface{}) interface{} {
	switch v := value.(type) {
	case map[string]interface{}:
		result := make(map[string]interface{}, len(v))
		for key, child := range v {
			if sensitiveKeyPattern.MatchString(key) {
				result[key] = "[FILTERED]"
				continue
			}
			result[key] = redactAny(child)
		}
		return result
	case []interface{}:
		items := make([]interface{}, 0, len(v))
		for _, child := range v {
			items = append(items, redactAny(child))
		}
		return items
	default:
		return v
	}
}

func fallbackMask(body string) string {
	pattern := regexp.MustCompile(`(?i)("?(password|secret|token|key|credential|authorization|stringData|data)"?\s*:\s*)"[^"]*"`)
	return pattern.ReplaceAllString(body, `$1"[FILTERED]"`)
}

// 生成操作描述
func generateActionMessage(method, path, resource, name, namespace string) string {
	specialAction := detectSpecialAction(path)
	if specialAction != "" {
		if name != "" {
			if namespace != "" {
				return specialAction + " " + resource + " " + namespace + "/" + name
			}
			return specialAction + " " + resource + " " + name
		}
		return specialAction + " " + resource
	}

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

// 从路径中识别特殊操作
func detectSpecialAction(path string) string {
	if strings.Contains(path, "/restart") {
		return "重启"
	}
	if strings.Contains(path, "/scale") {
		return "扩缩容"
	}
	if strings.Contains(path, "/rollback") {
		return "回滚"
	}
	if strings.Contains(path, "/logs") {
		return "查看日志"
	}
	if strings.Contains(path, "/exec") {
		return "执行命令"
	}
	if strings.Contains(path, "/yaml") {
		return "编辑YAML"
	}
	return ""
}
