// Hand-written types that complement the auto-generated wailsjs/go/models.ts.
// Wails does not generate TypeScript classes for structs used only as map values,
// so those are defined here instead.

export interface McpServerConfig {
  type: string
  command: string
  args: string[]
  url: string
  headers: Record<string, string>
}
