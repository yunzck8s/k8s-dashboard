package audit

import (
	"database/sql"
	"fmt"
	"log"
	"time"

	_ "github.com/lib/pq"
)

// AuditLog 审计日志结构
type AuditLog struct {
	ID           int64     `json:"id"`
	Timestamp    time.Time `json:"timestamp"`
	User         string    `json:"user"`
	Action       string    `json:"action"`       // GET, POST, PUT, DELETE
	Resource     string    `json:"resource"`     // pods, deployments, nodes, etc.
	ResourceName string    `json:"resourceName"` // 资源名称
	Namespace    string    `json:"namespace"`    // 命名空间（如果适用）
	Cluster      string    `json:"cluster"`      // 集群名称
	StatusCode   int       `json:"statusCode"`   // HTTP 状态码
	ClientIP     string    `json:"clientIP"`     // 客户端 IP
	UserAgent    string    `json:"userAgent"`    // 用户代理
	RequestBody  string    `json:"requestBody"`  // 请求体（敏感信息已过滤）
	Duration     int64     `json:"duration"`     // 请求耗时（毫秒）
	Message      string    `json:"message"`      // 额外信息
}

// ListParams 查询参数
type ListParams struct {
	Page      int       `form:"page"`
	PageSize  int       `form:"pageSize"`
	StartTime time.Time `form:"startTime"`
	EndTime   time.Time `form:"endTime"`
	User      string    `form:"user"`
	Action    string    `form:"action"`
	Resource  string    `form:"resource"`
	Namespace string    `form:"namespace"`
	Cluster   string    `form:"cluster"`
}

// ListResponse 列表响应
type ListResponse struct {
	Items []AuditLog `json:"items"`
	Total int64      `json:"total"`
	Page  int        `json:"page"`
	Pages int        `json:"pages"`
}

// Client 审计日志客户端
type Client struct {
	db *sql.DB
}

// NewClient 创建审计日志客户端
func NewClient(host string, port int, user, password, dbname string) (*Client, error) {
	// 首先连接到 postgres 数据库，检查目标数据库是否存在
	adminConnStr := fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=postgres sslmode=disable",
		host, port, user, password)

	adminDB, err := sql.Open("postgres", adminConnStr)
	if err != nil {
		return nil, fmt.Errorf("连接 postgres 数据库失败: %w", err)
	}
	defer adminDB.Close()

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

	client := &Client{db: db}

	// 初始化表结构
	if err := client.initSchema(); err != nil {
		return nil, fmt.Errorf("初始化表结构失败: %w", err)
	}

	log.Printf("PostgreSQL 连接成功: %s:%d/%s", host, port, dbname)
	return client, nil
}

// initSchema 初始化表结构
func (c *Client) initSchema() error {
	schema := `
	CREATE TABLE IF NOT EXISTS audit_logs (
		id BIGSERIAL PRIMARY KEY,
		timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
		"user" VARCHAR(255) NOT NULL DEFAULT 'anonymous',
		action VARCHAR(20) NOT NULL,
		resource VARCHAR(100) NOT NULL,
		resource_name VARCHAR(255),
		namespace VARCHAR(255),
		cluster VARCHAR(100) DEFAULT 'default',
		status_code INT,
		client_ip VARCHAR(50),
		user_agent TEXT,
		request_body TEXT,
		duration BIGINT,
		message TEXT
	);

	CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
	CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs("user");
	CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
	CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource);
	CREATE INDEX IF NOT EXISTS idx_audit_logs_namespace ON audit_logs(namespace);
	`

	_, err := c.db.Exec(schema)
	return err
}

// Log 记录审计日志
func (c *Client) Log(log *AuditLog) error {
	query := `
		INSERT INTO audit_logs (
			timestamp, "user", action, resource, resource_name,
			namespace, cluster, status_code, client_ip, user_agent,
			request_body, duration, message
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
	`

	_, err := c.db.Exec(query,
		log.Timestamp,
		log.User,
		log.Action,
		log.Resource,
		log.ResourceName,
		log.Namespace,
		log.Cluster,
		log.StatusCode,
		log.ClientIP,
		log.UserAgent,
		log.RequestBody,
		log.Duration,
		log.Message,
	)

	return err
}

// List 查询审计日志
func (c *Client) List(params ListParams) (*ListResponse, error) {
	// 默认值
	if params.Page < 1 {
		params.Page = 1
	}
	if params.PageSize < 1 {
		params.PageSize = 20
	}
	if params.PageSize > 100 {
		params.PageSize = 100
	}

	// 构建查询条件
	where := "WHERE 1=1"
	args := []interface{}{}
	argIndex := 1

	if !params.StartTime.IsZero() {
		where += fmt.Sprintf(" AND timestamp >= $%d", argIndex)
		args = append(args, params.StartTime)
		argIndex++
	}
	if !params.EndTime.IsZero() {
		where += fmt.Sprintf(" AND timestamp <= $%d", argIndex)
		args = append(args, params.EndTime)
		argIndex++
	}
	if params.User != "" {
		where += fmt.Sprintf(" AND \"user\" = $%d", argIndex)
		args = append(args, params.User)
		argIndex++
	}
	if params.Action != "" {
		where += fmt.Sprintf(" AND action = $%d", argIndex)
		args = append(args, params.Action)
		argIndex++
	}
	if params.Resource != "" {
		where += fmt.Sprintf(" AND resource = $%d", argIndex)
		args = append(args, params.Resource)
		argIndex++
	}
	if params.Namespace != "" {
		where += fmt.Sprintf(" AND namespace = $%d", argIndex)
		args = append(args, params.Namespace)
		argIndex++
	}
	if params.Cluster != "" {
		where += fmt.Sprintf(" AND cluster = $%d", argIndex)
		args = append(args, params.Cluster)
		argIndex++
	}

	// 查询总数
	countQuery := "SELECT COUNT(*) FROM audit_logs " + where
	var total int64
	if err := c.db.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return nil, err
	}

	// 查询数据
	offset := (params.Page - 1) * params.PageSize
	query := fmt.Sprintf(`
		SELECT id, timestamp, "user", action, resource, resource_name,
		       COALESCE(namespace, ''), COALESCE(cluster, 'default'),
		       COALESCE(status_code, 0), COALESCE(client_ip, ''),
		       COALESCE(user_agent, ''), COALESCE(request_body, ''),
		       COALESCE(duration, 0), COALESCE(message, '')
		FROM audit_logs %s
		ORDER BY timestamp DESC
		LIMIT $%d OFFSET $%d
	`, where, argIndex, argIndex+1)

	args = append(args, params.PageSize, offset)

	rows, err := c.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []AuditLog
	for rows.Next() {
		var log AuditLog
		err := rows.Scan(
			&log.ID, &log.Timestamp, &log.User, &log.Action, &log.Resource,
			&log.ResourceName, &log.Namespace, &log.Cluster, &log.StatusCode,
			&log.ClientIP, &log.UserAgent, &log.RequestBody, &log.Duration, &log.Message,
		)
		if err != nil {
			return nil, err
		}
		logs = append(logs, log)
	}

	pages := int(total) / params.PageSize
	if int(total)%params.PageSize > 0 {
		pages++
	}

	return &ListResponse{
		Items: logs,
		Total: total,
		Page:  params.Page,
		Pages: pages,
	}, nil
}

// GetStats 获取审计日志统计
func (c *Client) GetStats(duration time.Duration) (map[string]interface{}, error) {
	since := time.Now().Add(-duration)

	stats := make(map[string]interface{})

	// 总数
	var total int64
	c.db.QueryRow("SELECT COUNT(*) FROM audit_logs WHERE timestamp >= $1", since).Scan(&total)
	stats["total"] = total

	// 按操作类型统计
	actionStats := make(map[string]int64)
	rows, err := c.db.Query(`
		SELECT action, COUNT(*) as count
		FROM audit_logs
		WHERE timestamp >= $1
		GROUP BY action
	`, since)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var action string
			var count int64
			rows.Scan(&action, &count)
			actionStats[action] = count
		}
	}
	stats["byAction"] = actionStats

	// 按资源类型统计
	resourceStats := make(map[string]int64)
	rows, err = c.db.Query(`
		SELECT resource, COUNT(*) as count
		FROM audit_logs
		WHERE timestamp >= $1
		GROUP BY resource
		ORDER BY count DESC
		LIMIT 10
	`, since)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var resource string
			var count int64
			rows.Scan(&resource, &count)
			resourceStats[resource] = count
		}
	}
	stats["byResource"] = resourceStats

	// 按用户统计
	userStats := make(map[string]int64)
	rows, err = c.db.Query(`
		SELECT "user", COUNT(*) as count
		FROM audit_logs
		WHERE timestamp >= $1
		GROUP BY "user"
		ORDER BY count DESC
		LIMIT 10
	`, since)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var user string
			var count int64
			rows.Scan(&user, &count)
			userStats[user] = count
		}
	}
	stats["byUser"] = userStats

	return stats, nil
}

// Close 关闭数据库连接
func (c *Client) Close() error {
	return c.db.Close()
}
