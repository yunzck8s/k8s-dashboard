package middleware

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/k8s-dashboard/backend/internal/auth"
)

// 上下文键
const (
	ContextUserKey              = "user"
	ContextAllowedNamespacesKey = "allowedNamespaces"
)

// AuthMiddleware 认证中间件
func AuthMiddleware(authClient *auth.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		if authClient == nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "认证服务未初始化"})
			c.Abort()
			return
		}

		// 从 Authorization 头获取 Token
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "未提供认证信息"})
			c.Abort()
			return
		}

		// 移除 Bearer 前缀
		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		if tokenString == authHeader {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "认证格式错误，请使用 Bearer Token"})
			c.Abort()
			return
		}

		// 验证 Token
		user, err := authClient.ValidateToken(tokenString)
		if err != nil {
			status := http.StatusUnauthorized
			message := "认证失败"

			switch err {
			case auth.ErrTokenExpired:
				message = "Token 已过期，请重新登录"
			case auth.ErrInvalidToken:
				message = "无效的 Token"
			case auth.ErrUserDisabled:
				message = "用户已被禁用"
				status = http.StatusForbidden
			}

			c.JSON(status, gin.H{"error": message})
			c.Abort()
			return
		}

		// 将用户信息存入上下文
		c.Set(ContextUserKey, user)
		c.Next()
	}
}

// OptionalAuthMiddleware 可选认证中间件（不强制要求登录）
func OptionalAuthMiddleware(authClient *auth.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		if authClient == nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "认证服务未初始化"})
			c.Abort()
			return
		}

		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.Next()
			return
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		if tokenString == authHeader {
			c.Next()
			return
		}

		user, err := authClient.ValidateToken(tokenString)
		if err == nil {
			c.Set(ContextUserKey, user)
		}

		c.Next()
	}
}

// RequireRole 角色检查中间件
func RequireRole(roles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userValue, exists := c.Get(ContextUserKey)
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "未认证"})
			c.Abort()
			return
		}

		user, ok := userValue.(*auth.User)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "用户信息异常"})
			c.Abort()
			return
		}

		// 检查角色
		for _, role := range roles {
			if user.Role == role {
				c.Next()
				return
			}
		}

		c.JSON(http.StatusForbidden, gin.H{"error": "权限不足"})
		c.Abort()
	}
}

// NamespaceAccessMiddleware 命名空间访问检查中间件
func NamespaceAccessMiddleware(authClient *auth.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		if authClient == nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "认证服务未初始化"})
			c.Abort()
			return
		}

		userValue, exists := c.Get(ContextUserKey)
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "未认证"})
			c.Abort()
			return
		}

		user, ok := userValue.(*auth.User)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "用户信息异常"})
			c.Abort()
			return
		}

		// admin 有所有权限
		if user.Role == "admin" || user.AllNamespaces {
			c.Set(ContextAllowedNamespacesKey, []string{})
			c.Next()
			return
		}

		namespaces, err := authClient.GetUserNamespaces(user.ID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "读取命名空间权限失败"})
			c.Abort()
			return
		}

		allowed := make([]string, 0, len(namespaces))
		for _, ns := range namespaces {
			if ns.Namespace != "" {
				allowed = append(allowed, ns.Namespace)
			}
		}
		c.Set(ContextAllowedNamespacesKey, allowed)

		// 从路径参数获取命名空间
		namespace := c.Param("ns")
		if namespace == "" {
			namespace = c.Query("namespace")
		}
		if namespace == "all" {
			namespace = ""
		}

		if namespace == "" {
			c.Next()
			return
		}

		if !namespaceInList(namespace, allowed) {
			c.JSON(http.StatusForbidden, gin.H{"error": "无权访问该命名空间"})
			c.Abort()
			return
		}

		c.Next()
	}
}

// GetCurrentUser 从上下文获取当前用户
func GetCurrentUser(c *gin.Context) *auth.User {
	userValue, exists := c.Get(ContextUserKey)
	if !exists {
		return nil
	}

	user, ok := userValue.(*auth.User)
	if !ok {
		return nil
	}

	return user
}

// GetAllowedNamespaces 从上下文获取可访问命名空间列表。
// 返回空切片表示不受限（通常为 admin）；nil 表示未设置。
func GetAllowedNamespaces(c *gin.Context) []string {
	value, ok := c.Get(ContextAllowedNamespacesKey)
	if !ok {
		return nil
	}

	items, ok := value.([]string)
	if !ok {
		return nil
	}

	return items
}

func namespaceInList(namespace string, allowed []string) bool {
	for _, ns := range allowed {
		if ns == namespace {
			return true
		}
	}
	return false
}

func RequireRoleAtLeast(minRole string) gin.HandlerFunc {
	return func(c *gin.Context) {
		user := GetCurrentUser(c)
		if user == nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "未认证"})
			c.Abort()
			return
		}

		if !RoleAtLeast(user.Role, minRole) {
			c.JSON(http.StatusForbidden, gin.H{"error": fmt.Sprintf("需要 %s 权限", minRole)})
			c.Abort()
			return
		}

		c.Next()
	}
}

func RoleAtLeast(role, required string) bool {
	return roleRank(role) >= roleRank(required)
}

func roleRank(role string) int {
	switch role {
	case "admin":
		return 3
	case "operator":
		return 2
	case "viewer":
		return 1
	default:
		return 0
	}
}
