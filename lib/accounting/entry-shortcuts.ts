import {
  normalizeShortcutKey,
  shortcutAdvice,
  shortcutFromKeyboardEvent,
} from "@/lib/ocr/ocr-settings"

export const DEFAULT_ENTRY_SHORTCUT_BY_NAME = "F4"
export const DEFAULT_ENTRY_SHORTCUT_BY_CIF = "F6"

export type EntryShortcutAction = "name" | "cif"

export interface EntryShortcutChoice {
  byName: string
  byCif: string
}

export function entryShortcutAdvice(key: string): string | null {
  return shortcutAdvice(key)
}

export function normalizeEntryShortcut(key: string): string {
  return normalizeShortcutKey(key)
}

export function captureEntryShortcut(event: KeyboardEvent): string | null {
  return shortcutFromKeyboardEvent(event)
}

export function validateEntryShortcuts(choice: EntryShortcutChoice): string | null {
  const byName = normalizeEntryShortcut(choice.byName)
  const byCif = normalizeEntryShortcut(choice.byCif)
  if (!byName || !byCif) {
    return "Elige una tecla para buscar por nombre y otra para buscar por CIF."
  }
  if (byName === byCif) {
    return `La tecla ${byName} no puede servir para las dos búsquedas.`
  }
  return null
}

export function matchEntryShortcut(
  choice: EntryShortcutChoice,
  event: KeyboardEvent,
): EntryShortcutAction | null {
  const captured = captureEntryShortcut(event)
  const fallback = /^F([1-9]|1[0-2])$/.test(event.key) ? event.key : null
  const pressed = captured ?? fallback
  if (!pressed) return null
  if (pressed === normalizeEntryShortcut(choice.byName)) return "name"
  if (pressed === normalizeEntryShortcut(choice.byCif)) return "cif"
  return null
}
