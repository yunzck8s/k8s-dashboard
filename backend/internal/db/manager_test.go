package db

import (
	"path/filepath"
	"testing"
)

func TestOpenNoPostgresUsesSQLite(t *testing.T) {
	cfg := Config{
		SQLitePath:          filepath.Join(t.TempDir(), "dashboard.db"),
		AllowSQLiteFallback: true,
	}

	conn, dialect, err := Open(cfg)
	if err != nil {
		t.Fatalf("Open() returned error: %v", err)
	}
	defer conn.Close()

	if dialect != DialectSQLite {
		t.Fatalf("expected dialect %q, got %q", DialectSQLite, dialect)
	}
}

func TestOpenPostgresFailureFallsBackToSQLite(t *testing.T) {
	cfg := Config{
		PostgresDSN:         "postgres://invalid:invalid@127.0.0.1:1/invalid?sslmode=disable&connect_timeout=1",
		SQLitePath:          filepath.Join(t.TempDir(), "fallback.db"),
		AllowSQLiteFallback: true,
	}

	conn, dialect, err := Open(cfg)
	if err != nil {
		t.Fatalf("Open() returned error: %v", err)
	}
	defer conn.Close()

	if dialect != DialectSQLite {
		t.Fatalf("expected dialect %q, got %q", DialectSQLite, dialect)
	}
}

func TestOpenPostgresFailureWithoutFallbackReturnsError(t *testing.T) {
	cfg := Config{
		PostgresDSN:         "postgres://invalid:invalid@127.0.0.1:1/invalid?sslmode=disable&connect_timeout=1",
		SQLitePath:          filepath.Join(t.TempDir(), "nofallback.db"),
		AllowSQLiteFallback: false,
	}

	conn, dialect, err := Open(cfg)
	if err == nil {
		if conn != nil {
			conn.Close()
		}
		t.Fatalf("expected error, got dialect %q", dialect)
	}
}

func TestOpenWithHostOnlyFallsBackToSQLite(t *testing.T) {
	cfg := Config{
		PostgresHost:        "127.0.0.1",
		PostgresPort:        1,
		PostgresUser:        "postgres",
		PostgresDB:          "dashboard",
		SQLitePath:          filepath.Join(t.TempDir(), "host-fallback.db"),
		AllowSQLiteFallback: true,
	}

	conn, dialect, err := Open(cfg)
	if err != nil {
		t.Fatalf("Open() returned error: %v", err)
	}
	defer conn.Close()

	if dialect != DialectSQLite {
		t.Fatalf("expected dialect %q, got %q", DialectSQLite, dialect)
	}
}
