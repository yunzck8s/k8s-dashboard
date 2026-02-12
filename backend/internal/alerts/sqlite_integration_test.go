package alerts

import (
	"path/filepath"
	"testing"
	"time"

	dbutil "github.com/k8s-dashboard/backend/internal/db"
)

func TestSQLiteAcknowledgementAndSilenceLifecycle(t *testing.T) {
	conn, dialect, err := dbutil.Open(dbutil.Config{
		SQLitePath:          filepath.Join(t.TempDir(), "alerts.db"),
		AllowSQLiteFallback: true,
	})
	if err != nil {
		t.Fatalf("open sqlite failed: %v", err)
	}
	defer conn.Close()

	repo, err := NewRepository(conn, dialect)
	if err != nil {
		t.Fatalf("NewRepository failed: %v", err)
	}

	ack := &Acknowledgement{
		AlertFingerprint: "fp-1",
		AcknowledgedBy:   "tester",
		AcknowledgedAt:   time.Now(),
		Comment:          "investigating",
	}
	if err := repo.AcknowledgeAlert(ack); err != nil {
		t.Fatalf("AcknowledgeAlert failed: %v", err)
	}

	gotAck, err := repo.GetAcknowledgement("fp-1")
	if err != nil {
		t.Fatalf("GetAcknowledgement failed: %v", err)
	}
	if gotAck == nil {
		t.Fatalf("expected acknowledgement to exist")
	}

	if err := repo.UnacknowledgeAlert("fp-1"); err != nil {
		t.Fatalf("UnacknowledgeAlert failed: %v", err)
	}
	gotAck, err = repo.GetAcknowledgement("fp-1")
	if err != nil {
		t.Fatalf("GetAcknowledgement after delete failed: %v", err)
	}
	if gotAck != nil {
		t.Fatalf("expected acknowledgement to be removed")
	}

	silence := &Silence{
		SilenceID: "sil-1",
		Matchers: []map[string]interface{}{
			{
				"name":    "alertname",
				"value":   "HighCPUUsage",
				"isRegex": false,
				"isEqual": true,
			},
		},
		StartsAt:  time.Now().Add(-time.Minute),
		EndsAt:    time.Now().Add(time.Hour),
		CreatedBy: "tester",
		Comment:   "maintenance",
		State:     "active",
	}

	if err := repo.CreateSilence(silence); err != nil {
		t.Fatalf("CreateSilence failed: %v", err)
	}
	if silence.ID <= 0 {
		t.Fatalf("expected silence id > 0")
	}

	gotSilence, err := repo.GetSilence(silence.ID)
	if err != nil {
		t.Fatalf("GetSilence failed: %v", err)
	}
	if gotSilence == nil {
		t.Fatalf("expected silence to exist")
	}
	if len(gotSilence.Matchers) == 0 {
		t.Fatalf("expected silence matchers not empty")
	}

	list, err := repo.ListSilences("active")
	if err != nil {
		t.Fatalf("ListSilences failed: %v", err)
	}
	if len(list) == 0 {
		t.Fatalf("expected at least one active silence")
	}

	if err := repo.DeleteSilence(silence.ID); err != nil {
		t.Fatalf("DeleteSilence failed: %v", err)
	}
}
