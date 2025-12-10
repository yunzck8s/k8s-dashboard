package api

import (
	"net/http"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/k8s-dashboard/backend/internal/alertmanager"
	"github.com/k8s-dashboard/backend/internal/api/handlers"
	"github.com/k8s-dashboard/backend/internal/api/middleware"
	"github.com/k8s-dashboard/backend/internal/audit"
	"github.com/k8s-dashboard/backend/internal/auth"
	"github.com/k8s-dashboard/backend/internal/k8s"
	"github.com/k8s-dashboard/backend/internal/metrics"
)

// NewRouter 创建 HTTP 路由
func NewRouter(k8sClient *k8s.Client, metricsClient *metrics.Client, alertClient *alertmanager.Client, auditClient *audit.Client, authClient *auth.Client) *gin.Engine {
	gin.SetMode(gin.ReleaseMode)

	r := gin.New()

	// 中间件
	r.Use(gin.Recovery())
	r.Use(middleware.Logger())
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization", "X-Cluster"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// 审计日志中间件
	r.Use(middleware.AuditMiddleware(auditClient))

	// 健康检查
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// 创建处理器
	h := handlers.NewHandler(k8sClient, metricsClient, alertClient, auditClient)
	authHandler := handlers.NewAuthHandler(authClient)

	// ========== 公开 API（不需要认证）==========
	publicAPI := r.Group("/api/v1")
	{
		// 登录登出
		publicAPI.POST("/auth/login", authHandler.Login)
		publicAPI.POST("/auth/logout", authHandler.Logout)
	}

	// ========== 需要认证的 API ==========
	v1 := r.Group("/api/v1")

	// 如果 authClient 不为空，启用认证中间件
	if authClient != nil {
		v1.Use(middleware.AuthMiddleware(authClient))
		v1.Use(middleware.NamespaceAccessMiddleware(authClient))
	}

	{
		// 当前用户
		v1.GET("/auth/me", authHandler.GetCurrentUser)
		v1.POST("/auth/password", authHandler.ChangePassword)
		v1.GET("/auth/sessions", authHandler.GetUserSessions)
		v1.DELETE("/auth/sessions/:id", authHandler.RevokeSession)

		// 集群概览
		v1.GET("/overview", h.GetOverview)

		// 告警 (Alertmanager)
		v1.GET("/alerts", h.ListAlerts)
		v1.GET("/alerts/summary", h.GetAlertSummary)

		// Namespaces (使用不同的路径避免冲突)
		v1.GET("/namespaces", h.ListNamespaces)
		v1.POST("/namespaces", h.CreateNamespace)
		v1.GET("/namespace/:ns", h.GetNamespace)
		v1.DELETE("/namespace/:ns", h.DeleteNamespace)

		// Pods
		v1.GET("/pods", h.ListAllPods)
		v1.GET("/namespaces/:ns/pods", h.ListPods)
		v1.GET("/namespaces/:ns/pods/:name", h.GetPod)
		v1.DELETE("/namespaces/:ns/pods/:name", h.DeletePod)
		v1.GET("/namespaces/:ns/pods/:name/yaml", h.GetPodYAML)
		v1.GET("/namespaces/:ns/pods/:name/logs", h.GetPodLogs)
		v1.GET("/namespaces/:ns/pods/:name/events", h.GetPodEvents)

		// Deployments
		v1.GET("/deployments", h.ListAllDeployments)
		v1.GET("/namespaces/:ns/deployments", h.ListDeployments)
		v1.GET("/namespaces/:ns/deployments/:name", h.GetDeployment)
		v1.POST("/namespaces/:ns/deployments", h.CreateDeployment)
		v1.PUT("/namespaces/:ns/deployments/:name", h.UpdateDeployment)
		v1.DELETE("/namespaces/:ns/deployments/:name", h.DeleteDeployment)
		v1.GET("/namespaces/:ns/deployments/:name/yaml", h.GetDeploymentYAML)
		v1.PUT("/namespaces/:ns/deployments/:name/yaml", h.UpdateDeploymentYAML)
		v1.POST("/namespaces/:ns/deployments/:name/scale", h.ScaleDeployment)
		v1.POST("/namespaces/:ns/deployments/:name/restart", h.RestartDeployment)
		v1.POST("/namespaces/:ns/deployments/:name/rollback", h.RollbackDeployment)
		v1.GET("/namespaces/:ns/deployments/:name/pods", h.GetDeploymentPods)

		// StatefulSets
		v1.GET("/statefulsets", h.ListAllStatefulSets)
		v1.GET("/namespaces/:ns/statefulsets", h.ListStatefulSets)
		v1.GET("/namespaces/:ns/statefulsets/:name", h.GetStatefulSet)
		v1.DELETE("/namespaces/:ns/statefulsets/:name", h.DeleteStatefulSet)
		v1.GET("/namespaces/:ns/statefulsets/:name/yaml", h.GetStatefulSetYAML)
		v1.POST("/namespaces/:ns/statefulsets/:name/scale", h.ScaleStatefulSet)

		// DaemonSets
		v1.GET("/daemonsets", h.ListAllDaemonSets)
		v1.GET("/namespaces/:ns/daemonsets", h.ListDaemonSets)
		v1.GET("/namespaces/:ns/daemonsets/:name", h.GetDaemonSet)
		v1.DELETE("/namespaces/:ns/daemonsets/:name", h.DeleteDaemonSet)
		v1.GET("/namespaces/:ns/daemonsets/:name/yaml", h.GetDaemonSetYAML)

		// Jobs
		v1.GET("/jobs", h.ListAllJobs)
		v1.GET("/namespaces/:ns/jobs", h.ListJobs)
		v1.GET("/namespaces/:ns/jobs/:name", h.GetJob)
		v1.DELETE("/namespaces/:ns/jobs/:name", h.DeleteJob)

		// CronJobs
		v1.GET("/cronjobs", h.ListAllCronJobs)
		v1.GET("/namespaces/:ns/cronjobs", h.ListCronJobs)
		v1.GET("/namespaces/:ns/cronjobs/:name", h.GetCronJob)
		v1.DELETE("/namespaces/:ns/cronjobs/:name", h.DeleteCronJob)
		v1.POST("/namespaces/:ns/cronjobs/:name/trigger", h.TriggerCronJob)

		// Services
		v1.GET("/services", h.ListAllServices)
		v1.GET("/namespaces/:ns/services", h.ListServices)
		v1.GET("/namespaces/:ns/services/:name", h.GetService)
		v1.DELETE("/namespaces/:ns/services/:name", h.DeleteService)
		v1.GET("/namespaces/:ns/services/:name/yaml", h.GetServiceYAML)

		// Ingresses
		v1.GET("/ingresses", h.ListAllIngresses)
		v1.GET("/namespaces/:ns/ingresses", h.ListIngresses)
		v1.GET("/namespaces/:ns/ingresses/:name", h.GetIngress)
		v1.DELETE("/namespaces/:ns/ingresses/:name", h.DeleteIngress)

		// ConfigMaps
		v1.GET("/configmaps", h.ListAllConfigMaps)
		v1.GET("/namespaces/:ns/configmaps", h.ListConfigMaps)
		v1.GET("/namespaces/:ns/configmaps/:name", h.GetConfigMap)
		v1.POST("/namespaces/:ns/configmaps", h.CreateConfigMap)
		v1.PUT("/namespaces/:ns/configmaps/:name", h.UpdateConfigMap)
		v1.DELETE("/namespaces/:ns/configmaps/:name", h.DeleteConfigMap)

		// Secrets
		v1.GET("/secrets", h.ListAllSecrets)
		v1.GET("/namespaces/:ns/secrets", h.ListSecrets)
		v1.GET("/namespaces/:ns/secrets/:name", h.GetSecret)
		v1.POST("/namespaces/:ns/secrets", h.CreateSecret)
		v1.PUT("/namespaces/:ns/secrets/:name", h.UpdateSecret)
		v1.DELETE("/namespaces/:ns/secrets/:name", h.DeleteSecret)

		// PersistentVolumes
		v1.GET("/persistentvolumes", h.ListPersistentVolumes)
		v1.GET("/persistentvolumes/:name", h.GetPersistentVolume)
		v1.DELETE("/persistentvolumes/:name", h.DeletePersistentVolume)

		// PersistentVolumeClaims
		v1.GET("/persistentvolumeclaims", h.ListAllPersistentVolumeClaims)
		v1.GET("/namespaces/:ns/persistentvolumeclaims", h.ListPersistentVolumeClaims)
		v1.GET("/namespaces/:ns/persistentvolumeclaims/:name", h.GetPersistentVolumeClaim)
		v1.DELETE("/namespaces/:ns/persistentvolumeclaims/:name", h.DeletePersistentVolumeClaim)

		// StorageClasses
		v1.GET("/storageclasses", h.ListStorageClasses)
		v1.GET("/storageclasses/:name", h.GetStorageClass)

		// Nodes
		v1.GET("/nodes", h.ListNodes)
		v1.GET("/nodes/:name", h.GetNode)
		v1.GET("/nodes/:name/yaml", h.GetNodeYAML)
		v1.GET("/nodes/:name/metrics", h.GetNodeMetrics)
		v1.GET("/nodes/:name/pods", h.GetNodePods)
		v1.POST("/nodes/:name/cordon", h.CordonNode)
		v1.POST("/nodes/:name/uncordon", h.UncordonNode)
		v1.POST("/nodes/:name/drain", h.DrainNode)

		// Events
		v1.GET("/events", h.ListAllEvents)
		v1.GET("/namespaces/:ns/events", h.ListEvents)

		// RBAC
		v1.GET("/namespaces/:ns/roles", h.ListRoles)
		v1.GET("/clusterroles", h.ListClusterRoles)
		v1.GET("/namespaces/:ns/rolebindings", h.ListRoleBindings)
		v1.GET("/clusterrolebindings", h.ListClusterRoleBindings)
		v1.GET("/serviceaccounts", h.ListAllServiceAccounts)
		v1.GET("/namespaces/:ns/serviceaccounts", h.ListServiceAccounts)

		// Metrics (VictoriaMetrics)
		v1.GET("/metrics/cluster", h.GetClusterMetrics)
		v1.GET("/metrics/history/cpu", h.GetCPUHistory)
		v1.GET("/metrics/history/memory", h.GetMemoryHistory)
		v1.GET("/metrics/nodes/:name", h.GetNodeMetricsVM)
		v1.GET("/metrics/pods", h.ListAllPodMetricsVM)
		v1.GET("/metrics/pods/:ns/:name", h.GetPodMetricsVM)

		// 审计日志
		v1.GET("/audit", h.ListAuditLogs)
		v1.GET("/audit/stats", h.GetAuditStats)

		// 审批管理
		v1.GET("/approvals", authHandler.ListApprovals)
		v1.GET("/approvals/pending/count", authHandler.GetPendingCount)
		v1.GET("/approvals/:id", authHandler.GetApproval)
		v1.POST("/approvals/:id/approve", authHandler.ApproveRequest)
		v1.POST("/approvals/:id/reject", authHandler.RejectRequest)
	}

	// ========== 管理员 API（需要 admin 角色）==========
	adminAPI := r.Group("/api/v1/admin")
	if authClient != nil {
		adminAPI.Use(middleware.AuthMiddleware(authClient))
		adminAPI.Use(middleware.RequireRole("admin"))
	}
	{
		// 用户管理
		adminAPI.GET("/users", authHandler.ListUsers)
		adminAPI.POST("/users", authHandler.CreateUser)
		adminAPI.GET("/users/:id", authHandler.GetUser)
		adminAPI.PUT("/users/:id", authHandler.UpdateUser)
		adminAPI.DELETE("/users/:id", authHandler.DeleteUser)
		adminAPI.POST("/users/:id/reset-password", authHandler.ResetPassword)

		// 审批规则
		adminAPI.GET("/approval-rules", authHandler.ListApprovalRules)
		adminAPI.PUT("/approval-rules/:id", authHandler.UpdateApprovalRule)
	}

	// WebSocket 路由
	ws := r.Group("/ws")
	{
		ws.GET("/logs", h.StreamPodLogs)
		ws.GET("/exec", h.ExecPod)
		ws.GET("/watch", h.WatchResources)
	}

	// 静态文件服务（前端）
	r.Static("/assets", "./frontend/dist/assets")
	r.StaticFile("/", "./frontend/dist/index.html")
	r.NoRoute(func(c *gin.Context) {
		c.File("./frontend/dist/index.html")
	})

	return r
}
