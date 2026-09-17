import { formatAccountCodeDisplay } from "@/lib/accounting/third-party-types"

export function confirmReleaseAccount(accountCode: string, accountName?: string): boolean {
  const formatted = formatAccountCodeDisplay(accountCode)
  const label = accountName?.trim() ? ` · ${accountName}` : ""
  return window.confirm(
    `¿Eliminar la ficha ${formatted}${label}?\n\nLa cuenta quedará libre para otro contacto o para un traspaso. Los asientos no se borran.`,
  )
}
