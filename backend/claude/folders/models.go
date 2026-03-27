package folders

// Folder represents a named group for organizing entities (notes, plans, etc.).
type Folder struct {
	ID         string `json:"id"`
	EntityType string `json:"entityType"`
	Name       string `json:"name"`
	Pinned     bool   `json:"pinned"`
}
