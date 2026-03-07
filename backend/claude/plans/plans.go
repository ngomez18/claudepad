package plans

import (
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"
)

var (
	todoUncheckedRe = regexp.MustCompile(`(?m)^[ \t]*- \[ \]`)
	todoCheckedRe   = regexp.MustCompile(`(?m)^[ \t]*- \[[xX]\]`)
)

// ReadPlans reads all plan files from ~/.claude/plans/.
func ReadPlans() ([]Plan, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil, err
	}
	return readPlansFrom(filepath.Join(home, ".claude", "plans"))
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
		})
	}

	sort.Slice(plans, func(i, j int) bool {
		return plans[i].ModifiedAt > plans[j].ModifiedAt
	})

	return plans, nil
}
