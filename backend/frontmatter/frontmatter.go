package frontmatter

import "strings"

// Parse extracts name and description from YAML frontmatter (---...---).
func Parse(content string) (name, description string) {
	if !strings.HasPrefix(content, "---") {
		return "", ""
	}
	rest := content[3:]
	end := strings.Index(rest, "\n---")
	if end < 0 {
		return "", ""
	}
	block := rest[:end]
	for _, line := range strings.Split(block, "\n") {
		line = strings.TrimSpace(line)
		if k, v, ok := strings.Cut(line, ":"); ok {
			k = strings.TrimSpace(k)
			v = strings.TrimSpace(v)
			switch k {
			case "name":
				name = v
			case "description":
				description = v
			}
		}
	}
	return name, description
}

// FirstContentLine returns the first non-empty non-frontmatter line.
func FirstContentLine(content string) string {
	body := content
	if strings.HasPrefix(content, "---") {
		rest := content[3:]
		_, after, ok := strings.Cut(rest, "\n---")
		if ok {
			body = after
		}
	}
	for line := range strings.SplitSeq(body, "\n") {
		line = strings.TrimSpace(line)
		if line != "" {
			return line
		}
	}
	return ""
}
