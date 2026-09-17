import { formatAccountCodeDisplay } from "@/lib/accounting/third-party-types"
import { normalizeCuenta } from "@/lib/reports/format"

export interface AccountFichaOccupant {
  accountCode: string
  name?: string | null
}

export function occupiedAccountError(
  accountCode: string,
  occupantName?: string | null,
): string {
  const formatted = formatAccountCodeDisplay(accountCode)
  return `La cuenta ${formatted} ya está ocupada${occupantName ? ` (${occupantName})` : ""}.`
}

/** A leftover asiento does not occupy the number; only a live ficha does. */
export function blockingAccountFicha(
  occupant: AccountFichaOccupant | null | undefined,
  currentAccountCode?: string,
): AccountFichaOccupant | null {
  if (!occupant) return null
  const occupantDigits = normalizeCuenta(occupant.accountCode)
  const currentDigits = normalizeCuenta(currentAccountCode ?? "")
  if (currentDigits && occupantDigits === currentDigits) return null
  return occupant
}

export function assertTargetFichaAvailable(
  occupant: AccountFichaOccupant | null | undefined,
  toAccountCode: string,
  currentAccountCode?: string,
) {
  const blocking = blockingAccountFicha(occupant, currentAccountCode)
  if (!blocking) return
  throw new Error(occupiedAccountError(toAccountCode, blocking.name))
}
