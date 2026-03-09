package projects

import (
	"bufio"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"claudepad/backend/db/generated"

	"github.com/google/uuid"
)

// encodeProjectPath converts a real path to its encoded directory name.
func encodeProjectPath(path string) string {
	return strings.ReplaceAll(path, "/", "-")
}

func nullTimeStr(t sql.NullTime) string {
	if !t.Valid {
		return ""
	}
	return t.Time.UTC().Format(time.RFC3339)
}

func toProject(p generated.Project) Project {
	return Project{
		ID:          p.ID,
		Name:        p.Name.String,
		RealPath:    p.RealPath,
		IsGlobal:    p.IsGlobal.Int64 != 0,
		EncodedName: encodeProjectPath(p.RealPath),
		LastOpened:  nullTimeStr(p.LastOpened),
		CreatedAt:   nullTimeStr(p.CreatedAt),
	}
}

// ReadProjects returns all projects from the DB, ensuring the global row exists.
// Global is always first; remainder sorted by last_opened DESC.
func ReadProjects(q *generated.Queries, claudeDir string) ([]Project, error) {
	ctx := context.Background()
	if err := ensureGlobal(q, claudeDir); err != nil {
		return nil, err
	}
	rows, err := q.ListProjects(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]Project, len(rows))
	for i, p := range rows {
		out[i] = toProject(p)
	}
	return out, nil
}

// DiscoverProjects scans ~/.claude/projects/ and returns entries not yet in DB.
func DiscoverProjects(q *generated.Queries, claudeDir string) ([]Project, error) {
	projectsDir := filepath.Join(claudeDir, "projects")
	entries, err := os.ReadDir(projectsDir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}

	paths, err := q.ListProjectPaths(context.Background())
	if err != nil {
		return nil, err
	}
	known := make(map[string]struct{}, len(paths))
	for _, p := range paths {
		known[p] = struct{}{}
	}

	var out []Project
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		encoded := e.Name()
		realPath := resolveRealPath(filepath.Join(projectsDir, encoded), encoded)
		if _, ok := known[realPath]; ok {
			continue
		}
		out = append(out, Project{
			Name:        filepath.Base(realPath),
			RealPath:    realPath,
			EncodedName: encoded,
		})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].RealPath < out[j].RealPath })
	return out, nil
}

// AddProject inserts a new project row and returns it.
func AddProject(q *generated.Queries, path string) (Project, error) {
	if _, err := os.Stat(path); err != nil {
		return Project{}, errors.New("path does not exist: " + path)
	}
	ctx := context.Background()
	name := filepath.Base(path)
	if err := q.InsertProject(ctx, generated.InsertProjectParams{
		ID:       uuid.NewString(),
		Name:     sql.NullString{String: name, Valid: true},
		RealPath: path,
	}); err != nil {
		return Project{}, err
	}
	p, err := q.GetProjectByRealPath(ctx, path)
	if err != nil {
		return Project{}, err
	}
	return toProject(p), nil
}

// RemoveProject deletes a project by ID. Returns an error if it is the global project.
func RemoveProject(q *generated.Queries, id string) error {
	ctx := context.Background()
	p, err := q.GetProjectByID(ctx, id)
	if err != nil {
		return err
	}
	if p.IsGlobal.Int64 != 0 {
		return errors.New("cannot remove the global project")
	}
	return q.DeleteProject(ctx, id)
}

// UpdateLastOpened sets last_opened to now for the given project.
func UpdateLastOpened(q *generated.Queries, id string) error {
	return q.UpdateProjectLastOpened(context.Background(), id)
}

// ── helpers ──────────────────────────────────────────────────────────────────

func ensureGlobal(q *generated.Queries, claudeDir string) error {
	return q.UpsertGlobalProject(context.Background(), generated.UpsertGlobalProjectParams{
		ID:       uuid.NewString(),
		RealPath: claudeDir,
	})
}

func resolveRealPath(dir, encoded string) string {
	entries, err := os.ReadDir(dir)
	if err == nil {
		for _, e := range entries {
			if e.IsDir() || !strings.HasSuffix(e.Name(), ".jsonl") {
				continue
			}
			if cwd := cwdFromFile(filepath.Join(dir, e.Name())); cwd != "" {
				return cwd
			}
			break
		}
	}
	decoded := strings.ReplaceAll(encoded, "-", "/")
	if !strings.HasPrefix(decoded, "/") {
		decoded = "/" + decoded
	}
	return decoded
}

func cwdFromFile(path string) string {
	f, err := os.Open(path)
	if err != nil {
		return ""
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	scanner.Buffer(make([]byte, 1024*1024), 1024*1024)
	for scanner.Scan() {
		var line struct {
			Cwd string `json:"cwd"`
		}
		if err := json.Unmarshal(scanner.Bytes(), &line); err == nil && line.Cwd != "" {
			return line.Cwd
		}
	}
	return ""
}
