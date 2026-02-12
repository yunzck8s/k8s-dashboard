package clusters

import (
	"testing"

	dbutil "github.com/k8s-dashboard/backend/internal/db"
)

func newTestRepository(t *testing.T) *Repository {
	t.Helper()

	database, dialect, err := dbutil.Open(dbutil.Config{
		SQLitePath:          ":memory:",
		AllowSQLiteFallback: true,
	})
	if err != nil {
		t.Fatalf("open test db failed: %v", err)
	}
	t.Cleanup(func() {
		_ = database.Close()
	})
	if dialect != dbutil.DialectSQLite {
		t.Fatalf("expected sqlite dialect, got %s", dialect)
	}

	repo, err := NewRepository(database, dialect)
	if err != nil {
		t.Fatalf("new repository failed: %v", err)
	}
	return repo
}

func TestRepositoryCreateListAndDefaultRules(t *testing.T) {
	repo := newTestRepository(t)

	if err := repo.Create(Record{
		Name:      DefaultClusterName,
		Source:    ClusterSourceInCluster,
		IsDefault: true,
		Enabled:   true,
	}); err != nil {
		t.Fatalf("create default cluster failed: %v", err)
	}

	if err := repo.Create(Record{
		Name:                "dev-cluster",
		Source:              ClusterSourceKubeconfig,
		KubeconfigEncrypted: "encrypted-content",
		Enabled:             true,
	}); err != nil {
		t.Fatalf("create second cluster failed: %v", err)
	}

	count, err := repo.Count()
	if err != nil {
		t.Fatalf("count failed: %v", err)
	}
	if count != 2 {
		t.Fatalf("expected 2 clusters, got %d", count)
	}

	items, err := repo.List()
	if err != nil {
		t.Fatalf("list failed: %v", err)
	}
	if len(items) != 2 {
		t.Fatalf("expected 2 records, got %d", len(items))
	}
	if items[0].Name != DefaultClusterName {
		t.Fatalf("expected default cluster first, got %q", items[0].Name)
	}

	if err := repo.ValidateDelete(DefaultClusterName); err == nil {
		t.Fatalf("expected default cluster delete validation to fail")
	}
	if err := repo.ValidateDelete("dev-cluster"); err != nil {
		t.Fatalf("expected non-default delete validation to pass, got %v", err)
	}

	if err := repo.Delete("dev-cluster"); err != nil {
		t.Fatalf("delete non-default cluster failed: %v", err)
	}
}
