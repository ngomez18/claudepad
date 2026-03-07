package sessions

import (
	"os"
	"path/filepath"
	"testing"
)

// writeJSONL writes a .jsonl file into dir and returns its path.
func writeJSONL(t *testing.T, dir, name, content string) string {
	t.Helper()
	path := filepath.Join(dir, name)
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatalf("write jsonl: %v", err)
	}
	return path
}

// ── readSessionsFrom ──────────────────────────────────────────────────────────

func TestReadSessionsFrom_DirNotExist(t *testing.T) {
	got, err := readSessionsFrom(filepath.Join(t.TempDir(), "nonexistent"))
	if err != nil {
		t.Fatalf("expected no error for missing dir, got: %v", err)
	}
	if len(got) != 0 {
		t.Errorf("expected 0 sessions, got %d", len(got))
	}
}

func TestReadSessionsFrom_Empty(t *testing.T) {
	got, err := readSessionsFrom(t.TempDir())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != 0 {
		t.Errorf("expected 0 sessions, got %d", len(got))
	}
}

func TestReadSessionsFrom_SkipsAgentFiles(t *testing.T) {
	root := t.TempDir()
	proj := filepath.Join(root, "-Users-test-project")
	os.Mkdir(proj, 0o700)

	line := `{"type":"user","sessionId":"abc","timestamp":"2024-01-01T00:00:00Z","message":{"role":"user","content":"hello"}}` + "\n"
	writeJSONL(t, proj, "abc.jsonl", line)
	writeJSONL(t, proj, "agent-xyz.jsonl", line) // must be skipped

	got, err := readSessionsFrom(root)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != 1 {
		t.Errorf("expected 1 session (agent file skipped), got %d", len(got))
	}
}

func TestReadSessionsFrom_SkipsSubdirs(t *testing.T) {
	root := t.TempDir()
	proj := filepath.Join(root, "-Users-test-project")
	os.Mkdir(proj, 0o700)

	// A real session file
	line := `{"type":"user","sessionId":"abc","timestamp":"2024-01-01T00:00:00Z","message":{"role":"user","content":"hello"}}` + "\n"
	writeJSONL(t, proj, "abc.jsonl", line)

	// A subagents directory (should not be read as a session)
	subdir := filepath.Join(proj, "abc")
	os.Mkdir(subdir, 0o700)
	writeJSONL(t, subdir, "agent-foo.jsonl", line)

	got, err := readSessionsFrom(root)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != 1 {
		t.Errorf("expected 1 session, got %d", len(got))
	}
}

func TestReadSessionsFrom_SetsProjectPath(t *testing.T) {
	root := t.TempDir()
	proj := filepath.Join(root, "-Users-ngomez-code-myapp")
	os.Mkdir(proj, 0o700)

	line := `{"type":"user","sessionId":"abc","timestamp":"2024-01-01T00:00:00Z","message":{"role":"user","content":"hi"}}` + "\n"
	writeJSONL(t, proj, "abc.jsonl", line)

	got, err := readSessionsFrom(root)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != 1 {
		t.Fatalf("expected 1 session, got %d", len(got))
	}
	if got[0].ProjectPath != "-Users-ngomez-code-myapp" {
		t.Errorf("ProjectPath: got %q, want %q", got[0].ProjectPath, "-Users-ngomez-code-myapp")
	}
}

func TestReadSessionsFrom_SortedNewestFirst(t *testing.T) {
	root := t.TempDir()
	proj := filepath.Join(root, "-Users-test")
	os.Mkdir(proj, 0o700)

	older := `{"type":"user","sessionId":"aaa","timestamp":"2024-01-01T00:00:00Z","message":{"role":"user","content":"older"}}` + "\n"
	newer := `{"type":"user","sessionId":"bbb","timestamp":"2024-06-01T00:00:00Z","message":{"role":"user","content":"newer"}}` + "\n"
	writeJSONL(t, proj, "aaa.jsonl", older)
	writeJSONL(t, proj, "bbb.jsonl", newer)

	got, err := readSessionsFrom(root)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("expected 2 sessions, got %d", len(got))
	}
	if got[0].SessionID != "bbb" {
		t.Errorf("expected newest first, got sessionId=%q", got[0].SessionID)
	}
}

// ── parseSessionFile ──────────────────────────────────────────────────────────

func TestParseSessionFile_BasicMetadata(t *testing.T) {
	dir := t.TempDir()
	content := `{"type":"user","sessionId":"test-id","timestamp":"2024-03-01T10:00:00Z","gitBranch":"main","cwd":"/home/user/proj","slug":"happy-fox","message":{"role":"user","content":"first message"}}
{"type":"assistant","sessionId":"test-id","timestamp":"2024-03-01T10:05:00Z","message":{"role":"assistant","content":[{"type":"text","text":"Sure!"}]}}
`
	path := writeJSONL(t, dir, "test-id.jsonl", content)

	s, err := parseSessionFile(path)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if s.SessionID != "test-id" {
		t.Errorf("SessionID: got %q, want %q", s.SessionID, "test-id")
	}
	if s.GitBranch != "main" {
		t.Errorf("GitBranch: got %q, want %q", s.GitBranch, "main")
	}
	if s.Cwd != "/home/user/proj" {
		t.Errorf("Cwd: got %q, want %q", s.Cwd, "/home/user/proj")
	}
	if s.Slug != "happy-fox" {
		t.Errorf("Slug: got %q, want %q", s.Slug, "happy-fox")
	}
	if s.StartedAt != "2024-03-01T10:00:00Z" {
		t.Errorf("StartedAt: got %q", s.StartedAt)
	}
	if s.DurationSecs != 300 {
		t.Errorf("DurationSecs: got %d, want 300", s.DurationSecs)
	}
}

func TestParseSessionFile_CountsOnlyUserTextTurns(t *testing.T) {
	dir := t.TempDir()
	content := `{"type":"user","sessionId":"s1","timestamp":"2024-01-01T00:00:00Z","message":{"role":"user","content":"real prompt"}}
{"type":"user","sessionId":"s1","timestamp":"2024-01-01T00:00:01Z","message":{"role":"user","content":[{"type":"tool_result","content":"ignored"}]}}
{"type":"user","sessionId":"s1","timestamp":"2024-01-01T00:00:02Z","message":{"role":"user","content":"second real prompt"}}
{"type":"progress","timestamp":"2024-01-01T00:00:03Z"}
`
	path := writeJSONL(t, dir, "s1.jsonl", content)

	s, err := parseSessionFile(path)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if s.MessageCount != 2 {
		t.Errorf("MessageCount: got %d, want 2", s.MessageCount)
	}
}

func TestParseSessionFile_SnippetTruncated(t *testing.T) {
	dir := t.TempDir()
	long := make([]byte, 200)
	for i := range long {
		long[i] = 'a'
	}
	content := `{"type":"user","sessionId":"s1","timestamp":"2024-01-01T00:00:00Z","message":{"role":"user","content":"` + string(long) + `"}}` + "\n"
	path := writeJSONL(t, dir, "s1.jsonl", content)

	s, err := parseSessionFile(path)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// 120 runes + ellipsis character
	runes := []rune(s.Snippet)
	if len(runes) != 121 {
		t.Errorf("Snippet rune length: got %d, want 121 (120 + ellipsis)", len(runes))
	}
}

func TestParseSessionFile_SlugFromLaterLine(t *testing.T) {
	dir := t.TempDir()
	// slug only appears on the second line (common in real files)
	content := `{"type":"user","sessionId":"s1","timestamp":"2024-01-01T00:00:00Z","message":{"role":"user","content":"hi"}}
{"type":"user","sessionId":"s1","timestamp":"2024-01-01T00:01:00Z","slug":"lazy-panda","message":{"role":"user","content":"follow up"}}
`
	path := writeJSONL(t, dir, "s1.jsonl", content)

	s, err := parseSessionFile(path)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if s.Slug != "lazy-panda" {
		t.Errorf("Slug: got %q, want %q", s.Slug, "lazy-panda")
	}
}

func TestParseSessionFile_FallbackSessionIDFromFilename(t *testing.T) {
	dir := t.TempDir()
	// No sessionId in the file
	content := `{"type":"user","timestamp":"2024-01-01T00:00:00Z","message":{"role":"user","content":"hi"}}` + "\n"
	path := writeJSONL(t, dir, "fallback-id.jsonl", content)

	s, err := parseSessionFile(path)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if s.SessionID != "fallback-id" {
		t.Errorf("SessionID: got %q, want %q", s.SessionID, "fallback-id")
	}
}

func TestParseSessionFile_SkipsInvalidLines(t *testing.T) {
	dir := t.TempDir()
	content := `not valid json
{"type":"user","sessionId":"s1","timestamp":"2024-01-01T00:00:00Z","message":{"role":"user","content":"ok"}}
`
	path := writeJSONL(t, dir, "s1.jsonl", content)

	s, err := parseSessionFile(path)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if s.MessageCount != 1 {
		t.Errorf("MessageCount: got %d, want 1", s.MessageCount)
	}
}

// ── ReadTranscript ────────────────────────────────────────────────────────────

func setupProjectDir(t *testing.T, projectPath, sessionID, content string) string {
	t.Helper()
	root := t.TempDir()
	proj := filepath.Join(root, projectPath)
	os.Mkdir(proj, 0o700)
	writeJSONL(t, proj, sessionID+".jsonl", content)
	// Override home to point at root — we call readTranscriptFrom directly via a helper.
	return root
}

// readTranscriptFrom is a test helper that reads from an explicit root dir.
func readTranscriptFrom(root, projectPath, sessionID string) ([]TranscriptMessage, error) {
	path := filepath.Join(root, projectPath, sessionID+".jsonl")
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	// Re-use the same parsing logic by delegating to parseTranscript.
	return parseTranscript(f)
}

func TestReadTranscript_UserAndAssistant(t *testing.T) {
	root := setupProjectDir(t, "-Users-test", "sess1", `{"type":"user","timestamp":"2024-01-01T00:00:00Z","message":{"role":"user","content":"hello"}}
{"type":"assistant","timestamp":"2024-01-01T00:00:01Z","message":{"role":"assistant","content":[{"type":"text","text":"Hi there!"}]}}
`)

	msgs, err := readTranscriptFrom(root, "-Users-test", "sess1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(msgs) != 2 {
		t.Fatalf("expected 2 messages, got %d", len(msgs))
	}
	if msgs[0].Role != "user" || msgs[0].Text != "hello" {
		t.Errorf("msg[0]: got role=%q text=%q", msgs[0].Role, msgs[0].Text)
	}
	if msgs[1].Role != "assistant" || msgs[1].Text != "Hi there!" {
		t.Errorf("msg[1]: got role=%q text=%q", msgs[1].Role, msgs[1].Text)
	}
}

func TestReadTranscript_SkipsToolResultArrays(t *testing.T) {
	root := setupProjectDir(t, "-Users-test", "sess2", `{"type":"user","timestamp":"2024-01-01T00:00:00Z","message":{"role":"user","content":"real prompt"}}
{"type":"user","timestamp":"2024-01-01T00:00:01Z","message":{"role":"user","content":[{"type":"tool_result","content":"noise"}]}}
`)

	msgs, err := readTranscriptFrom(root, "-Users-test", "sess2")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(msgs) != 1 {
		t.Errorf("expected 1 message (tool result skipped), got %d", len(msgs))
	}
}

func TestReadTranscript_CollectsToolNames(t *testing.T) {
	root := setupProjectDir(t, "-Users-test", "sess3", `{"type":"assistant","timestamp":"2024-01-01T00:00:00Z","message":{"role":"assistant","content":[{"type":"text","text":"Let me check."},{"type":"tool_use","name":"Read"},{"type":"tool_use","name":"Grep"}]}}
`)

	msgs, err := readTranscriptFrom(root, "-Users-test", "sess3")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(msgs) != 1 {
		t.Fatalf("expected 1 message, got %d", len(msgs))
	}
	m := msgs[0]
	if m.Text != "Let me check." {
		t.Errorf("Text: got %q", m.Text)
	}
	if len(m.Tools) != 2 || m.Tools[0] != "Read" || m.Tools[1] != "Grep" {
		t.Errorf("Tools: got %v", m.Tools)
	}
}

func TestReadTranscript_SkipsThinkingBlocks(t *testing.T) {
	root := setupProjectDir(t, "-Users-test", "sess4", `{"type":"assistant","timestamp":"2024-01-01T00:00:00Z","message":{"role":"assistant","content":[{"type":"thinking","thinking":"internal thoughts"},{"type":"text","text":"visible"}]}}
`)

	msgs, err := readTranscriptFrom(root, "-Users-test", "sess4")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(msgs) != 1 {
		t.Fatalf("expected 1 message, got %d", len(msgs))
	}
	if msgs[0].Text != "visible" {
		t.Errorf("Text: got %q, want %q", msgs[0].Text, "visible")
	}
}

func TestReadTranscript_SkipsProgressLines(t *testing.T) {
	root := setupProjectDir(t, "-Users-test", "sess5", `{"type":"progress","data":{}}
{"type":"file-history-snapshot","snapshot":{}}
{"type":"user","timestamp":"2024-01-01T00:00:00Z","message":{"role":"user","content":"real"}}
`)

	msgs, err := readTranscriptFrom(root, "-Users-test", "sess5")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(msgs) != 1 {
		t.Errorf("expected 1 message, got %d", len(msgs))
	}
}

func TestReadTranscript_AssistantToolOnlyNoText(t *testing.T) {
	// Assistant turn with only tool_use blocks and no text — still included
	root := setupProjectDir(t, "-Users-test", "sess6", `{"type":"assistant","timestamp":"2024-01-01T00:00:00Z","message":{"role":"assistant","content":[{"type":"tool_use","name":"Write"}]}}
`)

	msgs, err := readTranscriptFrom(root, "-Users-test", "sess6")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(msgs) != 1 {
		t.Fatalf("expected 1 message, got %d", len(msgs))
	}
	if msgs[0].Text != "" {
		t.Errorf("expected empty text, got %q", msgs[0].Text)
	}
	if len(msgs[0].Tools) != 1 || msgs[0].Tools[0] != "Write" {
		t.Errorf("Tools: got %v", msgs[0].Tools)
	}
}
