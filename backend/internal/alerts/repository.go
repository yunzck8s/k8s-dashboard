package alerts

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	dbutil "github.com/k8s-dashboard/backend/internal/db"
)

// Acknowledgement 告警确认记录
type Acknowledgement struct {
	ID               int64      `json:"id"`
	AlertFingerprint string     `json:"alertFingerprint"`
	AcknowledgedBy   string     `json:"acknowledgedBy"`
	AcknowledgedAt   time.Time  `json:"acknowledgedAt"`
	Comment          string     `json:"comment"`
	ExpiresAt        *time.Time `json:"expiresAt,omitempty"`
}

// Silence 静默规则
type Silence struct {
	ID        int64                    `json:"id"`
	SilenceID string                   `json:"silenceId"` // Alertmanager ID
	Matchers  []map[string]interface{} `json:"matchers"`
	StartsAt  time.Time                `json:"startsAt"`
	EndsAt    time.Time                `json:"endsAt"`
	CreatedBy string                   `json:"createdBy"`
	Comment   string                   `json:"comment"`
	State     string                   `json:"state"` // active, expired, pending
	CreatedAt time.Time                `json:"createdAt"`
}

// Repository 告警数据仓库
type Repository struct {
	db      *sql.DB
	dialect dbutil.Dialect
}

// NewRepository 创建告警数据仓库
func NewRepository(db *sql.DB, dialect dbutil.Dialect) (*Repository, error) {
	repo := &Repository{
		db:      db,
		dialect: dialect,
	}

	// 初始化表结构
	if err := repo.initSchema(); err != nil {
		return nil, fmt.Errorf("初始化表结构失败: %w", err)
	}

	return repo, nil
}

// initSchema 初始化表结构
func (r *Repository) initSchema() error {
	var schema string
	if r.dialect == dbutil.DialectSQLite {
		schema = `
		-- 告警确认表
		CREATE TABLE IF NOT EXISTS alert_acknowledgements (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			alert_fingerprint TEXT NOT NULL,
			acknowledged_by TEXT NOT NULL,
			acknowledged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			comment TEXT,
			expires_at DATETIME
		);

		CREATE INDEX IF NOT EXISTS idx_alert_ack_fingerprint ON alert_acknowledgements(alert_fingerprint);
		CREATE INDEX IF NOT EXISTS idx_alert_ack_expires ON alert_acknowledgements(expires_at);

		-- 静默规则表
		CREATE TABLE IF NOT EXISTS alert_silences (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			silence_id TEXT UNIQUE,
			matchers TEXT NOT NULL,
			starts_at DATETIME NOT NULL,
			ends_at DATETIME NOT NULL,
			created_by TEXT NOT NULL,
			comment TEXT NOT NULL,
			state TEXT DEFAULT 'active',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);

		CREATE INDEX IF NOT EXISTS idx_alert_silence_state ON alert_silences(state);
		CREATE INDEX IF NOT EXISTS idx_alert_silence_ends ON alert_silences(ends_at);
		`
	} else {
		schema = `
		-- 告警确认表
		CREATE TABLE IF NOT EXISTS alert_acknowledgements (
			id BIGSERIAL PRIMARY KEY,
			alert_fingerprint VARCHAR(64) NOT NULL,
			acknowledged_by VARCHAR(255) NOT NULL,
			acknowledged_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
			comment TEXT,
			expires_at TIMESTAMP WITH TIME ZONE
		);

		CREATE INDEX IF NOT EXISTS idx_alert_ack_fingerprint ON alert_acknowledgements(alert_fingerprint);
		CREATE INDEX IF NOT EXISTS idx_alert_ack_expires ON alert_acknowledgements(expires_at);

		-- 静默规则表
		CREATE TABLE IF NOT EXISTS alert_silences (
			id BIGSERIAL PRIMARY KEY,
			silence_id VARCHAR(64) UNIQUE,
			matchers JSONB NOT NULL,
			starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
			ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
			created_by VARCHAR(255) NOT NULL,
			comment TEXT NOT NULL,
			state VARCHAR(20) DEFAULT 'active',
			created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
		);

		CREATE INDEX IF NOT EXISTS idx_alert_silence_state ON alert_silences(state);
		CREATE INDEX IF NOT EXISTS idx_alert_silence_ends ON alert_silences(ends_at);
		`
	}

	_, err := r.db.Exec(schema)
	return err
}

// ========== 确认告警 ==========

// AcknowledgeAlert 确认告警
func (r *Repository) AcknowledgeAlert(ack *Acknowledgement) error {
	query := `
		INSERT INTO alert_acknowledgements (
			alert_fingerprint, acknowledged_by, acknowledged_at, comment, expires_at
		) VALUES ($1, $2, $3, $4, $5)
	`

	_, err := r.db.Exec(query,
		ack.AlertFingerprint,
		ack.AcknowledgedBy,
		ack.AcknowledgedAt,
		ack.Comment,
		ack.ExpiresAt,
	)

	return err
}

// UnacknowledgeAlert 取消确认告警
func (r *Repository) UnacknowledgeAlert(fingerprint string) error {
	query := `DELETE FROM alert_acknowledgements WHERE alert_fingerprint = $1`
	_, err := r.db.Exec(query, fingerprint)
	return err
}

// GetAcknowledgement 获取告警确认记录
func (r *Repository) GetAcknowledgement(fingerprint string) (*Acknowledgement, error) {
	nowExpr := "NOW()"
	if r.dialect == dbutil.DialectSQLite {
		nowExpr = "CURRENT_TIMESTAMP"
	}
	query := fmt.Sprintf(`
		SELECT id, alert_fingerprint, acknowledged_by, acknowledged_at, comment, expires_at
		FROM alert_acknowledgements
		WHERE alert_fingerprint = $1
		AND (expires_at IS NULL OR expires_at > %s)
		ORDER BY acknowledged_at DESC
		LIMIT 1
	`, nowExpr)

	ack := &Acknowledgement{}
	err := r.db.QueryRow(query, fingerprint).Scan(
		&ack.ID,
		&ack.AlertFingerprint,
		&ack.AcknowledgedBy,
		&ack.AcknowledgedAt,
		&ack.Comment,
		&ack.ExpiresAt,
	)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	return ack, nil
}

// ========== 静默规则 ==========

// CreateSilence 创建静默规则
func (r *Repository) CreateSilence(silence *Silence) error {
	matchersJSON, err := json.Marshal(silence.Matchers)
	if err != nil {
		return fmt.Errorf("序列化 matchers 失败: %w", err)
	}

	if r.dialect == dbutil.DialectSQLite {
		query := `
			INSERT INTO alert_silences (
				silence_id, matchers, starts_at, ends_at, created_by, comment, state
			) VALUES ($1, $2, $3, $4, $5, $6, $7)
		`
		result, err := r.db.Exec(query,
			silence.SilenceID,
			matchersJSON,
			silence.StartsAt,
			silence.EndsAt,
			silence.CreatedBy,
			silence.Comment,
			silence.State,
		)
		if err != nil {
			return err
		}
		id, err := result.LastInsertId()
		if err != nil {
			return err
		}
		silence.ID = id
		return r.db.QueryRow(`
			SELECT created_at
			FROM alert_silences
			WHERE id = $1
		`, silence.ID).Scan(&silence.CreatedAt)
	}

	query := `
		INSERT INTO alert_silences (
			silence_id, matchers, starts_at, ends_at, created_by, comment, state
		) VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, created_at
	`

	return r.db.QueryRow(query,
		silence.SilenceID,
		matchersJSON,
		silence.StartsAt,
		silence.EndsAt,
		silence.CreatedBy,
		silence.Comment,
		silence.State,
	).Scan(&silence.ID, &silence.CreatedAt)
}

// UpdateSilence 更新静默规则
func (r *Repository) UpdateSilence(silence *Silence) error {
	matchersJSON, err := json.Marshal(silence.Matchers)
	if err != nil {
		return fmt.Errorf("序列化 matchers 失败: %w", err)
	}

	query := `
		UPDATE alert_silences
		SET matchers = $1, starts_at = $2, ends_at = $3, comment = $4, state = $5
		WHERE id = $6
	`

	_, err = r.db.Exec(query,
		matchersJSON,
		silence.StartsAt,
		silence.EndsAt,
		silence.Comment,
		silence.State,
		silence.ID,
	)

	return err
}

// DeleteSilence 删除静默规则
func (r *Repository) DeleteSilence(id int64) error {
	query := `DELETE FROM alert_silences WHERE id = $1`
	_, err := r.db.Exec(query, id)
	return err
}

// GetSilence 获取单个静默规则
func (r *Repository) GetSilence(id int64) (*Silence, error) {
	query := `
		SELECT id, silence_id, matchers, starts_at, ends_at, created_by, comment, state, created_at
		FROM alert_silences
		WHERE id = $1
	`

	silence := &Silence{}
	var matchersJSON []byte

	err := r.db.QueryRow(query, id).Scan(
		&silence.ID,
		&silence.SilenceID,
		&matchersJSON,
		&silence.StartsAt,
		&silence.EndsAt,
		&silence.CreatedBy,
		&silence.Comment,
		&silence.State,
		&silence.CreatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	// 反序列化 matchers
	if err := json.Unmarshal(matchersJSON, &silence.Matchers); err != nil {
		return nil, fmt.Errorf("反序列化 matchers 失败: %w", err)
	}

	return silence, nil
}

// ListSilences 列出静默规则
func (r *Repository) ListSilences(state string) ([]*Silence, error) {
	query := `
		SELECT id, silence_id, matchers, starts_at, ends_at, created_by, comment, state, created_at
		FROM alert_silences
	`

	args := []interface{}{}
	if state != "" {
		query += ` WHERE state = $1`
		args = append(args, state)
	}

	query += ` ORDER BY created_at DESC`

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	silences := []*Silence{}
	for rows.Next() {
		silence := &Silence{}
		var matchersJSON []byte

		err := rows.Scan(
			&silence.ID,
			&silence.SilenceID,
			&matchersJSON,
			&silence.StartsAt,
			&silence.EndsAt,
			&silence.CreatedBy,
			&silence.Comment,
			&silence.State,
			&silence.CreatedAt,
		)
		if err != nil {
			return nil, err
		}

		// 反序列化 matchers
		if err := json.Unmarshal(matchersJSON, &silence.Matchers); err != nil {
			return nil, fmt.Errorf("反序列化 matchers 失败: %w", err)
		}

		silences = append(silences, silence)
	}

	return silences, rows.Err()
}

// UpdateSilenceState 更新静默规则状态
func (r *Repository) UpdateSilenceState(id int64, state string) error {
	query := `UPDATE alert_silences SET state = $1 WHERE id = $2`
	_, err := r.db.Exec(query, state, id)
	return err
}

// Close 关闭数据库连接
func (r *Repository) Close() error {
	// 连接由上层统一管理，仓库不主动关闭。
	return nil
}
