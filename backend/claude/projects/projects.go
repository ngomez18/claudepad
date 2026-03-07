package projects

import (
	"bufio"
	"database/sql"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/google/uuid"
)

// encodeProjectPath converts a real path to its encoded directory name.
func encodeProjectPath(path string) string {
	return strings.ReplaceAll(path, "/", "-")
}

// ReadProjects returns all projects from the DB, ensuring the global row exists.
// Global is always first; remainder sorted by last_opened DESC.
func ReadProjects(db *sql.DB, claudeDir string) ([]Project, error) {
	globalPath := claudeDir
	if err := ensureGlobal(db, globalPath); err != nil {
		return nil, err
	}

	rows, err := db.Query(`
		SELECT id, name, real_path, is_global, last_opened, created_at
		FROM projects
		ORDER BY is_global DESC, last_opened DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Project
	for rows.Next() {
		var p Project
		var lastOpened, createdAt sql.NullString
		if err := rows.Scan(&p.ID, &p.Name, &p.RealPath, &p.IsGlobal, &lastOpened, &createdAt); err != nil {
			return nil, err
		}
		p.EncodedName = encodeProjectPath(p.RealPath)
		if lastOpened.Valid {
			p.LastOpened = lastOpened.String
		}
		if createdAt.Valid {
			p.CreatedAt = createdAt.String
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

// DiscoverProjects scans ~/.claude/projects/ and returns entries not yet in DB.
func DiscoverProjects(db *sql.DB, claudeDir string) ([]Project, error) {
	projectsDir := filepath.Join(claudeDir, "projects")
	entries, err := os.ReadDir(projectsDir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}

	// Collect already-known paths.
	known, err := knownPaths(db)
	if err != nil {
		return nil, err
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
		p := Project{
			Name:        filepath.Base(realPath),
			RealPath:    realPath,
			EncodedName: encoded,
		}
		out = append(out, p)
	}

	sort.Slice(out, func(i, j int) bool { return out[i].RealPath < out[j].RealPath })
	return out, nil
}

// AddProject inserts a new project row and returns it.
func AddProject(db *sql.DB, path string) (Project, error) {
	if _, err := os.Stat(path); err != nil {
		return Project{}, errors.New("path does not exist: " + path)
	}

	id := uuid.NewString()
	name := filepath.Base(path)
	_, err := db.Exec(`
		INSERT INTO projects (id, name, real_path, is_global, last_opened)
		VALUES (?, ?, ?, 0, datetime('now'))
		ON CONFLICT(real_path) DO NOTHING`,
		id, name, path)
	if err != nil {
		return Project{}, err
	}

	// Read back (handles ON CONFLICT case where the row already existed).
	var p Project
	var lastOpened, createdAt sql.NullString
	err = db.QueryRow(`
		SELECT id, name, real_path, is_global, last_opened, created_at
		FROM projects WHERE real_path = ?`, path).
		Scan(&p.ID, &p.Name, &p.RealPath, &p.IsGlobal, &lastOpened, &createdAt)
	if err != nil {
		return Project{}, err
	}
	p.EncodedName = encodeProjectPath(p.RealPath)
	if lastOpened.Valid {
		p.LastOpened = lastOpened.String
	}
	if createdAt.Valid {
		p.CreatedAt = createdAt.String
	}
	return p, nil
}

// RemoveProject deletes a project by ID. Returns an error if it is the global project.
func RemoveProject(db *sql.DB, id string) error {
	var isGlobal bool
	err := db.QueryRow(`SELECT is_global FROM projects WHERE id = ?`, id).Scan(&isGlobal)
	if err != nil {
		return err
	}
	if isGlobal {
		return errors.New("cannot remove the global project")
	}
	_, err = db.Exec(`DELETE FROM projects WHERE id = ?`, id)
	return err
}

// UpdateLastOpened sets last_opened to now for the given project.
func UpdateLastOpened(db *sql.DB, id string) error {
	_, err := db.Exec(`UPDATE projects SET last_opened = datetime('now') WHERE id = ?`, id)
	return err
}

// ── helpers ──────────────────────────────────────────────────────────────────

func ensureGlobal(db *sql.DB, claudeDir string) error {
	id := uuid.NewString()
	_, err := db.Exec(`
		INSERT INTO projects (id, name, real_path, is_global, last_opened)
		VALUES (?, 'Global', ?, 1, datetime('now'))
		ON CONFLICT(real_path) DO NOTHING`,
		id, claudeDir)
	return err
}

func knownPaths(db *sql.DB) (map[string]struct{}, error) {
	rows, err := db.Query(`SELECT real_path FROM projects`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	m := map[string]struct{}{}
	for rows.Next() {
		var p string
		if err := rows.Scan(&p); err != nil {
			return nil, err
		}
		m[p] = struct{}{}
	}
	return m, rows.Err()
}

// resolveRealPath tries to read cwd from the first .jsonl file; falls back to
// decoding the directory name by replacing "-" with "/".
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
	// Fallback: encoded name starts with "-" representing leading "/".
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
