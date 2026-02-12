package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// AuthorizeByRoute 按 method+path 进行最小角色校验：
// read: viewer/operator/admin
// operate: operator/admin
// admin: admin
func AuthorizeByRoute() gin.HandlerFunc {
	return func(c *gin.Context) {
		user := GetCurrentUser(c)
		if user == nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "未认证"})
			c.Abort()
			return
		}

		required := requiredRole(c.Request.Method, c.Request.URL.Path)
		if RoleAtLeast(user.Role, required) {
			c.Next()
			return
		}

		c.JSON(http.StatusForbidden, gin.H{
			"error":        "权限不足",
			"requiredRole": required,
		})
		c.Abort()
	}
}

func requiredRole(method, path string) string {
	// 管理员 API
	if strings.HasPrefix(path, "/api/v1/admin/") {
		return "admin"
	}

	// 集群管理（创建/删除/测试）仅 admin
	if path == "/api/v1/clusters" && method == http.MethodPost {
		return "admin"
	}
	if strings.HasSuffix(path, "/switch") && strings.HasPrefix(path, "/api/v1/clusters/") && method == http.MethodPost {
		return "viewer"
	}
	if path == "/api/v1/clusters/test" && method == http.MethodPost {
		return "admin"
	}
	if strings.HasPrefix(path, "/api/v1/clusters/") && method == http.MethodDelete {
		return "admin"
	}

	// 高风险删除仅 admin
	if method == http.MethodDelete {
		if strings.HasPrefix(path, "/api/v1/namespaces/") {
			return "admin"
		}
		if strings.HasPrefix(path, "/api/v1/namespace/") {
			return "admin"
		}
		if strings.HasPrefix(path, "/api/v1/persistentvolumes/") {
			return "admin"
		}
		if strings.HasPrefix(path, "/api/v1/clusters/") {
			return "admin"
		}
	}

	// 用户自服务接口，viewer 即可
	if strings.HasPrefix(path, "/api/v1/auth/password") ||
		strings.HasPrefix(path, "/api/v1/auth/logout") ||
		strings.HasPrefix(path, "/api/v1/auth/sessions") {
		return "viewer"
	}

	// 审批流控制接口仅 admin。
	if strings.HasPrefix(path, "/api/v1/approvals") {
		return "admin"
	}

	// 需要操作权限的接口
	if method == http.MethodPost || method == http.MethodPut || method == http.MethodPatch || method == http.MethodDelete {
		return "operator"
	}

	return "viewer"
}
