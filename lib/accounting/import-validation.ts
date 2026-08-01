import { calculateTotals } from "@/lib/accounting/command-templates"
import type { AccountingEntryLine } from "@/lib/types/accounting-entry"
import type { A3ImportPreview, A3JournalEntry, A3JournalLine, A3Subaccount } from "@/lib/imports/a3/types"
import { normalizeCuenta, round2 } from "@/lib/reports/format"

export interface ImportValidationIssue {
  severity: "error" | "warning"
  code: string
  message: string
  entryIndex?: number
  cuenta?: string
  details?: Record<string, unknown>
}

/** Códigos genéricos que el export nativo A3 infiere cuando no enlaza subcuentas. */
export const GENERIC_INFERRED_ACCOUNT_CODES = new Set([
  "400000000000",
  "410000000000",
  "465000000000",
  "472000000000",
  "555000000000",
  "572000000000",
  "629000000000",
  "640000000000",
])

export interface AccountTotals {
  cuenta: string
  totalDebe: number
  totalHaber: number
  saldo: number
}

function toAccountingLines(lines: A3JournalLine[]): AccountingEntryLine[] {
  return lines.map((line, index) => ({
    id: `line-${index}`,
    cuenta: line.cuenta,
    concepto: line.concepto,
    debe: line.debe,
    haber: line.haber,
  }))
}

export function validateEntryBalance(entry: A3JournalEntry): ImportValidationIssue | null {
  const totals = calculateTotals(toAccountingLines(entry.lines))
  if (totals.isBalanced) return null

  return {
    severity: "error",
    code: "UNBALANCED_ENTRY",
    message: `Asiento desequilibrado (${entry.documento || entry.concepto}): debe=${totals.debe}, haber=${totals.haber}, diff=${totals.difference}`,
    details: {
      documento: entry.documento,
      fecha: entry.fecha,
      debe: totals.debe,
      haber: totals.haber,
      difference: totals.difference,
    },
  }
}

export function validateAllEntriesBalanced(entries: A3JournalEntry[]): ImportValidationIssue[] {
  return entries.flatMap((entry, index) => {
    const issue = validateEntryBalance(entry)
    return issue ? [{ ...issue, entryIndex: index }] : []
  })
}

export function aggregateAccountTotals(entries: A3JournalEntry[]): AccountTotals[] {
  const map = new Map<string, { totalDebe: number; totalHaber: number }>()

  for (const entry of entries) {
    for (const line of entry.lines) {
      const cuenta = normalizeCuenta(line.cuenta)
      if (!cuenta) continue

      const current = map.get(cuenta) ?? { totalDebe: 0, totalHaber: 0 }
      current.totalDebe = round2(current.totalDebe + (line.debe || 0))
      current.totalHaber = round2(current.totalHaber + (line.haber || 0))
      map.set(cuenta, current)
    }
  }

  return [...map.entries()]
    .map(([cuenta, totals]) => ({
      cuenta,
      totalDebe: totals.totalDebe,
      totalHaber: totals.totalHaber,
      saldo: round2(totals.totalDebe - totals.totalHaber),
    }))
    .sort((a, b) => a.cuenta.localeCompare(b.cuenta))
}

export function getAccountPrefix(cuenta: string, digits = 3): string {
  const normalized = normalizeCuenta(cuenta)
  return normalized.slice(0, digits)
}

export function detectGenericAccountUsage(entries: A3JournalEntry[]): ImportValidationIssue[] {
  const issues: ImportValidationIssue[] = []
  const totals = aggregateAccountTotals(entries)

  for (const row of totals) {
    if (!GENERIC_INFERRED_ACCOUNT_CODES.has(row.cuenta)) continue
    if (row.totalDebe === 0 && row.totalHaber === 0) continue

    issues.push({
      severity: "warning",
      code: "GENERIC_ACCOUNT_CODE",
      cuenta: row.cuenta,
      message: `La cuenta genérica ${row.cuenta} concentra movimiento (debe=${row.totalDebe}, haber=${row.totalHaber}). Puede mezclar importes de varias subcuentas.`,
      details: { totalDebe: row.totalDebe, totalHaber: row.totalHaber, saldo: row.saldo },
    })
  }

  return issues
}

export function detectUnlinkedSubaccounts(
  entries: A3JournalEntry[],
  subaccounts: A3Subaccount[],
): ImportValidationIssue[] {
  const issues: ImportValidationIssue[] = []
  const usedAccounts = new Set(
    entries.flatMap((entry) => entry.lines.map((line) => normalizeCuenta(line.cuenta))),
  )

  const ledgerSubaccounts = subaccounts.filter((sub) => !sub.nif)

  for (const sub of ledgerSubaccounts) {
    const code = normalizeCuenta(sub.accountCode)
    if (!code || usedAccounts.has(code)) continue

    issues.push({
      severity: "warning",
      code: "UNUSED_SUBACCOUNT",
      cuenta: code,
      message: `Subcuenta ${code} (${sub.name}) existe en el plan importado pero no aparece en ningún apunte.`,
    })
  }

  const genericPrefixes = new Set<string>()
  for (const row of aggregateAccountTotals(entries)) {
    if (GENERIC_INFERRED_ACCOUNT_CODES.has(row.cuenta)) {
      genericPrefixes.add(getAccountPrefix(row.cuenta))
    }
  }

  for (const sub of ledgerSubaccounts) {
    const code = normalizeCuenta(sub.accountCode)
    const prefix = getAccountPrefix(code)
    if (!genericPrefixes.has(prefix)) continue
    if (usedAccounts.has(code)) continue

    issues.push({
      severity: "error",
      code: "SUBACCOUNT_NOT_LINKED",
      cuenta: code,
      message: `Subcuenta ${code} (${sub.name}) no está enlazada: el diario usa la cuenta genérica del grupo ${prefix} en su lugar.`,
      details: { genericPrefix: prefix },
    })
  }

  return issues
}

export function compareAccountTotals(
  expected: AccountTotals[],
  actual: AccountTotals[],
  tolerance = 0.01,
): ImportValidationIssue[] {
  const issues: ImportValidationIssue[] = []
  const actualMap = new Map(actual.map((row) => [row.cuenta, row]))
  const expectedMap = new Map(expected.map((row) => [row.cuenta, row]))

  for (const row of expected) {
    const match = actualMap.get(row.cuenta)
    if (!match) {
      issues.push({
        severity: "error",
        code: "MISSING_ACCOUNT",
        cuenta: row.cuenta,
        message: `Cuenta ${row.cuenta} esperada con saldo ${row.saldo} pero no tiene movimiento importado.`,
        details: { expected: row },
      })
      continue
    }

    const debeDiff = Math.abs(row.totalDebe - match.totalDebe)
    const haberDiff = Math.abs(row.totalHaber - match.totalHaber)
    const saldoDiff = Math.abs(row.saldo - match.saldo)

    if (debeDiff > tolerance || haberDiff > tolerance || saldoDiff > tolerance) {
      issues.push({
        severity: "error",
        code: "ACCOUNT_TOTAL_MISMATCH",
        cuenta: row.cuenta,
        message: `Cuenta ${row.cuenta}: saldo esperado ${row.saldo}, obtenido ${match.saldo}.`,
        details: { expected: row, actual: match },
      })
    }
  }

  for (const row of actual) {
    if (expectedMap.has(row.cuenta)) continue
    if (row.totalDebe === 0 && row.totalHaber === 0) continue

    issues.push({
      severity: "warning",
      code: "UNEXPECTED_ACCOUNT",
      cuenta: row.cuenta,
      message: `Cuenta ${row.cuenta} con saldo ${row.saldo} no estaba en los totales esperados.`,
      details: { actual: row },
    })
  }

  return issues
}

export type A3ImportValidationInput = Pick<A3ImportPreview, "entries" | "subaccounts">

export function validateA3ImportPreview(preview: A3ImportValidationInput): ImportValidationIssue[] {
  return [
    ...validateAllEntriesBalanced(preview.entries),
    ...detectGenericAccountUsage(preview.entries),
    ...detectUnlinkedSubaccounts(preview.entries, preview.subaccounts),
  ]
}

export function summarizeImportValidation(issues: ImportValidationIssue[]): {
  errorCount: number
  warningCount: number
  isValid: boolean
} {
  const errorCount = issues.filter((issue) => issue.severity === "error").length
  const warningCount = issues.filter((issue) => issue.severity === "warning").length
  return { errorCount, warningCount, isValid: errorCount === 0 }
}
