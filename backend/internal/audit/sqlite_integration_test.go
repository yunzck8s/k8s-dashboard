package audit

import (
	"path/filepath"
	"testing"
	"time"

	dbutil "github.com/k8s-dashboard/backend/internal/db"
)

func TestSQLiteAuditLifecycle(t *testing.T) {
	conn, dialect, err := dbutil.Open(dbutil.Config{
		SQLitePath:          filepath.Join(t.TempDir(), "audit.db"),
		AllowSQLiteFallback: true,
	})
	if err != nil {
		t.Fatalf("open sqlite failed: %v", err)
	}
	defer conn.Close()

	client, err := NewClient(conn, dialect)
	if err != nil {
		t.Fatalf("NewClient failed: %v", err)
	}

	entry := &AuditLog{
		Timestamp:    time.Now(),
		User:         "alice",
		Action:       "GET",
		Resource:     "pods",
		ResourceName: "nginx-abc",
		Namespace:    "default",
		Cluster:      "test-cluster",
		StatusCode:   200,
		ClientIP:     "127.0.0.1",
		UserAgent:    "test-agent",
		RequestBody:  "",
		Duration:     12,
		Message:      "ok",
	}

	if err := client.Log(entry); err != nil {
		t.Fatalf("Log failed: %v", err)
	}

	result, err := client.List(ListParams{
		Page:     1,
		PageSize: 20,
		User:     "alice",
	})
	if err != nil {
		t.Fatalf("List failed: %v", err)
	}
	if result.Total < 1 || len(result.Items) < 1 {
		t.Fatalf("expected at least one audit log, total=%d items=%d", result.Total, len(result.Items))
	}

	stats, err := client.GetStats(time.Hour)
	if err != nil {
		t.Fatalf("GetStats failed: %v", err)
	}

	total, ok := stats["total"].(int64)
	if !ok {
		t.Fatalf("expected stats total type int64, got %T", stats["total"])
	}
	if total < 1 {
		t.Fatalf("expected stats total >= 1, got %d", total)
	}
}
