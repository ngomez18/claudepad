package plans

import (
	"context"
	"database/sql"
	"encoding/json"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"

	"claudepad/backend/db/generated"

	"github.com/google/uuid"
)

var (
	todoUncheckedRe = regexp.MustCompile(`(?m)^[ \t]*- \[ \]`)
	todoCheckedRe   = regexp.MustCompile(`(?m)^[ \t]*- \[[xX]\]`)
)

// PreservedDir returns the path to Claudepad's plan preservation folder,
// creating it if it doesn't exist.
func PreservedDir() (string, error) {
	return preservedDir()
}

func preservedDir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(home, ".claudepad", "plans")
	return dir, os.MkdirAll(dir, 0o750)
}

// canonicalPath converts a preserved-folder path back to its canonical
// Claude Code path, for use as the file_metadata lookup key.
// e.g. ~/.claudepad/plans/foo.md → ~/.claude/plans/foo.md
func canonicalPath(preservedPath string) string {
	home, _ := os.UserHomeDir()
	filename := filepath.Base(preservedPath)
	return filepath.Join(home, ".claude", "plans", filename)
}

// planFromContent builds a Plan from raw content and file metadata.
func planFromContent(path, filename, content string, modTime time.Time) Plan {
	done := len(todoCheckedRe.FindAllString(content, -1))
	total := done + len(todoUncheckedRe.FindAllString(content, -1))
	return Plan{
		Path:       path,
		Filename:   filename,
		Content:    content,
		TodoTotal:  total,
		TodoDone:   done,
		ModifiedAt: modTime.UTC().Format(time.RFC3339),
		WordCount:  len(strings.Fields(content)),
		Tags:       []string{},
	}
}

// sortPlans sorts plans: pinned first, then modifiedAt descending.
func sortPlans(planList []Plan) {
	sort.SliceStable(planList, func(i, j int) bool {
		pi, pj := planList[i], planList[j]
		if pi.Pinned != pj.Pinned {
			return pi.Pinned
		}
		return pi.ModifiedAt > pj.ModifiedAt
	})
}

// SyncToPreserved copies each live plan to ~/.claudepad/plans/ if it is
// missing or its content has changed.
func SyncToPreserved(planList []Plan) error {
	dir, err := preservedDir()
	if err != nil {
		return err
	}
	return syncToPreservedDir(planList, dir)
}

func syncToPreservedDir(planList []Plan, dir string) error {
	for _, p := range planList {
		dest := filepath.Join(dir, p.Filename+".md")
		existing, _ := os.ReadFile(dest)
		if string(existing) == p.Content {
			continue
		}
		if err := os.WriteFile(dest, []byte(p.Content), 0o600); err != nil {
			return err
		}
	}
	return nil
}

// ReadPreservedPlans reads ~/.claudepad/plans/, excludes files whose canonical
// path still exists on disk (those are already in livePlans), and enriches the
// remainder with metadata using the canonical path as the lookup key.
func ReadPreservedPlans(q *generated.Queries, livePlans []Plan) ([]Plan, error) {
	dir, err := preservedDir()
	if err != nil {
		return nil, err
	}
	return readPreservedPlansFrom(q, livePlans, dir)
}

func readPreservedPlansFrom(q *generated.Queries, livePlans []Plan, dir string) ([]Plan, error) {
	live := make(map[string]struct{}, len(livePlans))
	for _, p := range livePlans {
		live[p.Path] = struct{}{}
	}

	entries, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}

	var result []Plan
	for _, e := range entries {
		if e.IsDir() || filepath.Ext(e.Name()) != ".md" {
			continue
		}
		canonical := canonicalPath(filepath.Join(dir, e.Name()))
		if _, isLive := live[canonical]; isLive {
			continue
		}
		content, err := os.ReadFile(filepath.Join(dir, e.Name()))
		if err != nil {
			continue
		}
		info, _ := e.Info()
		p := planFromContent(
			canonical,
			strings.TrimSuffix(e.Name(), ".md"),
			string(content),
			info.ModTime(),
		)
		p.Preserved = true
		result = append(result, p)
	}
	enrichPlansFromDB(q, result)
	sortPlans(result)
	return result, nil
}

// ReadPlans reads all plan files from ~/.claude/plans/ and enriches them
// with metadata stored in the SQLite file_metadata table.
// Sort order: pinned first → modifiedAt desc.
func ReadPlans(q *generated.Queries) ([]Plan, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil, err
	}
	planList, err := readPlansFrom(filepath.Join(home, ".claude", "plans"))
	if err != nil {
		return nil, err
	}
	enrichPlansFromDB(q, planList)
	sortPlans(planList)
	return planList, nil
}

// enrichPlansFromDB populates metadata fields on each plan from the DB.
func enrichPlansFromDB(q *generated.Queries, planList []Plan) {
	ctx := context.Background()
	for i := range planList {
		row, err := q.GetPlanMeta(ctx, planList[i].Path)
		if err != nil {
			continue // no row or DB error — leave defaults
		}
		if row.FriendlyName.Valid {
			planList[i].Name = row.FriendlyName.String
		}
		planList[i].Pinned = row.Pinned != 0
		planList[i].ProjectID = row.ProjectID
		planList[i].Notes = row.Notes
		planList[i].Archived = row.Archived != 0

		var tags []string
		if row.Tags != "" {
			_ = json.Unmarshal([]byte(row.Tags), &tags)
		}
		if tags == nil {
			tags = []string{}
		}
		planList[i].Tags = tags
	}
}

func readPlansFrom(dir string) ([]Plan, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return []Plan{}, nil
		}
		return nil, err
	}

	var planList []Plan
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".md") {
			continue
		}

		path := filepath.Join(dir, e.Name())
		data, err := os.ReadFile(path)
		if err != nil {
			continue
		}

		info, _ := e.Info()
		planList = append(planList, planFromContent(
			path,
			strings.TrimSuffix(e.Name(), ".md"),
			string(data),
			info.ModTime(),
		))
	}

	sort.Slice(planList, func(i, j int) bool {
		return planList[i].ModifiedAt > planList[j].ModifiedAt
	})

	return planList, nil
}

// SetPlanName stores a friendly display name for a plan in SQLite.
// Pass empty string to clear the name (resets to filename-derived default).
func SetPlanName(q *generated.Queries, path, name string) error {
	ctx := context.Background()
	if name == "" {
		return q.ClearPlanName(ctx, path)
	}
	return q.UpsertPlanName(ctx, generated.UpsertPlanNameParams{
		ID:           uuid.NewString(),
		RealPath:     path,
		FriendlyName: sql.NullString{String: name, Valid: true},
	})
}

// SetPlanMeta upserts all mutable metadata fields for a plan. It never modifies friendly_name.
func SetPlanMeta(q *generated.Queries, path string, meta PlanMeta) error {
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
	return q.UpsertPlanMeta(context.Background(), generated.UpsertPlanMetaParams{
		ID:        uuid.NewString(),
		RealPath:  path,
		Pinned:    pinnedInt,
		ProjectID: meta.ProjectID,
		Tags:      string(tagsJSON),
		Notes:     meta.Notes,
		Archived:  archivedInt,
	})
}
