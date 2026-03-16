package settings

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

// claudeJSONPath returns the path to ~/.claude.json.
func claudeJSONPath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".claude.json"), nil
}

// ReadMcpServers reads the mcpServers object from ~/.claude.json.
// Returns an empty map if the file or key is absent.
func ReadMcpServers() (map[string]McpServerConfig, error) {
	path, err := claudeJSONPath()
	if err != nil {
		return nil, err
	}
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return map[string]McpServerConfig{}, nil
		}
		return nil, err
	}

	var raw map[string]json.RawMessage
	if err := json.Unmarshal(data, &raw); err != nil {
		return map[string]McpServerConfig{}, nil
	}

	mcpRaw, ok := raw["mcpServers"]
	if !ok {
		return map[string]McpServerConfig{}, nil
	}

	var servers map[string]McpServerConfig
	if err := json.Unmarshal(mcpRaw, &servers); err != nil {
		return map[string]McpServerConfig{}, nil
	}
	return servers, nil
}

// InstallMcpServer upserts the "claudepad" entry in ~/.claude.json mcpServers
// to point at the embedded SSE server running on the given port.
func InstallMcpServer(port int) error {
	servers, _ := ReadMcpServers()
	if servers == nil {
		servers = map[string]McpServerConfig{}
	}
	servers["claudepad"] = McpServerConfig{
		Type: "sse",
		URL:  fmt.Sprintf("http://127.0.0.1:%d/sse", port),
	}
	return WriteMcpServers(servers)
}

// WriteMcpServers updates only the mcpServers key in ~/.claude.json,
// preserving all other keys in the file.
func WriteMcpServers(servers map[string]McpServerConfig) error {
	path, err := claudeJSONPath()
	if err != nil {
		return err
	}

	// Read existing file to preserve other keys.
	raw := map[string]json.RawMessage{}
	if data, err := os.ReadFile(path); err == nil {
		_ = json.Unmarshal(data, &raw)
	}

	mcpJSON, err := json.Marshal(servers)
	if err != nil {
		return err
	}
	raw["mcpServers"] = json.RawMessage(mcpJSON)

	out, err := json.MarshalIndent(raw, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, append(out, '\n'), 0o644)
}

// ReadSettings returns settings files for the global and optionally project layer.
// If a file doesn't exist, returns a SettingsFile with Exists=false and Content="{}".
// projectPath is the real filesystem path of the project; pass empty string to skip project layer.
func ReadSettings(projectPath string) ([]SettingsFile, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil, err
	}

	globalPath := filepath.Join(home, ".claude", "settings.json")
	result := []SettingsFile{readSettingsFrom(globalPath, "global")}

	if projectPath != "" {
		projectSettingsPath := filepath.Join(projectPath, ".claude", "settings.json")
		localSettingsPath := filepath.Join(projectPath, ".claude", "settings.local.json")
		result = append(result,
			readSettingsFrom(projectSettingsPath, "project"),
			readSettingsFrom(localSettingsPath, "local"),
		)
	}

	return result, nil
}

// WriteSettings validates content as JSON then writes it to path, creating parent dirs as needed.
func WriteSettings(path, content string) error {
	if !json.Valid([]byte(content)) {
		return fmt.Errorf("invalid JSON")
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	return os.WriteFile(path, []byte(content), 0o644)
}

func readSettingsFrom(path, layer string) SettingsFile {
	data, err := os.ReadFile(path)
	if err != nil {
		return SettingsFile{Layer: layer, Path: path, Content: "{}", Exists: false}
	}
	return SettingsFile{Layer: layer, Path: path, Content: string(data), Exists: true}
}
