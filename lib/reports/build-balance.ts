import { buildReportMeta } from "@/lib/reports/account-ledger"
import type { ComparableRow } from "@/lib/reports/compare-years"
import { normalizeCuenta, round2 } from "@/lib/reports/format"
import { loadStatementSource } from "@/lib/reports/statement-source"
import { combineAmountTotals, mergeColumnRows, pruneOptionalColumns, type StatementColumn } from "@/lib/reports/statement-layout"
import type { AccountBalance, BalanceReportData, BalanceSection } from "@/lib/reports/types"
import type { LedgerQuery } from "@/lib/reports/account-ledger"

type BalanceBucket =
  | "activo_nc"
  | "activo_c"
  | "patrimonio"
  | "pasivo_nc"
  | "pasivo_c"

function classifyBalanceBucket(cuenta: string, saldo: number): BalanceBucket | null {
  const digits = normalizeCuenta(cuenta)
  if (!digits) return null

  const d1 = digits[0]
  const d2 = digits.slice(0, 2)
  const d2n = Number.parseInt(d2, 10)

  if (d1 === "6" || d1 === "7") return null

  if (d1 === "1") return "patrimonio"

  if (d2n >= 20 && d2n <= 28) return saldo >= 0 ? "activo_nc" : "activo_nc"

  if (d1 === "3") return "activo_c"

  if (d1 === "4") {
    if (d2n >= 40 && d2n <= 42) return saldo <= 0 ? "pasivo_c" : "activo_c"
    if (d2n >= 43 && d2n <= 46) return saldo >= 0 ? "activo_c" : "pasivo_c"
    if (d2 === "47") return saldo <= 0 ? "pasivo_c" : "activo_c"
    if (d2n >= 48 && d2n <= 49) return saldo >= 0 ? "activo_c" : "pasivo_c"
    return saldo >= 0 ? "activo_c" : "pasivo_c"
  }

  if (d1 === "5") {
    if (d2n >= 50 && d2n <= 52) return saldo <= 0 ? "pasivo_c" : "activo_c"
    if (d2n >= 53 && d2n <= 58) return saldo >= 0 ? "activo_c" : "pasivo_c"
    return saldo >= 0 ? "activo_c" : "pasivo_c"
  }

  return null
}

function balanceAmount(cuenta: string, saldo: number, bucket: BalanceBucket): number {
  if (bucket === "patrimonio" || bucket === "pasivo_nc" || bucket === "pasivo_c") {
    return round2(Math.abs(saldo <= 0 ? saldo : -saldo))
  }
  return round2(Math.abs(saldo >= 0 ? saldo : -saldo))
}

function rowsForBucket(rows: AccountBalance[], bucket: BalanceBucket): ComparableRow[] {
  return rows
    .filter((row) => classifyBalanceBucket(row.cuenta, row.saldo) === bucket)
    .map((row) => ({
      cuenta: row.cuenta,
      label: row.label,
      amount: balanceAmount(row.cuenta, row.saldo, bucket),
      level: row.level,
    }))
}

function compareValue(columns: StatementColumn[], totals: Array<number | null>): number | undefined {
  const percent = columns.find((column) => column.kind === "percent")
  if (!percent || percent.baseIndex === undefined) return undefined
  return totals[percent.baseIndex] ?? 0
}

function buildSection(
  title: string,
  bucket: BalanceBucket,
  source: Awaited<ReturnType<typeof loadStatementSource>>,
): BalanceSection {
  const bySlice = new Map<string, ComparableRow[]>()
  for (const slice of source.layout.slices) {
    bySlice.set(slice.id, rowsForBucket(source.slices.get(slice.id) ?? [], bucket))
  }
  const merged = mergeColumnRows(source.layout.columns, bySlice)
  return {
    title,
    rows: merged.rows,
    subtotal: merged.totals[0] ?? 0,
    subtotals: merged.totals,
  }
}

function applyPrune(columns: StatementColumn[], sections: BalanceSection[]) {
  const pruned = pruneOptionalColumns(
    columns,
    sections.map((section) => ({ rows: section.rows, totals: section.subtotals ?? [] })),
  )
  return {
    columns: pruned.columns,
    sections: sections.map((section, index) => {
      const group = pruned.groups[index]
      return {
        ...section,
        rows: group?.rows ?? section.rows,
        subtotals: group?.totals,
        subtotal: group?.totals[0] ?? section.subtotal,
        compareSubtotal: group ? compareValue(pruned.columns, group.totals) : undefined,
      }
    }),
  }
}

export async function buildBalanceReport(query: LedgerQuery): Promise<BalanceReportData> {
  const source = await loadStatementSource(query, "balance")
  const meta = await buildReportMeta(query.companyId, "Balance de Situación", query.year, query.fromMonth, query.toMonth)
  meta.compareYear = source.layout.compareYear
  meta.periodLabel = source.layout.periodLabel

  const drafted = [
    buildSection("A) Activo no corriente", "activo_nc", source),
    buildSection("B) Activo corriente", "activo_c", source),
    buildSection("A) Patrimonio neto", "patrimonio", source),
    buildSection("B) Pasivo no corriente", "pasivo_nc", source),
    buildSection("C) Pasivo corriente", "pasivo_c", source),
  ]
  const finished = applyPrune(source.layout.columns, drafted)
  meta.columns = finished.columns
  const activo = finished.sections.slice(0, 2).filter((section) => section.rows.length > 0)
  const pasivo = finished.sections.slice(2).filter((section) => section.rows.length > 0)
  const totalActivoValues = combineAmountTotals(
    finished.columns,
    activo.map((section) => section.subtotals ?? []),
  )
  const totalPasivoValues = combineAmountTotals(
    finished.columns,
    pasivo.map((section) => section.subtotals ?? []),
  )

  return {
    meta,
    activo,
    pasivo,
    totalActivo: round2(totalActivoValues[0] ?? 0),
    totalPasivo: round2(totalPasivoValues[0] ?? 0),
    totalActivoCompare: compareValue(finished.columns, totalActivoValues),
    totalPasivoCompare: compareValue(finished.columns, totalPasivoValues),
    totalActivoValues,
    totalPasivoValues,
  }
}
