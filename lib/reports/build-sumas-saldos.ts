import { buildReportMeta, fetchAccountBalances } from "@/lib/reports/account-ledger"
import { round2 } from "@/lib/reports/format"
import type { AccountBalance, SumasSaldosReportData } from "@/lib/reports/types"
import type { LedgerQuery } from "@/lib/reports/account-ledger"

export async function buildSumasSaldosReport(query: LedgerQuery): Promise<SumasSaldosReportData> {
  const rows = await fetchAccountBalances(query)
  const meta = await buildReportMeta(
    query.companyId,
    "Sumas y Saldos",
    query.year,
    query.fromMonth,
    query.toMonth,
  )

  const totalDebe = round2(rows.reduce((sum, row) => sum + row.totalDebe, 0))
  const totalHaber = round2(rows.reduce((sum, row) => sum + row.totalHaber, 0))

  return { meta, rows, totalDebe, totalHaber }
}

export function filterAccountsWithMovement(rows: AccountBalance[]): AccountBalance[] {
  return rows.filter(
    (row) => row.totalDebe !== 0 || row.totalHaber !== 0 || row.saldo !== 0,
  )
}
