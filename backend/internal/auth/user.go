package auth

import (
	"database/sql"
	"fmt"
	"time"

	dbutil "github.com/k8s-dashboard/backend/internal/db"
	"golang.org/x/crypto/bcrypt"
)

// CreateUserRequest 创建用户请求
type CreateUserRequest struct {
	Username       string   `json:"username"`
	Password       string   `json:"password"`
	DisplayName    string   `json:"displayName"`
	Email          string   `json:"email"`
	Role           string   `json:"role"`
	ServiceAccount string   `json:"serviceAccount"`
	SANamespace    string   `json:"saNamespace"`
	SAToken        string   `json:"saToken"`
	AllNamespaces  bool     `json:"allNamespaces"`
	Namespaces     []string `json:"namespaces"`
}

// UpdateUserRequest 更新用户请求
type UpdateUserRequest struct {
	DisplayName    string   `json:"displayName"`
	Email          string   `json:"email"`
	Role           string   `json:"role"`
	ServiceAccount string   `json:"serviceAccount"`
	SANamespace    string   `json:"saNamespace"`
	SAToken        string   `json:"saToken"`
	AllNamespaces  bool     `json:"allNamespaces"`
	Namespaces     []string `json:"namespaces"`
	Enabled        bool     `json:"enabled"`
}

// ListUsersParams 用户列表查询参数
type ListUsersParams struct {
	Page     int    `form:"page"`
	PageSize int    `form:"pageSize"`
	Search   string `form:"search"`
	Role     string `form:"role"`
	Enabled  *bool  `form:"enabled"`
}

// ListUsersResponse 用户列表响应
type ListUsersResponse struct {
	Items []User `json:"items"`
	Total int64  `json:"total"`
	Page  int    `json:"page"`
	Pages int    `json:"pages"`
}

// CreateUser 创建用户
func (c *Client) CreateUser(req *CreateUserRequest) (*User, error) {
	// 验证必填字段
	if req.Username == "" || req.Password == "" {
		return nil, fmt.Errorf("用户名和密码不能为空")
	}

	// 验证角色
	if req.Role != "admin" && req.Role != "operator" && req.Role != "viewer" {
		req.Role = "viewer"
	}

	// 加密密码
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	// 开启事务
	tx, err := c.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	// 创建用户
	var userID int64
	if c.dialect == dbutil.DialectSQLite {
		result, execErr := tx.Exec(`
			INSERT INTO users (username, password, display_name, email, role,
			                   service_account, sa_namespace, sa_token, all_namespaces, enabled)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
		`, req.Username, string(hashedPassword), req.DisplayName, req.Email, req.Role,
			req.ServiceAccount, req.SANamespace, req.SAToken, req.AllNamespaces)
		if execErr != nil {
			return nil, fmt.Errorf("创建用户失败: %w", execErr)
		}
		lastID, idErr := result.LastInsertId()
		if idErr != nil {
			return nil, fmt.Errorf("读取用户 ID 失败: %w", idErr)
		}
		userID = lastID
	} else {
		err = tx.QueryRow(`
			INSERT INTO users (username, password, display_name, email, role,
			                   service_account, sa_namespace, sa_token, all_namespaces, enabled)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
			RETURNING id
		`, req.Username, string(hashedPassword), req.DisplayName, req.Email, req.Role,
			req.ServiceAccount, req.SANamespace, req.SAToken, req.AllNamespaces).Scan(&userID)
		if err != nil {
			return nil, fmt.Errorf("创建用户失败: %w", err)
		}
	}

	// 添加命名空间权限
	if !req.AllNamespaces && len(req.Namespaces) > 0 {
		for _, ns := range req.Namespaces {
			_, err = tx.Exec(`
				INSERT INTO user_namespaces (user_id, namespace, permissions)
				VALUES ($1, $2, 'write')
			`, userID, ns)
			if err != nil {
				return nil, fmt.Errorf("添加命名空间权限失败: %w", err)
			}
		}
	}

	if err = tx.Commit(); err != nil {
		return nil, err
	}

	return c.GetUserByID(userID)
}

// UpdateUser 更新用户
func (c *Client) UpdateUser(userID int64, req *UpdateUserRequest) (*User, error) {
	tx, err := c.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	// 更新用户基本信息
	_, err = tx.Exec(`
		UPDATE users SET
			display_name = $1, email = $2, role = $3,
			service_account = $4, sa_namespace = $5, sa_token = $6,
			all_namespaces = $7, enabled = $8, updated_at = $9
		WHERE id = $10
	`, req.DisplayName, req.Email, req.Role,
		req.ServiceAccount, req.SANamespace, req.SAToken,
		req.AllNamespaces, req.Enabled, time.Now(), userID)
	if err != nil {
		return nil, fmt.Errorf("更新用户失败: %w", err)
	}

	// 更新命名空间权限
	if !req.AllNamespaces {
		// 删除旧的命名空间权限
		_, err = tx.Exec("DELETE FROM user_namespaces WHERE user_id = $1", userID)
		if err != nil {
			return nil, err
		}

		// 添加新的命名空间权限
		for _, ns := range req.Namespaces {
			_, err = tx.Exec(`
				INSERT INTO user_namespaces (user_id, namespace, permissions)
				VALUES ($1, $2, 'write')
			`, userID, ns)
			if err != nil {
				return nil, err
			}
		}
	}

	if err = tx.Commit(); err != nil {
		return nil, err
	}

	return c.GetUserByID(userID)
}

// UpdatePassword 更新密码
func (c *Client) UpdatePassword(userID int64, oldPassword, newPassword string) error {
	// 验证旧密码
	var hashedPassword string
	err := c.db.QueryRow("SELECT password FROM users WHERE id = $1", userID).Scan(&hashedPassword)
	if err != nil {
		return ErrUserNotFound
	}

	if err := bcrypt.CompareHashAndPassword([]byte(hashedPassword), []byte(oldPassword)); err != nil {
		return ErrInvalidPassword
	}

	// 加密新密码
	newHashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	_, err = c.db.Exec("UPDATE users SET password = $1, updated_at = $2 WHERE id = $3",
		string(newHashedPassword), time.Now(), userID)
	return err
}

// ResetPassword 重置密码（管理员操作）
func (c *Client) ResetPassword(userID int64, newPassword string) error {
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	_, err = c.db.Exec("UPDATE users SET password = $1, updated_at = $2 WHERE id = $3",
		string(hashedPassword), time.Now(), userID)
	return err
}

// DeleteUser 删除用户
func (c *Client) DeleteUser(userID int64) error {
	// 不允许删除 admin 用户
	var username string
	err := c.db.QueryRow("SELECT username FROM users WHERE id = $1", userID).Scan(&username)
	if err != nil {
		return err
	}
	if username == "admin" {
		return fmt.Errorf("不能删除系统管理员账户")
	}

	_, err = c.db.Exec("DELETE FROM users WHERE id = $1", userID)
	return err
}

// ListUsers 获取用户列表
func (c *Client) ListUsers(params ListUsersParams) (*ListUsersResponse, error) {
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

	if params.Search != "" {
		if c.dialect == dbutil.DialectSQLite {
			where += fmt.Sprintf(" AND (LOWER(username) LIKE LOWER($%d) OR LOWER(display_name) LIKE LOWER($%d) OR LOWER(email) LIKE LOWER($%d))", argIndex, argIndex, argIndex)
		} else {
			where += fmt.Sprintf(" AND (username ILIKE $%d OR display_name ILIKE $%d OR email ILIKE $%d)", argIndex, argIndex, argIndex)
		}
		args = append(args, "%"+params.Search+"%")
		argIndex++
	}
	if params.Role != "" {
		where += fmt.Sprintf(" AND role = $%d", argIndex)
		args = append(args, params.Role)
		argIndex++
	}
	if params.Enabled != nil {
		where += fmt.Sprintf(" AND enabled = $%d", argIndex)
		args = append(args, *params.Enabled)
		argIndex++
	}

	// 查询总数
	var total int64
	countQuery := "SELECT COUNT(*) FROM users " + where
	if err := c.db.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return nil, err
	}

	// 查询数据
	offset := (params.Page - 1) * params.PageSize
	query := fmt.Sprintf(`
		SELECT id, username, COALESCE(display_name, ''), COALESCE(email, ''),
		       role, COALESCE(service_account, ''), COALESCE(sa_namespace, ''),
		       all_namespaces, enabled, last_login_at, last_login_ip, created_at, updated_at
		FROM users %s
		ORDER BY created_at DESC
		LIMIT $%d OFFSET $%d
	`, where, argIndex, argIndex+1)

	args = append(args, params.PageSize, offset)

	rows, err := c.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []User
	for rows.Next() {
		var user User
		var lastLoginAt sql.NullTime
		var lastLoginIP sql.NullString

		err := rows.Scan(
			&user.ID, &user.Username, &user.DisplayName, &user.Email,
			&user.Role, &user.ServiceAccount, &user.SANamespace,
			&user.AllNamespaces, &user.Enabled, &lastLoginAt, &lastLoginIP,
			&user.CreatedAt, &user.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}

		if lastLoginAt.Valid {
			user.LastLoginAt = &lastLoginAt.Time
		}
		if lastLoginIP.Valid {
			user.LastLoginIP = lastLoginIP.String
		}

		users = append(users, user)
	}

	pages := int(total) / params.PageSize
	if int(total)%params.PageSize > 0 {
		pages++
	}

	return &ListUsersResponse{
		Items: users,
		Total: total,
		Page:  params.Page,
		Pages: pages,
	}, nil
}

// GetUserSessions 获取用户会话列表
func (c *Client) GetUserSessions(userID int64) ([]Session, error) {
	rows, err := c.db.Query(`
		SELECT id, user_id, ip, user_agent, expires_at, created_at
		FROM sessions WHERE user_id = $1 AND expires_at > $2
		ORDER BY created_at DESC
	`, userID, time.Now())
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sessions []Session
	for rows.Next() {
		var s Session
		if err := rows.Scan(&s.ID, &s.UserID, &s.IP, &s.UserAgent, &s.ExpiresAt, &s.CreatedAt); err != nil {
			return nil, err
		}
		sessions = append(sessions, s)
	}

	return sessions, nil
}

// RevokeSession 撤销会话
func (c *Client) RevokeSession(sessionID string) error {
	_, err := c.db.Exec("DELETE FROM sessions WHERE id = $1", sessionID)
	return err
}

// RevokeAllSessions 撤销用户所有会话
func (c *Client) RevokeAllSessions(userID int64) error {
	_, err := c.db.Exec("DELETE FROM sessions WHERE user_id = $1", userID)
	return err
}

// CleanExpiredSessions 清理过期会话
func (c *Client) CleanExpiredSessions() error {
	_, err := c.db.Exec("DELETE FROM sessions WHERE expires_at < $1", time.Now())
	return err
}
