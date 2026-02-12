package handlers

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/k8s-dashboard/backend/internal/api/middleware"
)

type createWSTicketRequest struct {
	Action    string `json:"action"`
	Namespace string `json:"namespace"`
	Name      string `json:"name"`
	Container string `json:"container"`
	Cluster   string `json:"cluster"`
}

func (h *Handler) CreateWSTicket(c *gin.Context) {
	user := middleware.GetCurrentUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未认证"})
		return
	}

	var req createWSTicketRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的请求体"})
		return
	}

	req.Action = strings.TrimSpace(strings.ToLower(req.Action))
	if req.Action == "" {
		req.Action = "exec"
	}

	if req.Action != "exec" && req.Action != "logs" && req.Action != "watch" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported ws action"})
		return
	}

	if req.Namespace == "" || req.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace and name are required"})
		return
	}

	// exec 操作至少需要 operator 权限。
	if req.Action == "exec" && !middleware.RoleAtLeast(user.Role, "operator") {
		c.JSON(http.StatusForbidden, gin.H{"error": "权限不足"})
		return
	}

	allowed := middleware.GetAllowedNamespaces(c)
	if user.Role != "admin" && !user.AllNamespaces {
		ok := false
		for _, ns := range allowed {
			if ns == req.Namespace {
				ok = true
				break
			}
		}
		if !ok {
			c.JSON(http.StatusForbidden, gin.H{"error": "无权访问该命名空间"})
			return
		}
	}

	if req.Cluster == "" {
		req.Cluster = middleware.GetClusterName(c)
		if req.Cluster == "" {
			req.Cluster = "default"
		}
	}

	ticket, err := middleware.IssueWSTicket(user, middleware.WSTicketRequest{
		Action:    req.Action,
		Namespace: req.Namespace,
		Name:      req.Name,
		Container: req.Container,
		Cluster:   req.Cluster,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"ticket":    ticket.Value,
		"expiresAt": ticket.ExpiresAt,
	})
}
