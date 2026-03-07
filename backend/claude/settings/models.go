package settings

type SettingsFile struct {
	Layer   string `json:"layer"`   // "global" | "project"
	Path    string `json:"path"`    // absolute path to settings.json
	Content string `json:"content"` // raw JSON (empty string if file absent)
	Exists  bool   `json:"exists"`
}
