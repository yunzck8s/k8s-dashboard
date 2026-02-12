package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/k8s-dashboard/backend/internal/alertmanager"
	"github.com/k8s-dashboard/backend/internal/alerts"
	"github.com/k8s-dashboard/backend/internal/api"
	"github.com/k8s-dashboard/backend/internal/audit"
	"github.com/k8s-dashboard/backend/internal/auth"
	"github.com/k8s-dashboard/backend/internal/clusters"
	"github.com/k8s-dashboard/backend/internal/db"
	"github.com/k8s-dashboard/backend/internal/k8s"
	"github.com/k8s-dashboard/backend/internal/metrics"
)

func main() {
	// 初始化 Kubernetes 客户端
	k8sClient, err := k8s.NewClient()
	if err != nil {
		log.Fatalf("Failed to create Kubernetes client: %v", err)
	}

	// 初始化 VictoriaMetrics 客户端
	vmURL := os.Getenv("VICTORIA_METRICS_URL")
	if vmURL == "" {
		vmURL = "http://192.168.1.90:31007"
	}
	metricsClient := metrics.NewClient(vmURL)
	log.Printf("VictoriaMetrics URL: %s", vmURL)

	// 初始化 Alertmanager 客户端
	amURL := os.Getenv("ALERTMANAGER_URL")
	if amURL == "" {
		amURL = "http://192.168.1.90:32607"
	}
	alertClient := alertmanager.NewClient(amURL)
	log.Printf("Alertmanager URL: %s", amURL)

	// JWT 密钥
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "k8s-dashboard-secret-key-change-in-production"
	}

	// 初始化数据库连接（PostgreSQL 优先，失败可按配置回落 SQLite）
	database, dialect, err := db.OpenFromEnv()
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer database.Close()

	log.Printf("Database dialect: %s", dialect)

	// 初始化依赖数据库的模块
	var auditClient *audit.Client
	var authClient *auth.Client
	var alertService *alerts.Service
	var clusterManager *clusters.Manager

	// 初始化审计日志客户端
	auditClient, err = audit.NewClient(database, dialect)
	if err != nil {
		log.Printf("Warning: 审计日志初始化失败: %v", err)
	}

	// 初始化认证客户端
	authClient, err = auth.NewClient(database, dialect, jwtSecret)
	if err != nil {
		log.Fatalf("Failed to initialize auth module: %v", err)
	}

	// 初始化告警服务
	alertRepo, err := alerts.NewRepository(database, dialect)
	if err != nil {
		log.Printf("Warning: 告警数据仓库初始化失败: %v", err)
	} else {
		alertService = alerts.NewService(alertRepo, alertClient)
		log.Printf("告警服务初始化成功")
	}

	// 初始化多集群管理（可选）
	if parseBoolEnv("MULTI_CLUSTER_ENABLED", true) {
		clusterManager, err = clusters.NewManager(database, dialect, jwtSecret, k8sClient)
		if err != nil {
			log.Fatalf("Failed to initialize cluster manager: %v", err)
		}
		log.Printf("多集群管理初始化成功")
	} else {
		log.Printf("多集群管理已禁用 (MULTI_CLUSTER_ENABLED=false)")
	}

	// 创建路由
	router := api.NewRouter(k8sClient, clusterManager, metricsClient, alertClient, alertService, auditClient, authClient)

	// 配置 HTTP 服务器
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// 启动服务器（非阻塞）
	go func() {
		log.Printf("Server starting on port %s", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed: %v", err)
		}
	}()

	// 优雅关闭
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Server exited")
}

func parseBoolEnv(key string, def bool) bool {
	v := strings.TrimSpace(strings.ToLower(os.Getenv(key)))
	if v == "" {
		return def
	}

	switch v {
	case "1", "true", "yes", "on":
		return true
	case "0", "false", "no", "off":
		return false
	default:
		return def
	}
}
