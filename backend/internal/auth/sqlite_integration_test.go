package auth

import (
	"path/filepath"
	"testing"

	dbutil "github.com/k8s-dashboard/backend/internal/db"
)

func TestSQLiteUserLifecycle(t *testing.T) {
	conn, dialect, err := dbutil.Open(dbutil.Config{
		SQLitePath:          filepath.Join(t.TempDir(), "auth.db"),
		AllowSQLiteFallback: true,
	})
	if err != nil {
		t.Fatalf("open sqlite failed: %v", err)
	}
	defer conn.Close()

	client, err := NewClient(conn, dialect, "test-secret")
	if err != nil {
		t.Fatalf("NewClient failed: %v", err)
	}

	created, err := client.CreateUser(&CreateUserRequest{
		Username:      "alice",
		Password:      "Passw0rd!",
		DisplayName:   "Alice",
		Email:         "alice@example.com",
		Role:          "operator",
		AllNamespaces: false,
		Namespaces:    []string{"default"},
	})
	if err != nil {
		t.Fatalf("CreateUser failed: %v", err)
	}

	if created.ID <= 0 {
		t.Fatalf("expected valid user id, got %d", created.ID)
	}

	users, err := client.ListUsers(ListUsersParams{
		Page:     1,
		PageSize: 20,
		Search:   "ALI",
	})
	if err != nil {
		t.Fatalf("ListUsers failed: %v", err)
	}

	found := false
	for _, u := range users.Items {
		if u.Username == "alice" {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("expected user alice in search result")
	}

	user, token, err := client.Login("alice", "Passw0rd!", "127.0.0.1", "test-agent")
	if err != nil {
		t.Fatalf("Login failed: %v", err)
	}
	if token == "" {
		t.Fatalf("expected token not empty")
	}

	sessions, err := client.GetUserSessions(user.ID)
	if err != nil {
		t.Fatalf("GetUserSessions failed: %v", err)
	}
	if len(sessions) == 0 {
		t.Fatalf("expected at least one session")
	}
}
