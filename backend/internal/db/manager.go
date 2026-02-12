package db

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	_ "github.com/lib/pq"
	_ "modernc.org/sqlite"
)

// Dialect 表示数据库类型
type Dialect string

const (
	DialectPostgres Dialect = "postgres"
	DialectSQLite   Dialect = "sqlite"
)

// Config 数据库配置
type Config struct {
	PostgresDSN     string
	PostgresHost    string
	PostgresPort    int
	PostgresUser    string
	PostgresPass    string
	PostgresDB      string
	PostgresSSLMode string

	SQLitePath          string
	AllowSQLiteFallback bool
}

// LoadConfigFromEnv 从环境变量加载配置
func LoadConfigFromEnv() Config {
	port := 5432
	if portStr := strings.TrimSpace(os.Getenv("POSTGRES_PORT")); portStr != "" {
		if p, err := strconv.Atoi(portStr); err == nil && p > 0 {
			port = p
		}
	}

	return Config{
		PostgresDSN:         strings.TrimSpace(os.Getenv("POSTGRES_DSN")),
		PostgresHost:        strings.TrimSpace(os.Getenv("POSTGRES_HOST")),
		PostgresPort:        port,
		PostgresUser:        strings.TrimSpace(os.Getenv("POSTGRES_USER")),
		PostgresPass:        strings.TrimSpace(os.Getenv("POSTGRES_PASSWORD")),
		PostgresDB:          strings.TrimSpace(os.Getenv("POSTGRES_DB")),
		PostgresSSLMode:     defaultString(strings.TrimSpace(os.Getenv("POSTGRES_SSLMODE")), "disable"),
		SQLitePath:          defaultString(strings.TrimSpace(os.Getenv("SQLITE_PATH")), "./data/k8s-dashboard.db"),
		AllowSQLiteFallback: parseBoolEnv("ALLOW_SQLITE_FALLBACK", true),
	}
}

// OpenFromEnv 根据环境变量打开数据库连接并返回最终方言
func OpenFromEnv() (*sql.DB, Dialect, error) {
	return Open(LoadConfigFromEnv())
}

// Open 按优先级选择数据库:
// 1) POSTGRES_DSN
// 2) POSTGRES_HOST + 其他参数
// 3) SQLite
func Open(cfg Config) (*sql.DB, Dialect, error) {
	tryPostgres := cfg.PostgresDSN != "" || cfg.PostgresHost != ""

	if tryPostgres {
		pg, err := openPostgres(cfg)
		if err == nil {
			log.Printf("Database backend selected: %s", DialectPostgres)
			return pg, DialectPostgres, nil
		}

		if !cfg.AllowSQLiteFallback {
			return nil, "", fmt.Errorf("postgres connection failed and sqlite fallback disabled: %w", err)
		}
		log.Printf("Warning: PostgreSQL connection failed, falling back to SQLite: %v", err)
	} else {
		log.Printf("PostgreSQL config not provided, using SQLite")
	}

	sqliteDB, err := openSQLite(cfg.SQLitePath)
	if err != nil {
		return nil, "", err
	}
	log.Printf("Database backend selected: %s", DialectSQLite)
	return sqliteDB, DialectSQLite, nil
}

func openPostgres(cfg Config) (*sql.DB, error) {
	var dsn string
	if cfg.PostgresDSN != "" {
		dsn = cfg.PostgresDSN
	} else {
		if cfg.PostgresHost == "" || cfg.PostgresUser == "" || cfg.PostgresDB == "" {
			return nil, fmt.Errorf("incomplete postgres config: host/user/db are required")
		}
		dsn = fmt.Sprintf(
			"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s connect_timeout=3",
			cfg.PostgresHost,
			cfg.PostgresPort,
			cfg.PostgresUser,
			cfg.PostgresPass,
			cfg.PostgresDB,
			cfg.PostgresSSLMode,
		)
	}

	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, fmt.Errorf("open postgres failed: %w", err)
	}

	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)

	if err := db.Ping(); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("ping postgres failed: %w", err)
	}
	return db, nil
}

func openSQLite(path string) (*sql.DB, error) {
	if path == "" {
		path = "./data/k8s-dashboard.db"
	}
	if path != ":memory:" {
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			return nil, fmt.Errorf("create sqlite directory failed: %w", err)
		}
	}

	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, fmt.Errorf("open sqlite failed: %w", err)
	}

	// SQLite 以单写者模型为主，限制连接数可降低锁冲突概率。
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)
	db.SetConnMaxLifetime(0)

	if _, err := db.Exec("PRAGMA foreign_keys = ON;"); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("enable sqlite foreign_keys failed: %w", err)
	}
	if _, err := db.Exec("PRAGMA busy_timeout = 5000;"); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("set sqlite busy_timeout failed: %w", err)
	}
	if _, err := db.Exec("PRAGMA journal_mode = WAL;"); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("set sqlite wal mode failed: %w", err)
	}
	if err := db.Ping(); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("ping sqlite failed: %w", err)
	}
	return db, nil
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

func defaultString(v, def string) string {
	if v == "" {
		return def
	}
	return v
}
