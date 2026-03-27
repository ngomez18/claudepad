package shell

import (
	"fmt"
	"os"
	"os/exec"
	"strings"
)

// OpenWithCommand opens the user's preferred terminal and runs command in the
// given working directory. Detects the terminal by checking for installed apps
// in order: Ghostty → iTerm2 → Terminal.app. Falls back to copying the command
// to the clipboard and returning ErrCopiedToClipboard.
func OpenWithCommand(cwd, command string) error {
	fullCmd := fmt.Sprintf("cd %s && %s", quote(cwd), command)

	switch {
	case appExists("/Applications/Ghostty.app"):
		ghosttyBin := "/Applications/Ghostty.app/Contents/MacOS/ghostty"
		cmd := exec.Command(ghosttyBin,
			"--working-directory="+cwd,
			"-e", "bash", "-c", command+"; exec bash",
		)
		if err := cmd.Start(); err == nil {
			return nil
		}
	case appExists("/Applications/iTerm.app"):
		script := fmt.Sprintf(`tell application "iTerm2"
	create window with default profile command "bash -c %s"
	activate
end tell`, quote(fullCmd))
		if err := exec.Command("osascript", "-e", script).Run(); err == nil {
			return nil
		}
	}

	// Default: Terminal.app (always present on macOS).
	script := fmt.Sprintf(`tell application "Terminal"
	do script %s
	activate
end tell`, quote(fullCmd))
	if err := exec.Command("osascript", "-e", script).Run(); err == nil {
		return nil
	}

	// Last resort: copy to clipboard.
	pbcopy := exec.Command("pbcopy")
	pipe, err := pbcopy.StdinPipe()
	if err == nil {
		if err := pbcopy.Start(); err == nil {
			_, _ = fmt.Fprint(pipe, fullCmd)
			_ = pipe.Close()
			_ = pbcopy.Wait()
		}
	}
	return ErrCopiedToClipboard
}

// OpenDir reveals path in the OS file manager (Finder on macOS).
func OpenDir(path string) error {
	return exec.Command("open", "-R", path).Run()
}

// ErrCopiedToClipboard is returned by OpenWithCommand when no terminal could
// be launched and the command was written to the clipboard instead.
var ErrCopiedToClipboard = fmt.Errorf("copied_to_clipboard")

// appExists reports whether an application bundle exists at the given path.
func appExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

// quote wraps s in single quotes, escaping any existing single quotes.
func quote(s string) string {
	return "'" + strings.ReplaceAll(s, "'", "'\\''") + "'"
}
