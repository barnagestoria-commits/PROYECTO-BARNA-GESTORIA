import { buildReportMeta, fetchAccountBalances } from "@/lib/reports/account-ledger"
import { normalizeCuenta, round2 } from "@/lib/reports/format"
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

function buildSection(title: string, rows: AccountBalance[], bucket: BalanceBucket): BalanceSection {
  const sectionRows = rows
    .filter((row) => classifyBalanceBucket(row.cuenta, row.saldo) === bucket)
    .map((row) => ({
      cuenta: row.cuenta,
      label: row.label,
      amount: balanceAmount(row.cuenta, row.saldo, bucket),
      level: row.level,
    }))
    .filter((row) => row.amount !== 0)

  return {
    title,
    rows: sectionRows,
    subtotal: round2(sectionRows.reduce((sum, row) => sum + row.amount, 0)),
  }
}

export async function buildBalanceReport(query: LedgerQuery): Promise<BalanceReportData> {
  const balances = await fetchAccountBalances(query)
  const meta = await buildReportMeta(
    query.companyId,
    "Balance de Situación",
    query.year,
    query.fromMonth,
    query.toMonth,
  )

  const activo = [
    buildSection("A) Activo no corriente", balances, "activo_nc"),
    buildSection("B) Activo corriente", balances, "activo_c"),
  ].filter((section) => section.rows.length > 0)

  const pasivo = [
    buildSection("A) Patrimonio neto", balances, "patrimonio"),
    buildSection("B) Pasivo no corriente", balances, "pasivo_nc"),
    buildSection("C) Pasivo corriente", balances, "pasivo_c"),
  ].filter((section) => section.rows.length > 0)

  const totalActivo = round2(activo.reduce((sum, section) => sum + section.subtotal, 0))
  const totalPasivo = round2(pasivo.reduce((sum, section) => sum + section.subtotal, 0))

  return { meta, activo, pasivo, totalActivo, totalPasivo }
}
