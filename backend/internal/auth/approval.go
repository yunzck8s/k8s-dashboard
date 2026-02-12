package auth

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	dbutil "github.com/k8s-dashboard/backend/internal/db"
)

// CreateApprovalRequest 创建审批请求
type CreateApprovalRequest struct {
	Action       string      `json:"action"`
	Resource     string      `json:"resource"`
	ResourceName string      `json:"resourceName"`
	Namespace    string      `json:"namespace"`
	Reason       string      `json:"reason"`
	RequestData  interface{} `json:"requestData"`
}

// ListApprovalParams 审批列表查询参数
type ListApprovalParams struct {
	Page      int    `form:"page"`
	PageSize  int    `form:"pageSize"`
	Status    string `form:"status"`
	Action    string `form:"action"`
	Resource  string `form:"resource"`
	Namespace string `form:"namespace"`
	UserID    int64  `form:"userId"`
}

// ListApprovalResponse 审批列表响应
type ListApprovalResponse struct {
	Items []ApprovalRequest `json:"items"`
	Total int64             `json:"total"`
	Page  int               `json:"page"`
	Pages int               `json:"pages"`
}

// NeedsApproval 检查操作是否需要审批
func (c *Client) NeedsApproval(userRole, action, resource, namespace string) (bool, error) {
	// admin 角色不需要审批
	if userRole == "admin" {
		return false, nil
	}

	// 查询审批规则
	var minRole string
	var enabled bool
	err := c.db.QueryRow(`
		SELECT min_role, enabled FROM approval_rules
		WHERE (action = $1 OR action = '*')
		  AND (resource = $2 OR resource = '*')
		  AND (namespace = $3 OR namespace = '' OR namespace IS NULL)
		  AND enabled = true
		ORDER BY
			CASE WHEN action = $1 THEN 0 ELSE 1 END,
			CASE WHEN resource = $2 THEN 0 ELSE 1 END,
			CASE WHEN namespace = $3 THEN 0 ELSE 1 END
		LIMIT 1
	`, action, resource, namespace).Scan(&minRole, &enabled)

	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}

	if !enabled {
		return false, nil
	}

	// 检查用户角色是否满足最低要求
	roleLevel := map[string]int{
		"viewer":   0,
		"operator": 1,
		"admin":    2,
	}

	if roleLevel[userRole] >= roleLevel[minRole] {
		return false, nil
	}

	return true, nil
}

// CreateApproval 创建审批请求
func (c *Client) CreateApproval(userID int64, req *CreateApprovalRequest) (*ApprovalRequest, error) {
	// 序列化请求数据
	var requestDataJSON string
	if req.RequestData != nil {
		data, err := json.Marshal(req.RequestData)
		if err != nil {
			return nil, err
		}
		requestDataJSON = string(data)
	}

	var approvalID int64
	if c.dialect == dbutil.DialectSQLite {
		result, err := c.db.Exec(`
			INSERT INTO approval_requests (user_id, action, resource, resource_name, namespace, reason, request_data, status)
			VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
		`, userID, req.Action, req.Resource, req.ResourceName, req.Namespace, req.Reason, requestDataJSON)
		if err != nil {
			return nil, err
		}
		lastID, err := result.LastInsertId()
		if err != nil {
			return nil, err
		}
		approvalID = lastID
	} else {
		err := c.db.QueryRow(`
			INSERT INTO approval_requests (user_id, action, resource, resource_name, namespace, reason, request_data, status)
			VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
			RETURNING id
		`, userID, req.Action, req.Resource, req.ResourceName, req.Namespace, req.Reason, requestDataJSON).Scan(&approvalID)
		if err != nil {
			return nil, err
		}
	}

	return c.GetApprovalByID(approvalID)
}

// GetApprovalByID 根据 ID 获取审批请求
func (c *Client) GetApprovalByID(id int64) (*ApprovalRequest, error) {
	var approval ApprovalRequest
	var approverID sql.NullInt64
	var approvedAt sql.NullTime
	var comment sql.NullString
	var requestData sql.NullString
	var namespace sql.NullString
	var reason sql.NullString

	err := c.db.QueryRow(`
		SELECT ar.id, ar.user_id, u.username, ar.action, ar.resource, ar.resource_name,
		       ar.namespace, ar.reason, ar.status, ar.approver_id, ar.approved_at,
		       ar.comment, ar.request_data, ar.created_at, ar.updated_at
		FROM approval_requests ar
		JOIN users u ON ar.user_id = u.id
		WHERE ar.id = $1
	`, id).Scan(
		&approval.ID, &approval.UserID, &approval.Username, &approval.Action,
		&approval.Resource, &approval.ResourceName, &namespace, &reason,
		&approval.Status, &approverID, &approvedAt, &comment, &requestData,
		&approval.CreatedAt, &approval.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("审批请求不存在")
	}
	if err != nil {
		return nil, err
	}

	if namespace.Valid {
		approval.Namespace = namespace.String
	}
	if reason.Valid {
		approval.Reason = reason.String
	}
	if approverID.Valid {
		approval.ApproverID = &approverID.Int64
		// 获取审批人用户名
		var approverName string
		c.db.QueryRow("SELECT username FROM users WHERE id = $1", approverID.Int64).Scan(&approverName)
		approval.ApproverName = approverName
	}
	if approvedAt.Valid {
		approval.ApprovedAt = &approvedAt.Time
	}
	if comment.Valid {
		approval.Comment = comment.String
	}
	if requestData.Valid {
		approval.RequestData = requestData.String
	}

	return &approval, nil
}

// ApproveRequest 批准审批请求
func (c *Client) ApproveRequest(approvalID, approverID int64, comment string) error {
	result, err := c.db.Exec(`
		UPDATE approval_requests
		SET status = 'approved', approver_id = $1, approved_at = $2, comment = $3, updated_at = $4
		WHERE id = $5 AND status = 'pending'
	`, approverID, time.Now(), comment, time.Now(), approvalID)

	if err != nil {
		return err
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("审批请求不存在或已处理")
	}

	return nil
}

// RejectRequest 拒绝审批请求
func (c *Client) RejectRequest(approvalID, approverID int64, comment string) error {
	result, err := c.db.Exec(`
		UPDATE approval_requests
		SET status = 'rejected', approver_id = $1, approved_at = $2, comment = $3, updated_at = $4
		WHERE id = $5 AND status = 'pending'
	`, approverID, time.Now(), comment, time.Now(), approvalID)

	if err != nil {
		return err
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("审批请求不存在或已处理")
	}

	return nil
}

// ListApprovals 获取审批列表
func (c *Client) ListApprovals(params ListApprovalParams) (*ListApprovalResponse, error) {
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

	if params.Status != "" {
		where += fmt.Sprintf(" AND ar.status = $%d", argIndex)
		args = append(args, params.Status)
		argIndex++
	}
	if params.Action != "" {
		where += fmt.Sprintf(" AND ar.action = $%d", argIndex)
		args = append(args, params.Action)
		argIndex++
	}
	if params.Resource != "" {
		where += fmt.Sprintf(" AND ar.resource = $%d", argIndex)
		args = append(args, params.Resource)
		argIndex++
	}
	if params.Namespace != "" {
		where += fmt.Sprintf(" AND ar.namespace = $%d", argIndex)
		args = append(args, params.Namespace)
		argIndex++
	}
	if params.UserID > 0 {
		where += fmt.Sprintf(" AND ar.user_id = $%d", argIndex)
		args = append(args, params.UserID)
		argIndex++
	}

	// 查询总数
	var total int64
	countQuery := "SELECT COUNT(*) FROM approval_requests ar " + where
	if err := c.db.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return nil, err
	}

	// 查询数据
	offset := (params.Page - 1) * params.PageSize
	query := fmt.Sprintf(`
		SELECT ar.id, ar.user_id, u.username, ar.action, ar.resource, ar.resource_name,
		       ar.namespace, ar.reason, ar.status, ar.approver_id,
		       COALESCE(au.username, ''), ar.approved_at, ar.comment, ar.request_data,
		       ar.created_at, ar.updated_at
		FROM approval_requests ar
		JOIN users u ON ar.user_id = u.id
		LEFT JOIN users au ON ar.approver_id = au.id
		%s
		ORDER BY ar.created_at DESC
		LIMIT $%d OFFSET $%d
	`, where, argIndex, argIndex+1)

	args = append(args, params.PageSize, offset)

	rows, err := c.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var approvals []ApprovalRequest
	for rows.Next() {
		var a ApprovalRequest
		var approverID sql.NullInt64
		var approverName string
		var approvedAt sql.NullTime
		var comment sql.NullString
		var requestData sql.NullString
		var namespace sql.NullString
		var reason sql.NullString

		err := rows.Scan(
			&a.ID, &a.UserID, &a.Username, &a.Action, &a.Resource, &a.ResourceName,
			&namespace, &reason, &a.Status, &approverID, &approverName, &approvedAt,
			&comment, &requestData, &a.CreatedAt, &a.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}

		if namespace.Valid {
			a.Namespace = namespace.String
		}
		if reason.Valid {
			a.Reason = reason.String
		}
		if approverID.Valid {
			a.ApproverID = &approverID.Int64
			a.ApproverName = approverName
		}
		if approvedAt.Valid {
			a.ApprovedAt = &approvedAt.Time
		}
		if comment.Valid {
			a.Comment = comment.String
		}
		if requestData.Valid {
			a.RequestData = requestData.String
		}

		approvals = append(approvals, a)
	}

	pages := int(total) / params.PageSize
	if int(total)%params.PageSize > 0 {
		pages++
	}

	return &ListApprovalResponse{
		Items: approvals,
		Total: total,
		Page:  params.Page,
		Pages: pages,
	}, nil
}

// GetPendingApprovalCount 获取待审批数量
func (c *Client) GetPendingApprovalCount() (int64, error) {
	var count int64
	err := c.db.QueryRow("SELECT COUNT(*) FROM approval_requests WHERE status = 'pending'").Scan(&count)
	return count, err
}

// ListApprovalRules 获取审批规则列表
func (c *Client) ListApprovalRules() ([]ApprovalRule, error) {
	rows, err := c.db.Query(`
		SELECT id, action, resource, COALESCE(namespace, ''), min_role, enabled
		FROM approval_rules
		ORDER BY resource, action
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rules []ApprovalRule
	for rows.Next() {
		var r ApprovalRule
		if err := rows.Scan(&r.ID, &r.Action, &r.Resource, &r.Namespace, &r.MinRole, &r.Enabled); err != nil {
			return nil, err
		}
		rules = append(rules, r)
	}

	return rules, nil
}

// UpdateApprovalRule 更新审批规则
func (c *Client) UpdateApprovalRule(id int64, minRole string, enabled bool) error {
	_, err := c.db.Exec(`
		UPDATE approval_rules SET min_role = $1, enabled = $2 WHERE id = $3
	`, minRole, enabled, id)
	return err
}

// CreateApprovalRule 创建审批规则
func (c *Client) CreateApprovalRule(action, resource, namespace, minRole string, enabled bool) error {
	_, err := c.db.Exec(`
		INSERT INTO approval_rules (action, resource, namespace, min_role, enabled)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (action, resource, namespace) DO UPDATE
		SET min_role = $4, enabled = $5
	`, action, resource, namespace, minRole, enabled)
	return err
}

// DeleteApprovalRule 删除审批规则
func (c *Client) DeleteApprovalRule(id int64) error {
	_, err := c.db.Exec("DELETE FROM approval_rules WHERE id = $1", id)
	return err
}
