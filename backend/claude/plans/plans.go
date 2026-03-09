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
	sort.SliceStable(planList, func(i, j int) bool {
		pi, pj := planList[i], planList[j]
		if pi.Pinned != pj.Pinned {
			return pi.Pinned
		}
		return pi.ModifiedAt > pj.ModifiedAt
	})
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

		tags := []string{}
		if row.Tags != "" && row.Tags != "[]" {
			_ = json.Unmarshal([]byte(row.Tags), &tags)
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

	var plans []Plan
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
		content := string(data)
		done := len(todoCheckedRe.FindAllString(content, -1))
		total := done + len(todoUncheckedRe.FindAllString(content, -1))

		plans = append(plans, Plan{
			Path:       path,
			Filename:   strings.TrimSuffix(e.Name(), ".md"),
			Content:    content,
			TodoTotal:  total,
			TodoDone:   done,
			ModifiedAt: info.ModTime().UTC().Format(time.RFC3339),
			WordCount:  len(strings.Fields(content)),
			Tags:       []string{},
		})
	}

	sort.Slice(plans, func(i, j int) bool {
		return plans[i].ModifiedAt > plans[j].ModifiedAt
	})

	return plans, nil
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
