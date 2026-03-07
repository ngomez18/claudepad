package sessions

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

// rawLine is used to decode a single JSONL record.
type rawLine struct {
	Type      string      `json:"type"`
	SessionID string      `json:"sessionId"`
	Timestamp string      `json:"timestamp"`
	GitBranch string      `json:"gitBranch"`
	Cwd       string      `json:"cwd"`
	Slug      string      `json:"slug"`
	Message   *rawMessage `json:"message"`
}

type rawMessage struct {
	Content json.RawMessage `json:"content"`
}

type rawContentBlock struct {
	Type string `json:"type"`
	Text string `json:"text"` // for "text" blocks
	Name string `json:"name"` // for "tool_use" blocks
}

// ReadSessions reads all sessions from ~/.claude/projects/.
func ReadSessions() ([]Session, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil, err
	}
	return readSessionsFrom(filepath.Join(home, ".claude", "projects"))
}

func readSessionsFrom(dir string) ([]Session, error) {
	projectDirs, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return []Session{}, nil
		}
		return nil, err
	}

	var all []Session
	for _, pd := range projectDirs {
		if !pd.IsDir() {
			continue
		}
		projectPath := pd.Name()
		projectDir := filepath.Join(dir, projectPath)

		files, err := os.ReadDir(projectDir)
		if err != nil {
			continue
		}
		for _, f := range files {
			if f.IsDir() || !strings.HasSuffix(f.Name(), ".jsonl") {
				continue
			}
			if strings.HasPrefix(f.Name(), "agent-") {
				continue
			}
			path := filepath.Join(projectDir, f.Name())
			s, err := parseSessionFile(path)
			if err != nil {
				continue
			}
			s.ProjectPath = projectPath
			all = append(all, s)
		}
	}

	sort.Slice(all, func(i, j int) bool {
		return all[i].StartedAt > all[j].StartedAt
	})
	return all, nil
}

func parseSessionFile(path string) (Session, error) {
	f, err := os.Open(path)
	if err != nil {
		return Session{}, err
	}
	defer f.Close()

	var s Session
	var firstTime, lastTime time.Time

	// 4 MB buffer — JSONL lines can be large (cached content, etc.)
	scanner := bufio.NewScanner(f)
	scanner.Buffer(make([]byte, 4*1024*1024), 4*1024*1024)

	for scanner.Scan() {
		var line rawLine
		if err := json.Unmarshal(scanner.Bytes(), &line); err != nil {
			continue
		}
		if line.Type != "user" && line.Type != "assistant" {
			continue
		}

		// Parse timestamp.
		if line.Timestamp != "" {
			t, err := time.Parse(time.RFC3339Nano, line.Timestamp)
			if err == nil {
				if firstTime.IsZero() {
					firstTime = t
				}
				lastTime = t
			}
		}

		// Capture metadata from first messages that have it.
		if s.GitBranch == "" && line.GitBranch != "" {
			s.GitBranch = line.GitBranch
		}
		if s.Cwd == "" && line.Cwd != "" {
			s.Cwd = line.Cwd
		}
		if s.SessionID == "" && line.SessionID != "" {
			s.SessionID = line.SessionID
		}
		if s.Slug == "" && line.Slug != "" {
			s.Slug = line.Slug
		}

		// Count real user text turns.
		if line.Type == "user" && line.Message != nil {
			var text string
			if err := json.Unmarshal(line.Message.Content, &text); err == nil {
				s.MessageCount++
				if s.Snippet == "" {
					s.Snippet = truncate(text, 120)
				}
			}
		}
	}

	// Fallback: extract session ID from filename.
	if s.SessionID == "" {
		base := filepath.Base(path)
		s.SessionID = strings.TrimSuffix(base, ".jsonl")
	}

	if !firstTime.IsZero() {
		s.StartedAt = firstTime.UTC().Format(time.RFC3339)
		if !lastTime.IsZero() {
			s.DurationSecs = int(lastTime.Sub(firstTime).Seconds())
		}
	}

	return s, scanner.Err()
}

// ReadTranscript parses a session file into clean transcript messages.
func ReadTranscript(projectPath, sessionID string) ([]TranscriptMessage, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil, err
	}
	path := filepath.Join(home, ".claude", "projects", projectPath, sessionID+".jsonl")

	f, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("session not found: %w", err)
	}
	defer f.Close()

	return parseTranscript(f)
}

func parseTranscript(r io.Reader) ([]TranscriptMessage, error) {
	var msgs []TranscriptMessage
	scanner := bufio.NewScanner(r)
	scanner.Buffer(make([]byte, 4*1024*1024), 4*1024*1024)

	for scanner.Scan() {
		var line rawLine
		if err := json.Unmarshal(scanner.Bytes(), &line); err != nil {
			continue
		}
		if line.Message == nil {
			continue
		}

		switch line.Type {
		case "user":
			var text string
			if err := json.Unmarshal(line.Message.Content, &text); err == nil {
				msgs = append(msgs, TranscriptMessage{
					Role:      "user",
					Text:      text,
					Timestamp: line.Timestamp,
				})
			}

		case "assistant":
			var blocks []rawContentBlock
			if err := json.Unmarshal(line.Message.Content, &blocks); err != nil {
				continue
			}
			var textParts []string
			var tools []string
			for _, b := range blocks {
				switch b.Type {
				case "text":
					if b.Text != "" {
						textParts = append(textParts, b.Text)
					}
				case "tool_use":
					if b.Name != "" {
						tools = append(tools, b.Name)
					}
				}
			}
			text := strings.Join(textParts, "\n")
			if text != "" || len(tools) > 0 {
				msgs = append(msgs, TranscriptMessage{
					Role:      "assistant",
					Text:      text,
					Tools:     tools,
					Timestamp: line.Timestamp,
				})
			}
		}
	}

	return msgs, scanner.Err()
}

func truncate(s string, maxLen int) string {
	runes := []rune(s)
	if len(runes) <= maxLen {
		return s
	}
	return string(runes[:maxLen]) + "…"
}
