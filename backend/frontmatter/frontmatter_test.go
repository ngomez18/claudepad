package frontmatter

import "testing"

// ── Parse ─────────────────────────────────────────────────────────────────────

func TestParse_NameAndDescription(t *testing.T) {
	content := "---\nname: My Skill\ndescription: Does something useful\n---\nBody text"
	name, desc := Parse(content)
	if name != "My Skill" {
		t.Errorf("name: got %q, want %q", name, "My Skill")
	}
	if desc != "Does something useful" {
		t.Errorf("description: got %q, want %q", desc, "Does something useful")
	}
}

func TestParse_NoFrontmatter(t *testing.T) {
	name, desc := Parse("# Just a heading\n\nSome body text.")
	if name != "" || desc != "" {
		t.Errorf("expected empty strings, got name=%q desc=%q", name, desc)
	}
}

func TestParse_NameOnly(t *testing.T) {
	content := "---\nname: Only Name\n---\nBody"
	name, desc := Parse(content)
	if name != "Only Name" {
		t.Errorf("name: got %q, want %q", name, "Only Name")
	}
	if desc != "" {
		t.Errorf("expected empty description, got %q", desc)
	}
}

func TestParse_DescriptionOnly(t *testing.T) {
	content := "---\ndescription: Only Desc\n---\nBody"
	name, desc := Parse(content)
	if name != "" {
		t.Errorf("expected empty name, got %q", name)
	}
	if desc != "Only Desc" {
		t.Errorf("description: got %q, want %q", desc, "Only Desc")
	}
}

func TestParse_UnclosedFrontmatter(t *testing.T) {
	content := "---\nname: Unclosed\n"
	name, desc := Parse(content)
	if name != "" || desc != "" {
		t.Errorf("expected empty strings for unclosed frontmatter, got name=%q desc=%q", name, desc)
	}
}

func TestParse_EmptyFrontmatter(t *testing.T) {
	content := "---\n---\nBody"
	name, desc := Parse(content)
	if name != "" || desc != "" {
		t.Errorf("expected empty strings for empty frontmatter block, got name=%q desc=%q", name, desc)
	}
}

func TestParse_ExtraWhitespace(t *testing.T) {
	content := "---\n  name :   Trimmed  \n  description :  Also Trimmed  \n---\n"
	name, desc := Parse(content)
	if name != "Trimmed" {
		t.Errorf("name: got %q, want %q", name, "Trimmed")
	}
	if desc != "Also Trimmed" {
		t.Errorf("description: got %q, want %q", desc, "Also Trimmed")
	}
}

func TestParse_EmptyContent(t *testing.T) {
	name, desc := Parse("")
	if name != "" || desc != "" {
		t.Errorf("expected empty strings for empty content, got name=%q desc=%q", name, desc)
	}
}

// ── FirstContentLine ──────────────────────────────────────────────────────────

func TestFirstContentLine_NoFrontmatter(t *testing.T) {
	got := FirstContentLine("# Heading\nBody line")
	if got != "# Heading" {
		t.Errorf("got %q, want %q", got, "# Heading")
	}
}

func TestFirstContentLine_AfterFrontmatter(t *testing.T) {
	content := "---\nname: x\n---\n\n# First Content\nMore text"
	got := FirstContentLine(content)
	if got != "# First Content" {
		t.Errorf("got %q, want %q", got, "# First Content")
	}
}

func TestFirstContentLine_SkipsBlankLines(t *testing.T) {
	got := FirstContentLine("\n\n\nfirst non-empty")
	if got != "first non-empty" {
		t.Errorf("got %q, want %q", got, "first non-empty")
	}
}

func TestFirstContentLine_EmptyContent(t *testing.T) {
	got := FirstContentLine("")
	if got != "" {
		t.Errorf("expected empty string, got %q", got)
	}
}

func TestFirstContentLine_OnlyWhitespace(t *testing.T) {
	got := FirstContentLine("   \n\t\n  ")
	if got != "" {
		t.Errorf("expected empty string for whitespace-only, got %q", got)
	}
}

func TestFirstContentLine_UnclosedFrontmatter(t *testing.T) {
	// Unclosed frontmatter: body is treated as content
	content := "---\nname: x\nno closing fence"
	got := FirstContentLine(content)
	// Falls back to treating the whole content as body (no closing ---)
	// FirstContentLine should still find the first non-empty line
	if got == "" {
		t.Error("expected a non-empty result for unclosed frontmatter")
	}
}
