import type { StatementColumn } from "@/lib/reports/statement-layout"

export type { StatementColumn }
export type ReportType = "balance" | "sumas-saldos" | "pyg"

export interface AccountBalance {
  cuenta: string
  label: string
  totalDebe: number
  totalHaber: number
  saldo: number
  level: number
  cif?: string | null
}

export interface ReportMeta {
  companyName: string
  companyCif: string | null
  year: number
  compareYear?: number | null
  columns?: StatementColumn[]
  periodLabel: string
  reportTitle: string
  generatedAt: Date
}

export interface StatementRow {
  cuenta: string
  label: string
  amount: number
  compareAmount?: number
  values?: Array<number | null>
  level: number
}

export interface BalanceSection {
  title: string
  rows: StatementRow[]
  subtotal: number
  compareSubtotal?: number
  subtotals?: Array<number | null>
}

export interface BalanceReportData {
  meta: ReportMeta
  activo: BalanceSection[]
  pasivo: BalanceSection[]
  totalActivo: number
  totalPasivo: number
  totalActivoCompare?: number
  totalPasivoCompare?: number
  totalActivoValues?: Array<number | null>
  totalPasivoValues?: Array<number | null>
}

export interface SumasSaldosReportData {
  meta: ReportMeta
  rows: AccountBalance[]
  totalDebe: number
  totalHaber: number
}

export interface PygSection {
  title: string
  rows: StatementRow[]
  subtotal: number
  compareSubtotal?: number
  subtotals?: Array<number | null>
}

export interface PygReportData {
  meta: ReportMeta
  ingresos: PygSection[]
  gastos: PygSection[]
  totalIngresos: number
  totalGastos: number
  resultado: number
  totalIngresosCompare?: number
  totalGastosCompare?: number
  resultadoCompare?: number
  totalIngresosValues?: Array<number | null>
  totalGastosValues?: Array<number | null>
  resultadoValues?: Array<number | null>
}

export const REPORT_LABELS: Record<ReportType, string> = {
  balance: "Balance de Situación",
  "sumas-saldos": "Sumas y Saldos",
  pyg: "Pérdidas y Ganancias",
}
