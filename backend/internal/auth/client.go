package auth

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrUserNotFound      = errors.New("用户不存在")
	ErrInvalidPassword   = errors.New("密码错误")
	ErrUserDisabled      = errors.New("用户已禁用")
	ErrTokenExpired      = errors.New("Token 已过期")
	ErrInvalidToken      = errors.New("无效的 Token")
	ErrPermissionDenied  = errors.New("权限不足")
	ErrNamespaceNotAllowed = errors.New("无权访问该命名空间")
)

// User 用户信息
type User struct {
	ID              int64     `json:"id"`
	Username        string    `json:"username"`
	Password        string    `json:"-"` // 不返回密码
	DisplayName     string    `json:"displayName"`
	Email           string    `json:"email"`
	Role            string    `json:"role"`       // admin, operator, viewer
	ServiceAccount  string    `json:"serviceAccount,omitempty"` // K8s ServiceAccount 名称
	SANamespace     string    `json:"saNamespace,omitempty"`    // ServiceAccount 所在命名空间
	SAToken         string    `json:"-"`                        // ServiceAccount Token (不返回)
	AllNamespaces   bool      `json:"allNamespaces"`            // 是否有所有命名空间权限
	Enabled         bool      `json:"enabled"`
	LastLoginAt     *time.Time `json:"lastLoginAt,omitempty"`
	LastLoginIP     string    `json:"lastLoginIP,omitempty"`
	CreatedAt       time.Time `json:"createdAt"`
	UpdatedAt       time.Time `json:"updatedAt"`
}

// UserNamespace 用户可访问的命名空间
type UserNamespace struct {
	ID          int64  `json:"id"`
	UserID      int64  `json:"userId"`
	Namespace   string `json:"namespace"`
	Permissions string `json:"permissions"` // read, write, admin
}

// Session 用户会话
type Session struct {
	ID        string    `json:"id"`
	UserID    int64     `json:"userId"`
	Token     string    `json:"token"`
	IP        string    `json:"ip"`
	UserAgent string    `json:"userAgent"`
	ExpiresAt time.Time `json:"expiresAt"`
	CreatedAt time.Time `json:"createdAt"`
}

// ApprovalRequest 审批请求
type ApprovalRequest struct {
	ID           int64      `json:"id"`
	UserID       int64      `json:"userId"`
	Username     string     `json:"username"`
	Action       string     `json:"action"`       // delete, scale, restart
	Resource     string     `json:"resource"`     // pods, deployments, etc.
	ResourceName string     `json:"resourceName"`
	Namespace    string     `json:"namespace"`
	Reason       string     `json:"reason"`
	Status       string     `json:"status"`       // pending, approved, rejected
	ApproverID   *int64     `json:"approverId,omitempty"`
	ApproverName string     `json:"approverName,omitempty"`
	ApprovedAt   *time.Time `json:"approvedAt,omitempty"`
	Comment      string     `json:"comment,omitempty"`
	RequestData  string     `json:"requestData,omitempty"` // JSON 原始请求数据
	CreatedAt    time.Time  `json:"createdAt"`
	UpdatedAt    time.Time  `json:"updatedAt"`
}

// ApprovalRule 审批规则
type ApprovalRule struct {
	ID         int64  `json:"id"`
	Action     string `json:"action"`     // delete, scale, restart, *
	Resource   string `json:"resource"`   // pods, deployments, *, etc.
	Namespace  string `json:"namespace"`  // 空表示所有命名空间
	MinRole    string `json:"minRole"`    // 需要的最低角色: admin, operator
	Enabled    bool   `json:"enabled"`
}

// JWTClaims JWT 声明
type JWTClaims struct {
	UserID      int64  `json:"userId"`
	Username    string `json:"username"`
	Role        string `json:"role"`
	SessionID   string `json:"sessionId"`
	jwt.RegisteredClaims
}

// Client 认证客户端
type Client struct {
	db        *sql.DB
	jwtSecret []byte
}

// NewClient 创建认证客户端
func NewClient(db *sql.DB, jwtSecret string) (*Client, error) {
	client := &Client{
		db:        db,
		jwtSecret: []byte(jwtSecret),
	}

	// 初始化表结构
	if err := client.initSchema(); err != nil {
		return nil, fmt.Errorf("初始化用户表结构失败: %w", err)
	}

	// 创建默认管理员账户
	if err := client.ensureAdminUser(); err != nil {
		return nil, fmt.Errorf("创建默认管理员失败: %w", err)
	}

	log.Println("用户认证模块初始化成功")
	return client, nil
}

// initSchema 初始化表结构
func (c *Client) initSchema() error {
	schema := `
	-- 用户表
	CREATE TABLE IF NOT EXISTS users (
		id BIGSERIAL PRIMARY KEY,
		username VARCHAR(100) UNIQUE NOT NULL,
		password VARCHAR(255) NOT NULL,
		display_name VARCHAR(200),
		email VARCHAR(200),
		role VARCHAR(50) NOT NULL DEFAULT 'viewer',
		service_account VARCHAR(200),
		sa_namespace VARCHAR(200),
		sa_token TEXT,
		all_namespaces BOOLEAN DEFAULT FALSE,
		enabled BOOLEAN DEFAULT TRUE,
		last_login_at TIMESTAMP WITH TIME ZONE,
		last_login_ip VARCHAR(50),
		created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
	);

	-- 用户命名空间访问权限表
	CREATE TABLE IF NOT EXISTS user_namespaces (
		id BIGSERIAL PRIMARY KEY,
		user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		namespace VARCHAR(200) NOT NULL,
		permissions VARCHAR(50) DEFAULT 'read',
		UNIQUE(user_id, namespace)
	);

	-- 用户会话表
	CREATE TABLE IF NOT EXISTS sessions (
		id VARCHAR(64) PRIMARY KEY,
		user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		token TEXT NOT NULL,
		ip VARCHAR(50),
		user_agent TEXT,
		expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
		created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
	);

	-- 审批请求表
	CREATE TABLE IF NOT EXISTS approval_requests (
		id BIGSERIAL PRIMARY KEY,
		user_id BIGINT NOT NULL REFERENCES users(id),
		action VARCHAR(50) NOT NULL,
		resource VARCHAR(100) NOT NULL,
		resource_name VARCHAR(255) NOT NULL,
		namespace VARCHAR(200),
		reason TEXT,
		status VARCHAR(20) DEFAULT 'pending',
		approver_id BIGINT REFERENCES users(id),
		approved_at TIMESTAMP WITH TIME ZONE,
		comment TEXT,
		request_data TEXT,
		created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
	);

	-- 审批规则表
	CREATE TABLE IF NOT EXISTS approval_rules (
		id BIGSERIAL PRIMARY KEY,
		action VARCHAR(50) NOT NULL,
		resource VARCHAR(100) NOT NULL,
		namespace VARCHAR(200),
		min_role VARCHAR(50) NOT NULL DEFAULT 'admin',
		enabled BOOLEAN DEFAULT TRUE,
		UNIQUE(action, resource, namespace)
	);

	-- 索引
	CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
	CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
	CREATE INDEX IF NOT EXISTS idx_user_namespaces_user_id ON user_namespaces(user_id);
	CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
	CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
	CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON approval_requests(status);
	CREATE INDEX IF NOT EXISTS idx_approval_requests_user_id ON approval_requests(user_id);
	`

	_, err := c.db.Exec(schema)
	return err
}

// ensureAdminUser 确保存在默认管理员
func (c *Client) ensureAdminUser() error {
	var count int
	err := c.db.QueryRow("SELECT COUNT(*) FROM users WHERE username = 'admin'").Scan(&count)
	if err != nil {
		return err
	}

	if count == 0 {
		// 创建默认管理员，密码为 admin123
		hashedPassword, _ := bcrypt.GenerateFromPassword([]byte("admin123"), bcrypt.DefaultCost)
		_, err = c.db.Exec(`
			INSERT INTO users (username, password, display_name, role, all_namespaces, enabled)
			VALUES ('admin', $1, '系统管理员', 'admin', true, true)
		`, string(hashedPassword))
		if err != nil {
			return err
		}
		log.Println("默认管理员账户已创建: admin / admin123")
	}

	// 插入默认审批规则
	c.db.Exec(`
		INSERT INTO approval_rules (action, resource, namespace, min_role, enabled)
		VALUES
			('delete', 'deployments', '', 'admin', true),
			('delete', 'statefulsets', '', 'admin', true),
			('delete', 'daemonsets', '', 'admin', true),
			('delete', 'services', '', 'admin', true),
			('delete', 'configmaps', '', 'operator', false),
			('delete', 'secrets', '', 'admin', true),
			('delete', 'persistentvolumeclaims', '', 'admin', true),
			('delete', 'namespaces', '', 'admin', true)
		ON CONFLICT DO NOTHING
	`)

	return nil
}

// generateSessionID 生成会话 ID
func generateSessionID() string {
	b := make([]byte, 32)
	rand.Read(b)
	return hex.EncodeToString(b)
}

// Login 用户登录
func (c *Client) Login(username, password, ip, userAgent string) (*User, string, error) {
	var user User
	var hashedPassword string
	var lastLoginAt sql.NullTime
	var lastLoginIP sql.NullString

	err := c.db.QueryRow(`
		SELECT id, username, password, COALESCE(display_name, ''), COALESCE(email, ''),
		       role, COALESCE(service_account, ''), COALESCE(sa_namespace, ''), COALESCE(sa_token, ''),
		       all_namespaces, enabled, last_login_at, last_login_ip, created_at, updated_at
		FROM users WHERE username = $1
	`, username).Scan(
		&user.ID, &user.Username, &hashedPassword, &user.DisplayName, &user.Email,
		&user.Role, &user.ServiceAccount, &user.SANamespace, &user.SAToken,
		&user.AllNamespaces, &user.Enabled, &lastLoginAt, &lastLoginIP, &user.CreatedAt, &user.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, "", ErrUserNotFound
	}
	if err != nil {
		return nil, "", err
	}

	if !user.Enabled {
		return nil, "", ErrUserDisabled
	}

	// 验证密码
	if err := bcrypt.CompareHashAndPassword([]byte(hashedPassword), []byte(password)); err != nil {
		return nil, "", ErrInvalidPassword
	}

	// 更新最后登录时间
	c.db.Exec("UPDATE users SET last_login_at = $1, last_login_ip = $2 WHERE id = $3",
		time.Now(), ip, user.ID)

	// 创建会话
	sessionID := generateSessionID()
	expiresAt := time.Now().Add(24 * time.Hour)

	// 生成 JWT
	claims := JWTClaims{
		UserID:    user.ID,
		Username:  user.Username,
		Role:      user.Role,
		SessionID: sessionID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Subject:   fmt.Sprintf("%d", user.ID),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString(c.jwtSecret)
	if err != nil {
		return nil, "", err
	}

	// 保存会话
	_, err = c.db.Exec(`
		INSERT INTO sessions (id, user_id, token, ip, user_agent, expires_at)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, sessionID, user.ID, tokenString, ip, userAgent, expiresAt)
	if err != nil {
		return nil, "", err
	}

	if lastLoginAt.Valid {
		user.LastLoginAt = &lastLoginAt.Time
	}
	if lastLoginIP.Valid {
		user.LastLoginIP = lastLoginIP.String
	}

	return &user, tokenString, nil
}

// ValidateToken 验证 JWT Token
func (c *Client) ValidateToken(tokenString string) (*User, error) {
	token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
		return c.jwtSecret, nil
	})

	if err != nil {
		return nil, ErrInvalidToken
	}

	claims, ok := token.Claims.(*JWTClaims)
	if !ok || !token.Valid {
		return nil, ErrInvalidToken
	}

	// 检查会话是否有效
	var expiresAt time.Time
	err = c.db.QueryRow("SELECT expires_at FROM sessions WHERE id = $1", claims.SessionID).Scan(&expiresAt)
	if err == sql.ErrNoRows {
		return nil, ErrInvalidToken
	}
	if err != nil {
		return nil, err
	}

	if time.Now().After(expiresAt) {
		return nil, ErrTokenExpired
	}

	// 获取用户信息
	return c.GetUserByID(claims.UserID)
}

// Logout 用户登出
func (c *Client) Logout(tokenString string) error {
	token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
		return c.jwtSecret, nil
	})
	if err != nil {
		return nil
	}

	claims, ok := token.Claims.(*JWTClaims)
	if !ok {
		return nil
	}

	// 删除会话
	_, _ = c.db.Exec("DELETE FROM sessions WHERE id = $1", claims.SessionID)
	return nil
}

// GetUserByID 根据 ID 获取用户
func (c *Client) GetUserByID(id int64) (*User, error) {
	var user User
	var lastLoginAt sql.NullTime
	var lastLoginIP sql.NullString

	err := c.db.QueryRow(`
		SELECT id, username, COALESCE(display_name, ''), COALESCE(email, ''),
		       role, COALESCE(service_account, ''), COALESCE(sa_namespace, ''),
		       all_namespaces, enabled, last_login_at, last_login_ip, created_at, updated_at
		FROM users WHERE id = $1
	`, id).Scan(
		&user.ID, &user.Username, &user.DisplayName, &user.Email,
		&user.Role, &user.ServiceAccount, &user.SANamespace,
		&user.AllNamespaces, &user.Enabled, &lastLoginAt, &lastLoginIP, &user.CreatedAt, &user.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, ErrUserNotFound
	}
	if err != nil {
		return nil, err
	}

	if lastLoginAt.Valid {
		user.LastLoginAt = &lastLoginAt.Time
	}
	if lastLoginIP.Valid {
		user.LastLoginIP = lastLoginIP.String
	}

	return &user, nil
}

// GetUserNamespaces 获取用户可访问的命名空间
func (c *Client) GetUserNamespaces(userID int64) ([]UserNamespace, error) {
	rows, err := c.db.Query(`
		SELECT id, user_id, namespace, permissions
		FROM user_namespaces WHERE user_id = $1
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var namespaces []UserNamespace
	for rows.Next() {
		var ns UserNamespace
		if err := rows.Scan(&ns.ID, &ns.UserID, &ns.Namespace, &ns.Permissions); err != nil {
			return nil, err
		}
		namespaces = append(namespaces, ns)
	}

	return namespaces, nil
}

// CanAccessNamespace 检查用户是否可以访问指定命名空间
func (c *Client) CanAccessNamespace(userID int64, namespace string) (bool, error) {
	// 先检查用户是否有所有命名空间权限
	var allNamespaces bool
	err := c.db.QueryRow("SELECT all_namespaces FROM users WHERE id = $1", userID).Scan(&allNamespaces)
	if err != nil {
		return false, err
	}
	if allNamespaces {
		return true, nil
	}

	// 检查具体命名空间权限
	var count int
	err = c.db.QueryRow(`
		SELECT COUNT(*) FROM user_namespaces WHERE user_id = $1 AND namespace = $2
	`, userID, namespace).Scan(&count)
	if err != nil {
		return false, err
	}

	return count > 0, nil
}
