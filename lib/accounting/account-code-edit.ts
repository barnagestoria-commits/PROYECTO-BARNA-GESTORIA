import {
  parseDottedAccountShortcut,
  preferredParentForShortcutGroup,
} from "@/lib/accounting/account-shortcut"
import { buildAccountCode, formatAccountCodeDisplay } from "@/lib/accounting/third-party-types"
import { normalizeCuenta } from "@/lib/reports/format"

export function accountCodeLookupVariants(code: string): string[] {
  const digits = normalizeCuenta(code)
  const formatted = formatAccountCodeDisplay(digits)
  return [...new Set([code.trim(), digits, formatted].filter(Boolean))]
}

export function resolvePreferredAccountCode(raw: string, groupPrefix: string): string {
  const prefix = groupPrefix.replace(/\D/g, "")
  if (!prefix) {
    throw new Error("Indica el grupo de la cuenta, por ejemplo 430.")
  }
  return resolveEditedAccountCode(raw, buildAccountCode(prefix, 1))
}

export function resolveEditedAccountCode(raw: string, currentAccountCode: string): string {
  const current = normalizeCuenta(currentAccountCode)
  if (!current) {
    throw new Error("No hay cuenta actual para modificar.")
  }

  const currentGroup = current.slice(0, Math.min(3, current.length))
  const dotted = parseDottedAccountShortcut(raw)

  if (dotted) {
    const parent =
      dotted.group.length <= 2 ? preferredParentForShortcutGroup(dotted.group) : dotted.group
    if (!current.startsWith(parent) && !current.startsWith(dotted.group)) {
      throw new Error(`La cuenta debe seguir en el grupo ${currentGroup}.`)
    }
    const prefix = parent.length >= 3 ? parent : currentGroup
    return buildAccountCode(prefix, dotted.sequence)
  }

  const digits = normalizeCuenta(raw)
  if (!digits) {
    throw new Error("Indica el código de cuenta, por ejemplo 430.2 o 430.0002.")
  }
  if (digits.length <= 3) {
    throw new Error("Indica la subcuenta completa, por ejemplo 430.2 o 430.0002.")
  }
  if (!digits.startsWith(currentGroup)) {
    throw new Error(`La cuenta debe seguir en el grupo ${currentGroup}.`)
  }
  return digits
}

export interface ReassignedAccount {
  fromAccountCode: string
  accountCode: string
  formattedAccountCode: string
  name: string
  kind: "tercero" | "ledger" | "movements"
  linesUpdated: number
}
