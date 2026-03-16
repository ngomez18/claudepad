package notes

import (
	"context"
	"database/sql"
	"encoding/json"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"claudepad/backend/db/generated"

	"github.com/google/uuid"
)

// NotesDir returns the path to Claudepad's notes folder, creating it if absent.
func NotesDir() (string, error) {
	return notesDir()
}

func notesDir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(home, ".claudepad", "notes")
	return dir, os.MkdirAll(dir, 0o750)
}

// InstallSaveNoteCommand writes ~/.claude/commands/cpad-save-note.md if not present.
func InstallSaveNoteCommand() error {
	home, err := os.UserHomeDir()
	if err != nil {
		return err
	}
	dest := filepath.Join(home, ".claude", "commands", "cpad-save-note.md")
	if _, err := os.Stat(dest); err == nil {
		return nil // already exists
	}
	if err := os.MkdirAll(filepath.Dir(dest), 0o755); err != nil {
		return err
	}
	content := "---\ndescription: Save the most recent answer as a note in Claudepad\nallowed-tools: Bash Write\n---\n\n" +
		"Extract the most recent substantive answer from this conversation and save it as a note in Claudepad.\n\n" +
		"1. Generate a concise title (5-8 words) describing what was answered\n" +
		"2. Determine today's date and create a slug from the title (lowercase, hyphens)\n" +
		"3. Write the note to `~/.claudepad/notes/{YYYY-MM-DD}-{slug}.md` with frontmatter:\n" +
		"   ```\n" +
		"   ---\n" +
		"   title: {generated title}\n" +
		"   project: {current working directory}\n" +
		"   ---\n" +
		"   ```\n" +
		"4. The note body is the extracted answer, cleaned up for standalone reading (remove conversational filler, keep the substance)\n" +
		"5. Confirm: \"Note saved: ~/.claudepad/notes/{filename}\"\n"
	return os.WriteFile(dest, []byte(content), 0o644)
}

// InstallNotesSkill writes ~/.claude/skills/claudepad-notes/SKILL.md if not present.
// The skill instructs Claude to proactively use the save_note MCP tool when it
// produces a substantive, self-contained answer worth keeping.
func InstallNotesSkill() error {
	home, err := os.UserHomeDir()
	if err != nil {
		return err
	}
	dest := filepath.Join(home, ".claude", "skills", "claudepad-notes", "SKILL.md")
	if _, err := os.Stat(dest); err == nil {
		return nil // already exists
	}
	if err := os.MkdirAll(filepath.Dir(dest), 0o755); err != nil {
		return err
	}
	content := "---\n" +
		"name: claudepad-notes\n" +
		"description: Proactively save valuable answers as Claudepad notes via MCP\n" +
		"---\n\n" +
		"You have access to a `save_note` MCP tool provided by the claudepad server.\n\n" +
		"Use it proactively when:\n" +
		"- The user explicitly asks you to save, note, or remember something\n" +
		"- You produce a self-contained reference answer (a how-to, an architecture decision,\n" +
		"  a list of steps, a summary) that would be useful to refer back to outside this session\n\n" +
		"Do NOT use it for: debugging steps, intermediate exploration, one-off commands, or\n" +
		"conversational replies. Err on the side of NOT saving — only capture things that\n" +
		"would genuinely be worth revisiting later.\n\n" +
		"When saving, generate a concise title (5–8 words) that describes the substance,\n" +
		"and pass the current working directory as `cwd` if available.\n"
	return os.WriteFile(dest, []byte(content), 0o644)
}

// parseFrontmatter extracts key-value pairs from YAML frontmatter (---...---).
// Returns the frontmatter map and the body content after the closing delimiter.
func parseFrontmatter(raw string) (map[string]string, string) {
	meta := map[string]string{}
	if !strings.HasPrefix(raw, "---") {
		return meta, raw
	}
	rest := raw[3:]
	end := strings.Index(rest, "\n---")
	if end < 0 {
		return meta, raw
	}
	block := rest[:end]
	body := rest[end+4:] // skip "\n---"
	// trim leading newlines (the line break ending "---" plus any blank separator lines)
	body = strings.TrimLeft(body, "\n")

	for _, line := range strings.Split(block, "\n") {
		line = strings.TrimSpace(line)
		if k, v, ok := strings.Cut(line, ":"); ok {
			meta[strings.TrimSpace(k)] = strings.TrimSpace(v)
		}
	}
	return meta, body
}

// noteFromContent builds a Note from raw file content and file metadata.
func noteFromContent(path, filename, raw string, modTime time.Time) Note {
	meta, body := parseFrontmatter(raw)

	title := meta["title"]
	if title == "" {
		title = filenameToTitle(filename)
	}

	return Note{
		Path:       path,
		Filename:   filename,
		Title:      title,
		Content:    body,
		Project:    meta["project"],
		ModifiedAt: modTime.UTC().Format(time.RFC3339),
		WordCount:  len(strings.Fields(body)),
		Tags:       []string{},
	}
}

// filenameToTitle converts a note filename (e.g. "2024-01-15-how-streams-work") to a title.
func filenameToTitle(filename string) string {
	// Strip leading date prefix (YYYY-MM-DD-)
	parts := strings.SplitN(filename, "-", 4)
	slug := filename
	if len(parts) == 4 && len(parts[0]) == 4 && len(parts[1]) == 2 && len(parts[2]) == 2 {
		slug = parts[3]
	}
	words := strings.Fields(strings.ReplaceAll(slug, "-", " "))
	if len(words) == 0 {
		return filename
	}
	words[0] = strings.ToUpper(words[0][:1]) + words[0][1:]
	return strings.Join(words, " ")
}

// ReadNotes reads all note files from ~/.claudepad/notes/ and enriches them
// with metadata stored in the SQLite file_metadata table.
// Sort order: pinned first → modifiedAt desc.
func ReadNotes(q *generated.Queries) ([]Note, error) {
	dir, err := notesDir()
	if err != nil {
		return nil, err
	}
	return readNotesFrom(q, dir)
}

func readNotesFrom(q *generated.Queries, dir string) ([]Note, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return []Note{}, nil
		}
		return nil, err
	}

	var noteList []Note
	for _, e := range entries {
		if e.IsDir() || filepath.Ext(e.Name()) != ".md" {
			continue
		}
		path := filepath.Join(dir, e.Name())
		data, err := os.ReadFile(path)
		if err != nil {
			continue
		}
		info, _ := e.Info()
		note := noteFromContent(path, strings.TrimSuffix(e.Name(), ".md"), string(data), info.ModTime())
		noteList = append(noteList, note)
	}

	enrichNotesFromDB(q, noteList)
	sortNotes(noteList)
	return noteList, nil
}

// enrichNotesFromDB populates metadata fields on each note from the DB.
func enrichNotesFromDB(q *generated.Queries, noteList []Note) {
	ctx := context.Background()
	for i := range noteList {
		row, err := q.GetNoteMeta(ctx, noteList[i].Path)
		if err != nil {
			continue // no row or DB error — leave defaults
		}
		if row.FriendlyName.Valid {
			noteList[i].Title = row.FriendlyName.String
		}
		noteList[i].Pinned = row.Pinned != 0
		noteList[i].Notes = row.Notes
		noteList[i].Archived = row.Archived != 0

		var tags []string
		if row.Tags != "" {
			_ = json.Unmarshal([]byte(row.Tags), &tags)
		}
		if tags == nil {
			tags = []string{}
		}
		noteList[i].Tags = tags
	}
}

// sortNotes sorts notes: pinned first, then modifiedAt descending.
func sortNotes(noteList []Note) {
	sort.SliceStable(noteList, func(i, j int) bool {
		ni, nj := noteList[i], noteList[j]
		if ni.Pinned != nj.Pinned {
			return ni.Pinned
		}
		return ni.ModifiedAt > nj.ModifiedAt
	})
}

// DeleteNote removes a note file from disk. Any DB metadata is left as-is
// (orphaned rows are harmless and small).
func DeleteNote(path string) error {
	return os.Remove(path)
}

// SetNoteTitle stores a friendly display title for a note in SQLite.
// Pass empty string to clear (resets to frontmatter/filename-derived default).
func SetNoteTitle(q *generated.Queries, path, title string) error {
	ctx := context.Background()
	if title == "" {
		return q.ClearNoteTitle(ctx, path)
	}
	return q.UpsertNoteTitle(ctx, generated.UpsertNoteTitleParams{
		ID:           uuid.NewString(),
		RealPath:     path,
		FriendlyName: sql.NullString{String: title, Valid: true},
	})
}

// SetNoteMeta upserts all mutable metadata fields for a note.
func SetNoteMeta(q *generated.Queries, path string, meta NoteMeta) error {
	tagsJSON, err := json.Marshal(meta.Tags)
	if err != nil {
		return err
	}
	pinnedInt := int64(0)
	if meta.Pinned {
		pinnedInt = 1
	}
	archivedInt := int64(0)
	if meta.Archived {
		archivedInt = 1
	}
	return q.UpsertNoteMeta(context.Background(), generated.UpsertNoteMetaParams{
		ID:       uuid.NewString(),
		RealPath: path,
		Pinned:   pinnedInt,
		Tags:     string(tagsJSON),
		Notes:    meta.Notes,
		Archived: archivedInt,
	})
}
