package usage

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func writeFixture(t *testing.T, v any) string {
	t.Helper()
	data, err := json.Marshal(v)
	if err != nil {
		t.Fatalf("marshal fixture: %v", err)
	}
	path := filepath.Join(t.TempDir(), "stats-cache.json")
	if err := os.WriteFile(path, data, 0o600); err != nil {
		t.Fatalf("write fixture: %v", err)
	}
	return path
}

func TestReadStatsCacheFrom_Valid(t *testing.T) {
	fixture := StatsCache{
		Version:          2,
		LastComputedDate: "2026-03-06",
		TotalSessions:    42,
		TotalMessages:    1284,
		DailyActivity: []DailyActivity{
			{Date: "2026-03-05", MessageCount: 80, SessionCount: 3, ToolCallCount: 25},
		},
		ModelUsage: map[string]ModelUsage{
			"claude-sonnet-4-6": {
				InputTokens:              607362,
				OutputTokens:             2272497,
				CacheReadInputTokens:     875053258,
				CacheCreationInputTokens: 83393179,
				WebSearchRequests:        12,
			},
		},
		LongestSession: LongestSession{
			SessionID:    "abc-123",
			Duration:     7200000,
			MessageCount: 98,
			Timestamp:    "2026-02-20T14:30:00.000Z",
		},
		HourCounts: map[string]int{"9": 12, "14": 22},
	}

	path := writeFixture(t, fixture)
	got, err := readStatsCacheFrom(path)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if got.Version != fixture.Version {
		t.Errorf("Version: got %d, want %d", got.Version, fixture.Version)
	}
	if got.TotalSessions != fixture.TotalSessions {
		t.Errorf("TotalSessions: got %d, want %d", got.TotalSessions, fixture.TotalSessions)
	}
	if got.TotalMessages != fixture.TotalMessages {
		t.Errorf("TotalMessages: got %d, want %d", got.TotalMessages, fixture.TotalMessages)
	}
	if len(got.DailyActivity) != 1 {
		t.Fatalf("DailyActivity: got %d entries, want 1", len(got.DailyActivity))
	}
	if got.DailyActivity[0].MessageCount != 80 {
		t.Errorf("DailyActivity[0].MessageCount: got %d, want 80", got.DailyActivity[0].MessageCount)
	}

	m, ok := got.ModelUsage["claude-sonnet-4-6"]
	if !ok {
		t.Fatal("ModelUsage: missing key 'claude-sonnet-4-6'")
	}
	if m.InputTokens != fixture.ModelUsage["claude-sonnet-4-6"].InputTokens {
		t.Errorf("InputTokens: got %d, want %d", m.InputTokens, fixture.ModelUsage["claude-sonnet-4-6"].InputTokens)
	}
	if m.WebSearchRequests != 12 {
		t.Errorf("WebSearchRequests: got %d, want 12", m.WebSearchRequests)
	}

	if got.LongestSession.SessionID != "abc-123" {
		t.Errorf("LongestSession.SessionID: got %q, want %q", got.LongestSession.SessionID, "abc-123")
	}
	if got.HourCounts["14"] != 22 {
		t.Errorf("HourCounts[14]: got %d, want 22", got.HourCounts["14"])
	}
}

func TestReadStatsCacheFrom_FileNotFound(t *testing.T) {
	_, err := readStatsCacheFrom(filepath.Join(t.TempDir(), "nonexistent.json"))
	if err == nil {
		t.Fatal("expected error for missing file, got nil")
	}
	if !os.IsNotExist(err) {
		t.Errorf("expected IsNotExist error, got: %v", err)
	}
}

func TestReadStatsCacheFrom_InvalidJSON(t *testing.T) {
	path := filepath.Join(t.TempDir(), "stats-cache.json")
	if err := os.WriteFile(path, []byte(`{not valid json`), 0o600); err != nil {
		t.Fatalf("write fixture: %v", err)
	}

	_, err := readStatsCacheFrom(path)
	if err == nil {
		t.Fatal("expected error for invalid JSON, got nil")
	}
}

func TestReadStatsCacheFrom_EmptyModelUsage(t *testing.T) {
	fixture := StatsCache{
		Version:       2,
		TotalSessions: 0,
		TotalMessages: 0,
		ModelUsage:    map[string]ModelUsage{},
	}

	path := writeFixture(t, fixture)
	got, err := readStatsCacheFrom(path)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got.ModelUsage) != 0 {
		t.Errorf("ModelUsage: got %d entries, want 0", len(got.ModelUsage))
	}
}

func TestReadStatsCacheFrom_MultipleModels(t *testing.T) {
	fixture := StatsCache{
		Version: 2,
		ModelUsage: map[string]ModelUsage{
			"claude-sonnet-4-6":        {InputTokens: 100, OutputTokens: 200},
			"claude-haiku-4-5-20251001": {InputTokens: 50, OutputTokens: 80},
		},
	}

	path := writeFixture(t, fixture)
	got, err := readStatsCacheFrom(path)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got.ModelUsage) != 2 {
		t.Errorf("ModelUsage: got %d entries, want 2", len(got.ModelUsage))
	}
}
