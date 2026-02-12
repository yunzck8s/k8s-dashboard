package clusters

import (
	"encoding/base64"
	"testing"

	dbutil "github.com/k8s-dashboard/backend/internal/db"
)

func newTestManager(t *testing.T) *Manager {
	t.Helper()

	key := make([]byte, 32)
	for i := range key {
		key[i] = byte(i + 1)
	}
	t.Setenv(encryptionKeyEnv, base64.StdEncoding.EncodeToString(key))

	database, dialect, err := dbutil.Open(dbutil.Config{
		SQLitePath:          ":memory:",
		AllowSQLiteFallback: true,
	})
	if err != nil {
		t.Fatalf("open db failed: %v", err)
	}
	t.Cleanup(func() {
		_ = database.Close()
	})

	mgr, err := NewManager(database, dialect, "jwt-secret", nil)
	if err != nil {
		t.Fatalf("new manager failed: %v", err)
	}
	return mgr
}

func TestManagerResolveClusterNameFallback(t *testing.T) {
	mgr := newTestManager(t)

	name, err := mgr.ResolveClusterName("")
	if err != nil {
		t.Fatalf("resolve default failed: %v", err)
	}
	if name != DefaultClusterName {
		t.Fatalf("expected default cluster %q, got %q", DefaultClusterName, name)
	}
}

func TestManagerResolveMissingCluster(t *testing.T) {
	mgr := newTestManager(t)

	if _, err := mgr.ResolveClusterName("missing-cluster"); err == nil {
		t.Fatalf("expected missing cluster to return error")
	}
}
