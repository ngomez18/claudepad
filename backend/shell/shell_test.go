package shell

import (
	"strings"
	"testing"
)

func TestQuote_SimplePath(t *testing.T) {
	got := quote("/Users/ngomez/code/claudepad")
	want := "'/Users/ngomez/code/claudepad'"
	if got != want {
		t.Errorf("got %q, want %q", got, want)
	}
}

func TestQuote_PathWithSpaces(t *testing.T) {
	got := quote("/Users/ngomez/my projects/app")
	want := "'/Users/ngomez/my projects/app'"
	if got != want {
		t.Errorf("got %q, want %q", got, want)
	}
}

func TestQuote_PathWithSingleQuote(t *testing.T) {
	// e.g. /Users/o'brien/project
	got := quote("/Users/o'brien/project")
	want := "'/Users/o'\\''brien/project'"
	if got != want {
		t.Errorf("got %q, want %q", got, want)
	}
}

func TestQuote_Empty(t *testing.T) {
	got := quote("")
	want := "''"
	if got != want {
		t.Errorf("got %q, want %q", got, want)
	}
}

func TestQuote_MultipleSingleQuotes(t *testing.T) {
	got := quote("it's a dog's life")
	// Each ' becomes '\''
	if !strings.HasPrefix(got, "'") || !strings.HasSuffix(got, "'") {
		t.Errorf("result should be wrapped in single quotes, got %q", got)
	}
	if strings.Count(got, "'\\''") != 2 {
		t.Errorf("expected 2 escaped single quotes, got %q", got)
	}
}

func TestErrCopiedToClipboard_Message(t *testing.T) {
	if ErrCopiedToClipboard.Error() != "copied_to_clipboard" {
		t.Errorf("unexpected error message: %q", ErrCopiedToClipboard.Error())
	}
}
