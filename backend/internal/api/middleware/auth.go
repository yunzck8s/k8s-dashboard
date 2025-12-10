package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/k8s-dashboard/backend/internal/auth"
)

// 上下文键
const (
	ContextUserKey = "user"
)

// AuthMiddleware 认证中间件
func AuthMiddleware(authClient *auth.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 如果认证客户端未初始化，跳过认证
		if authClient == nil {
			c.Next()
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
			c.Next()
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
			c.Next()
			return
		}

		userValue, exists := c.Get(ContextUserKey)
		if !exists {
			c.Next()
			return
		}

		user, ok := userValue.(*auth.User)
		if !ok {
			c.Next()
			return
		}

		// admin 有所有权限
		if user.Role == "admin" || user.AllNamespaces {
			c.Next()
			return
		}

		// 从路径参数获取命名空间
		namespace := c.Param("ns")
		if namespace == "" {
			namespace = c.Query("namespace")
		}

		// 如果没有指定命名空间，允许访问（列表接口会在业务层过滤）
		if namespace == "" {
			c.Next()
			return
		}

		// 检查命名空间访问权限
		canAccess, err := authClient.CanAccessNamespace(user.ID, namespace)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "检查权限失败"})
			c.Abort()
			return
		}

		if !canAccess {
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
