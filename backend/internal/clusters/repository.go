package clusters

import (
	"database/sql"
	"fmt"
	"time"

	dbutil "github.com/k8s-dashboard/backend/internal/db"
)

const (
	ClusterSourceKubeconfig = "kubeconfig"
	ClusterSourceInCluster  = "incluster"
	DefaultClusterName      = "default"
)

// Record 表示数据库中的集群记录。
type Record struct {
	ID                  int64
	Name                string
	KubeconfigEncrypted string
	Source              string
	IsDefault           bool
	Enabled             bool
	LastCheckedAt       *time.Time
	LastError           string
	CreatedAt           time.Time
	UpdatedAt           time.Time
}

// Repository 负责集群记录持久化。
type Repository struct {
	db      *sql.DB
	dialect dbutil.Dialect
}

func NewRepository(db *sql.DB, dialect dbutil.Dialect) (*Repository, error) {
	r := &Repository{db: db, dialect: dialect}
	if err := r.ensureSchema(); err != nil {
		return nil, err
	}
	return r, nil
}

func (r *Repository) ensureSchema() error {
	var schema string
	if r.dialect == dbutil.DialectSQLite {
		schema = `
		CREATE TABLE IF NOT EXISTS clusters (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL UNIQUE,
			kubeconfig_encrypted TEXT,
			source TEXT NOT NULL DEFAULT 'kubeconfig',
			is_default INTEGER NOT NULL DEFAULT 0,
			enabled INTEGER NOT NULL DEFAULT 1,
			last_checked_at DATETIME,
			last_error TEXT,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		);
		CREATE INDEX IF NOT EXISTS idx_clusters_name ON clusters(name);
		CREATE INDEX IF NOT EXISTS idx_clusters_is_default ON clusters(is_default);
		`
	} else {
		schema = `
		CREATE TABLE IF NOT EXISTS clusters (
			id BIGSERIAL PRIMARY KEY,
			name VARCHAR(128) NOT NULL UNIQUE,
			kubeconfig_encrypted TEXT,
			source VARCHAR(32) NOT NULL DEFAULT 'kubeconfig',
			is_default BOOLEAN NOT NULL DEFAULT FALSE,
			enabled BOOLEAN NOT NULL DEFAULT TRUE,
			last_checked_at TIMESTAMP WITH TIME ZONE,
			last_error TEXT,
			created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
		);
		CREATE INDEX IF NOT EXISTS idx_clusters_name ON clusters(name);
		CREATE INDEX IF NOT EXISTS idx_clusters_is_default ON clusters(is_default);
		`
	}
	_, err := r.db.Exec(schema)
	return err
}

func (r *Repository) Count() (int64, error) {
	var n int64
	err := r.db.QueryRow("SELECT COUNT(*) FROM clusters").Scan(&n)
	return n, err
}

func (r *Repository) Create(rec Record) error {
	if rec.Source == "" {
		rec.Source = ClusterSourceKubeconfig
	}
	query := `
		INSERT INTO clusters (
			name, kubeconfig_encrypted, source, is_default, enabled, last_checked_at, last_error, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
	`
	_, err := r.db.Exec(
		query,
		rec.Name,
		rec.KubeconfigEncrypted,
		rec.Source,
		rec.IsDefault,
		rec.Enabled,
		rec.LastCheckedAt,
		rec.LastError,
	)
	return err
}

func (r *Repository) List() ([]Record, error) {
	rows, err := r.db.Query(`
		SELECT id, name, kubeconfig_encrypted, source, is_default, enabled, last_checked_at, last_error, created_at, updated_at
		FROM clusters
		ORDER BY is_default DESC, name ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []Record
	for rows.Next() {
		var rec Record
		if err := rows.Scan(
			&rec.ID,
			&rec.Name,
			&rec.KubeconfigEncrypted,
			&rec.Source,
			&rec.IsDefault,
			&rec.Enabled,
			&rec.LastCheckedAt,
			&rec.LastError,
			&rec.CreatedAt,
			&rec.UpdatedAt,
		); err != nil {
			return nil, err
		}
		records = append(records, rec)
	}
	return records, rows.Err()
}

func (r *Repository) Get(name string) (*Record, error) {
	var rec Record
	err := r.db.QueryRow(`
		SELECT id, name, kubeconfig_encrypted, source, is_default, enabled, last_checked_at, last_error, created_at, updated_at
		FROM clusters
		WHERE name = $1
	`, name).Scan(
		&rec.ID,
		&rec.Name,
		&rec.KubeconfigEncrypted,
		&rec.Source,
		&rec.IsDefault,
		&rec.Enabled,
		&rec.LastCheckedAt,
		&rec.LastError,
		&rec.CreatedAt,
		&rec.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &rec, nil
}

func (r *Repository) GetDefault() (*Record, error) {
	var rec Record
	err := r.db.QueryRow(`
		SELECT id, name, kubeconfig_encrypted, source, is_default, enabled, last_checked_at, last_error, created_at, updated_at
		FROM clusters
		WHERE is_default = $1
		ORDER BY id ASC
		LIMIT 1
	`, true).Scan(
		&rec.ID,
		&rec.Name,
		&rec.KubeconfigEncrypted,
		&rec.Source,
		&rec.IsDefault,
		&rec.Enabled,
		&rec.LastCheckedAt,
		&rec.LastError,
		&rec.CreatedAt,
		&rec.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &rec, nil
}

func (r *Repository) EnsureDefault(name string) error {
	if name == "" {
		name = DefaultClusterName
	}
	_, err := r.db.Exec(`
		UPDATE clusters
		SET is_default = CASE WHEN name = $1 THEN TRUE ELSE FALSE END,
		    updated_at = CURRENT_TIMESTAMP
	`, name)
	return err
}

func (r *Repository) Delete(name string) error {
	result, err := r.db.Exec(`DELETE FROM clusters WHERE name = $1`, name)
	if err != nil {
		return err
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (r *Repository) UpdateHealth(name string, checkedAt time.Time, lastError string) error {
	_, err := r.db.Exec(`
		UPDATE clusters
		SET last_checked_at = $2,
		    last_error = $3,
		    updated_at = CURRENT_TIMESTAMP
		WHERE name = $1
	`, name, checkedAt, lastError)
	return err
}

func (r *Repository) ValidateDelete(name string) error {
	rec, err := r.Get(name)
	if err != nil {
		return err
	}
	if rec.IsDefault || rec.Name == DefaultClusterName {
		return fmt.Errorf("default cluster cannot be deleted")
	}
	return nil
}
