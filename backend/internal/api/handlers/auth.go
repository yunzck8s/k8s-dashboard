package handlers

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/k8s-dashboard/backend/internal/api/middleware"
	"github.com/k8s-dashboard/backend/internal/auth"
)

// AuthHandler 认证处理器
type AuthHandler struct {
	auth *auth.Client
}

// NewAuthHandler 创建认证处理器
func NewAuthHandler(authClient *auth.Client) *AuthHandler {
	return &AuthHandler{auth: authClient}
}

// LoginRequest 登录请求
type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

// LoginResponse 登录响应
type LoginResponse struct {
	Token string     `json:"token"`
	User  *auth.User `json:"user"`
}

// Login 用户登录
func (h *AuthHandler) Login(c *gin.Context) {
	if h.auth == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "认证服务未启用"})
		return
	}

	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请提供用户名和密码"})
		return
	}

	ip := c.ClientIP()
	userAgent := c.Request.UserAgent()

	user, token, err := h.auth.Login(req.Username, req.Password, ip, userAgent)
	if err != nil {
		status := http.StatusUnauthorized
		message := "登录失败"

		switch err {
		case auth.ErrUserNotFound:
			message = "用户不存在"
		case auth.ErrInvalidPassword:
			message = "密码错误"
		case auth.ErrUserDisabled:
			message = "用户已被禁用"
			status = http.StatusForbidden
		default:
			message = err.Error()
		}

		c.JSON(status, gin.H{"error": message})
		return
	}

	// 获取用户的命名空间列表
	namespaces, _ := h.auth.GetUserNamespaces(user.ID)

	c.JSON(http.StatusOK, gin.H{
		"token":      token,
		"user":       user,
		"namespaces": namespaces,
	})
}

// Logout 用户登出
func (h *AuthHandler) Logout(c *gin.Context) {
	if h.auth == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "认证服务未启用"})
		return
	}

	authHeader := c.GetHeader("Authorization")
	if authHeader != "" && len(authHeader) > 7 {
		token := authHeader[7:] // 移除 "Bearer "
		h.auth.Logout(token)
	}

	c.JSON(http.StatusOK, gin.H{"message": "已登出"})
}

// GetCurrentUser 获取当前用户信息
func (h *AuthHandler) GetCurrentUser(c *gin.Context) {
	if h.auth == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "认证服务未启用"})
		return
	}

	user := middleware.GetCurrentUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未认证"})
		return
	}

	// 获取用户的命名空间列表
	namespaces, _ := h.auth.GetUserNamespaces(user.ID)

	c.JSON(http.StatusOK, gin.H{
		"user":       user,
		"namespaces": namespaces,
	})
}

// ChangePasswordRequest 修改密码请求
type ChangePasswordRequest struct {
	OldPassword string `json:"oldPassword" binding:"required"`
	NewPassword string `json:"newPassword" binding:"required"`
}

// ChangePassword 修改密码
func (h *AuthHandler) ChangePassword(c *gin.Context) {
	if h.auth == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "认证服务未启用"})
		return
	}

	user := middleware.GetCurrentUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未认证"})
		return
	}

	var req ChangePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请提供旧密码和新密码"})
		return
	}

	if len(req.NewPassword) < 6 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "新密码长度至少6位"})
		return
	}

	err := h.auth.UpdatePassword(user.ID, req.OldPassword, req.NewPassword)
	if err != nil {
		if err == auth.ErrInvalidPassword {
			c.JSON(http.StatusBadRequest, gin.H{"error": "旧密码错误"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "密码修改成功"})
}

// GetUserSessions 获取用户会话列表
func (h *AuthHandler) GetUserSessions(c *gin.Context) {
	user := middleware.GetCurrentUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未认证"})
		return
	}

	sessions, err := h.auth.GetUserSessions(user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"items": sessions})
}

// RevokeSession 撤销会话
func (h *AuthHandler) RevokeSession(c *gin.Context) {
	sessionID := c.Param("id")
	if sessionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "会话ID不能为空"})
		return
	}

	if err := h.auth.RevokeSession(sessionID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "会话已撤销"})
}

// ========== 用户管理 ==========

// ListUsers 获取用户列表
func (h *AuthHandler) ListUsers(c *gin.Context) {
	if h.auth == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "认证服务未启用"})
		return
	}

	var params auth.ListUsersParams
	if err := c.ShouldBindQuery(&params); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := h.auth.ListUsers(params)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

// GetUser 获取用户详情
func (h *AuthHandler) GetUser(c *gin.Context) {
	if h.auth == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "认证服务未启用"})
		return
	}

	var userID int64
	if _, err := parsePathInt64(c, "id", &userID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的用户ID"})
		return
	}

	user, err := h.auth.GetUserByID(userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "用户不存在"})
		return
	}

	namespaces, _ := h.auth.GetUserNamespaces(userID)

	c.JSON(http.StatusOK, gin.H{
		"user":       user,
		"namespaces": namespaces,
	})
}

// CreateUser 创建用户
func (h *AuthHandler) CreateUser(c *gin.Context) {
	if h.auth == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "认证服务未启用"})
		return
	}

	var req auth.CreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if len(req.Password) < 6 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "密码长度至少6位"})
		return
	}

	user, err := h.auth.CreateUser(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, user)
}

// UpdateUser 更新用户
func (h *AuthHandler) UpdateUser(c *gin.Context) {
	if h.auth == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "认证服务未启用"})
		return
	}

	var userID int64
	if _, err := parsePathInt64(c, "id", &userID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的用户ID"})
		return
	}

	var req auth.UpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, err := h.auth.UpdateUser(userID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, user)
}

// ResetPasswordRequest 重置密码请求
type ResetPasswordRequest struct {
	NewPassword string `json:"newPassword" binding:"required"`
}

// ResetPassword 重置用户密码
func (h *AuthHandler) ResetPassword(c *gin.Context) {
	if h.auth == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "认证服务未启用"})
		return
	}

	var userID int64
	if _, err := parsePathInt64(c, "id", &userID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的用户ID"})
		return
	}

	var req ResetPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请提供新密码"})
		return
	}

	if len(req.NewPassword) < 6 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "密码长度至少6位"})
		return
	}

	if err := h.auth.ResetPassword(userID, req.NewPassword); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "密码已重置"})
}

// DeleteUser 删除用户
func (h *AuthHandler) DeleteUser(c *gin.Context) {
	if h.auth == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "认证服务未启用"})
		return
	}

	var userID int64
	if _, err := parsePathInt64(c, "id", &userID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的用户ID"})
		return
	}

	if err := h.auth.DeleteUser(userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "用户已删除"})
}

// ========== 审批管理 ==========

// ListApprovals 获取审批列表
func (h *AuthHandler) ListApprovals(c *gin.Context) {
	if h.auth == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "认证服务未启用"})
		return
	}

	var params auth.ListApprovalParams
	if err := c.ShouldBindQuery(&params); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := h.auth.ListApprovals(params)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

// GetApproval 获取审批详情
func (h *AuthHandler) GetApproval(c *gin.Context) {
	if h.auth == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "认证服务未启用"})
		return
	}

	var approvalID int64
	if _, err := parsePathInt64(c, "id", &approvalID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的审批ID"})
		return
	}

	approval, err := h.auth.GetApprovalByID(approvalID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, approval)
}

// ApprovalActionRequest 审批操作请求
type ApprovalActionRequest struct {
	Comment string `json:"comment"`
}

// ApproveRequest 批准审批
func (h *AuthHandler) ApproveRequest(c *gin.Context) {
	if h.auth == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "认证服务未启用"})
		return
	}

	user := middleware.GetCurrentUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未认证"})
		return
	}

	var approvalID int64
	if _, err := parsePathInt64(c, "id", &approvalID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的审批ID"})
		return
	}

	var req ApprovalActionRequest
	c.ShouldBindJSON(&req)

	if err := h.auth.ApproveRequest(approvalID, user.ID, req.Comment); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "已批准"})
}

// RejectRequest 拒绝审批
func (h *AuthHandler) RejectRequest(c *gin.Context) {
	if h.auth == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "认证服务未启用"})
		return
	}

	user := middleware.GetCurrentUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未认证"})
		return
	}

	var approvalID int64
	if _, err := parsePathInt64(c, "id", &approvalID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的审批ID"})
		return
	}

	var req ApprovalActionRequest
	c.ShouldBindJSON(&req)

	if err := h.auth.RejectRequest(approvalID, user.ID, req.Comment); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "已拒绝"})
}

// GetPendingCount 获取待审批数量
func (h *AuthHandler) GetPendingCount(c *gin.Context) {
	if h.auth == nil {
		c.JSON(http.StatusOK, gin.H{"count": 0})
		return
	}

	count, err := h.auth.GetPendingApprovalCount()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"count": count})
}

// ========== 审批规则 ==========

// ListApprovalRules 获取审批规则列表
func (h *AuthHandler) ListApprovalRules(c *gin.Context) {
	if h.auth == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "认证服务未启用"})
		return
	}

	rules, err := h.auth.ListApprovalRules()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"items": rules})
}

// UpdateApprovalRuleRequest 更新审批规则请求
type UpdateApprovalRuleRequest struct {
	MinRole string `json:"minRole"`
	Enabled bool   `json:"enabled"`
}

// UpdateApprovalRule 更新审批规则
func (h *AuthHandler) UpdateApprovalRule(c *gin.Context) {
	if h.auth == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "认证服务未启用"})
		return
	}

	var ruleID int64
	if _, err := parsePathInt64(c, "id", &ruleID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的规则ID"})
		return
	}

	var req UpdateApprovalRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.auth.UpdateApprovalRule(ruleID, req.MinRole, req.Enabled); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "规则已更新"})
}

// 辅助函数：解析路径参数为 int64
func parsePathInt64(c *gin.Context, key string, value *int64) (bool, error) {
	strVal := c.Param(key)
	if strVal == "" {
		return false, nil
	}

	var v int64
	_, err := fmt.Sscanf(strVal, "%d", &v)
	if err != nil {
		return false, err
	}

	*value = v
	return true, nil
}
