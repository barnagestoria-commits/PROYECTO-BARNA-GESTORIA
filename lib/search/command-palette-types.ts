export type CommandPaletteItemKind =
  | "navigation"
  | "action"
  | "third-party"
  | "account"
  | "company"

export interface CommandPaletteItem {
  id: string
  kind: CommandPaletteItemKind
  title: string
  subtitle?: string
  keywords?: string[]
  href?: string
  action?: "switch-company"
  companyId?: string
}

export interface CommandPaletteSearchResponse {
  success: true
  query: string
  results: CommandPaletteItem[]
}
