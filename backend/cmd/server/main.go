package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	_ "github.com/lib/pq"
	"github.com/k8s-dashboard/backend/internal/alertmanager"
	"github.com/k8s-dashboard/backend/internal/api"
	"github.com/k8s-dashboard/backend/internal/audit"
	"github.com/k8s-dashboard/backend/internal/auth"
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

	// PostgreSQL 配置
	pgHost := os.Getenv("POSTGRES_HOST")
	if pgHost == "" {
		pgHost = "192.168.1.90"
	}
	pgPortStr := os.Getenv("POSTGRES_PORT")
	if pgPortStr == "" {
		pgPortStr = "30433"
	}
	pgPort, _ := strconv.Atoi(pgPortStr)
	pgUser := os.Getenv("POSTGRES_USER")
	if pgUser == "" {
		pgUser = "postgres"
	}
	pgPassword := os.Getenv("POSTGRES_PASSWORD")
	if pgPassword == "" {
		pgPassword = "UIDZRXbW5G"
	}
	pgDB := os.Getenv("POSTGRES_DB")
	if pgDB == "" {
		pgDB = "k8s_dashboard"
	}

	// JWT 密钥
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "k8s-dashboard-secret-key-change-in-production"
	}

	// 初始化数据库连接
	var db *sql.DB
	var auditClient *audit.Client
	var authClient *auth.Client

	// 尝试连接数据库
	db, err = connectDB(pgHost, pgPort, pgUser, pgPassword, pgDB)
	if err != nil {
		log.Printf("Warning: 数据库连接失败，将禁用认证和审计功能: %v", err)
	} else {
		// 初始化审计日志客户端
		auditClient, err = audit.NewClient(pgHost, pgPort, pgUser, pgPassword, pgDB)
		if err != nil {
			log.Printf("Warning: 审计日志初始化失败: %v", err)
		}

		// 初始化认证客户端
		authClient, err = auth.NewClient(db, jwtSecret)
		if err != nil {
			log.Printf("Warning: 认证模块初始化失败: %v", err)
		}
	}

	// 创建路由
	router := api.NewRouter(k8sClient, metricsClient, alertClient, auditClient, authClient)

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

	// 关闭数据库连接
	if db != nil {
		db.Close()
	}

	log.Println("Server exited")
}

// connectDB 连接数据库，如果数据库不存在则创建
func connectDB(host string, port int, user, password, dbname string) (*sql.DB, error) {
	// 首先连接到 postgres 数据库，检查目标数据库是否存在
	adminConnStr := fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=postgres sslmode=disable",
		host, port, user, password)

	adminDB, err := sql.Open("postgres", adminConnStr)
	if err != nil {
		return nil, fmt.Errorf("连接 postgres 数据库失败: %w", err)
	}
	defer adminDB.Close()

	// 测试连接
	if err := adminDB.Ping(); err != nil {
		return nil, fmt.Errorf("数据库连接测试失败: %w", err)
	}

	// 检查目标数据库是否存在
	var exists bool
	err = adminDB.QueryRow("SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = $1)", dbname).Scan(&exists)
	if err != nil {
		return nil, fmt.Errorf("检查数据库存在性失败: %w", err)
	}

	// 如果数据库不存在，创建它
	if !exists {
		_, err = adminDB.Exec(fmt.Sprintf("CREATE DATABASE %s", dbname))
		if err != nil {
			return nil, fmt.Errorf("创建数据库失败: %w", err)
		}
		log.Printf("数据库 %s 创建成功", dbname)
	}

	// 连接到目标数据库
	connStr := fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=disable",
		host, port, user, password, dbname)

	db, err := sql.Open("postgres", connStr)
	if err != nil {
		return nil, fmt.Errorf("连接数据库失败: %w", err)
	}

	// 测试连接
	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("数据库连接测试失败: %w", err)
	}

	// 设置连接池
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)

	log.Printf("PostgreSQL 连接成功: %s:%d/%s", host, port, dbname)
	return db, nil
}
