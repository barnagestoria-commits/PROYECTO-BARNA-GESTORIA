export type OcrCommandAction = "confirm" | "skip" | "discard"

export interface OcrShortcutCommand {
  id: string
  action: OcrCommandAction
  key: string
}

export interface OcrWorkspaceSettings {
  blockDuplicates: boolean
  requireTotalsMatch: boolean
  requireCif: boolean
  isolateCurrentInvoice: boolean
  shortcuts: OcrShortcutCommand[]
}

export const OCR_COMMAND_ACTIONS: Array<{
  action: OcrCommandAction
  label: string
  hint: string
}> = [
  { action: "confirm", label: "Confirmar factura", hint: "Contabiliza la factura que estás viendo." },
  { action: "skip", label: "Saltar o eliminar esta", hint: "Pasa a la siguiente sin crear asiento." },
  { action: "discard", label: "Descartar lote", hint: "Anula el lote entero, incluidas las ya confirmadas." },
]

export const DEFAULT_OCR_SHORTCUTS: OcrShortcutCommand[] = [
  { id: "confirm-default", action: "confirm", key: "F4" },
  { id: "skip-default", action: "skip", key: "F12" },
]

export const DEFAULT_OCR_SETTINGS: OcrWorkspaceSettings = {
  blockDuplicates: true,
  requireTotalsMatch: false,
  requireCif: false,
  isolateCurrentInvoice: true,
  shortcuts: DEFAULT_OCR_SHORTCUTS,
}

const ACTION_SET = new Set<OcrCommandAction>(["confirm", "skip", "discard"])

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

export const BROWSER_RISKY_KEYS = ["F1", "F5", "F11", "F12"] as const

export function shortcutAdvice(key: string): string | null {
  const normalized = normalizeShortcutKey(key)
  if (normalized === "F12") {
    return "En el navegador F12 abre las herramientas de desarrollo. En la app de escritorio sí funciona. Si trabajas en Chrome, usa F8, F9 o Alt+S."
  }
  if (normalized === "F5") {
    return "F5 recarga la página y puedes perder el lote. Mejor F8, F9 o Alt+letra."
  }
  if (normalized === "F1") {
    return "F1 suele abrir la ayuda del navegador. Elige otra tecla de función o Alt+letra."
  }
  if (normalized === "F11") {
    return "F11 pone el navegador a pantalla completa. Elige otra tecla."
  }
  return null
}

export function normalizeShortcutKey(key: string): string {
  const trimmed = key.trim()
  const altLetter = trimmed.match(/^Alt\+([a-z])$/i)
  if (altLetter) return `Alt+${altLetter[1].toUpperCase()}`
  const functionKey = trimmed.toUpperCase().match(/^F([1-9]|1[0-2])$/)
  if (functionKey) return `F${functionKey[1]}`
  if (/^[a-z]$/i.test(trimmed)) return trimmed.toUpperCase()
  if (/^(Enter|Escape|Tab|Space)$/i.test(trimmed)) {
    return trimmed[0].toUpperCase() + trimmed.slice(1).toLowerCase()
  }
  return trimmed
}

export function shortcutFromKeyboardEvent(event: KeyboardEvent): string | null {
  if (event.key === "Escape" || event.key === "Tab") return null
  if (/^F([1-9]|1[0-2])$/.test(event.key)) return event.key
  if (event.altKey && /^[a-z]$/i.test(event.key)) return `Alt+${event.key.toUpperCase()}`
  return null
}

export function createOcrShortcut(action: OcrCommandAction = "confirm"): OcrShortcutCommand {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  return { id, action, key: "" }
}

export function firstShortcutForAction(
  shortcuts: OcrShortcutCommand[],
  action: OcrCommandAction,
): string | undefined {
  return shortcuts.find((item) => item.action === action && item.key.trim())?.key
}

export function matchOcrShortcut(
  shortcuts: OcrShortcutCommand[],
  event: KeyboardEvent,
): OcrCommandAction | null {
  const captured = shortcutFromKeyboardEvent(event)
  const fallback = /^F([1-9]|1[0-2])$/.test(event.key) ? event.key : null
  const pressed = captured ?? fallback
  if (!pressed) return null

  const match = shortcuts.find((item) => normalizeShortcutKey(item.key) === pressed)
  return match?.action ?? null
}

export function validateOcrShortcuts(shortcuts: OcrShortcutCommand[]): string | null {
  const used = new Map<string, OcrCommandAction>()
  for (const item of shortcuts) {
    const key = normalizeShortcutKey(item.key)
    if (!key) continue
    if (!ACTION_SET.has(item.action)) return "Hay un comando con una acción no válida."
    const previous = used.get(key)
    if (previous && previous !== item.action) {
      return `La tecla ${key} está asignada a dos acciones distintas.`
    }
    used.set(key, item.action)
  }
  return null
}

function parseShortcuts(raw: unknown): OcrShortcutCommand[] {
  if (!Array.isArray(raw)) return DEFAULT_OCR_SHORTCUTS
  const parsed = raw.flatMap((item, index) => {
    if (!isRecord(item)) return []
    const action = item.action
    if (action !== "confirm" && action !== "skip" && action !== "discard") return []
    const key = normalizeShortcutKey(String(item.key ?? ""))
    if (!key) return []
    return [
      {
        id: String(item.id ?? `cmd-${index}`),
        action: action as OcrCommandAction,
        key,
      },
    ]
  })
  return parsed.length > 0 ? parsed : DEFAULT_OCR_SHORTCUTS
}

export function parseOcrSettings(
  json?: string | null,
  blockDuplicatesFallback = true,
): OcrWorkspaceSettings {
  if (!json?.trim()) {
    return { ...DEFAULT_OCR_SETTINGS, blockDuplicates: blockDuplicatesFallback, shortcuts: [...DEFAULT_OCR_SHORTCUTS] }
  }

  try {
    const parsed = JSON.parse(json) as unknown
    if (!isRecord(parsed)) {
      return { ...DEFAULT_OCR_SETTINGS, blockDuplicates: blockDuplicatesFallback }
    }
    return {
      blockDuplicates:
        typeof parsed.blockDuplicates === "boolean" ? parsed.blockDuplicates : blockDuplicatesFallback,
      requireTotalsMatch: Boolean(parsed.requireTotalsMatch),
      requireCif: Boolean(parsed.requireCif),
      isolateCurrentInvoice:
        typeof parsed.isolateCurrentInvoice === "boolean" ? parsed.isolateCurrentInvoice : true,
      shortcuts: parseShortcuts(parsed.shortcuts),
    }
  } catch {
    return { ...DEFAULT_OCR_SETTINGS, blockDuplicates: blockDuplicatesFallback }
  }
}

export function serializeOcrSettings(settings: OcrWorkspaceSettings): string {
  return JSON.stringify({
    blockDuplicates: settings.blockDuplicates,
    requireTotalsMatch: settings.requireTotalsMatch,
    requireCif: settings.requireCif,
    isolateCurrentInvoice: settings.isolateCurrentInvoice,
    shortcuts: settings.shortcuts.map((item) => ({
      id: item.id,
      action: item.action,
      key: normalizeShortcutKey(item.key),
    })),
  })
}
