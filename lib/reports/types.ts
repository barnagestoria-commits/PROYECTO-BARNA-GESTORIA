export type ReportType = "balance" | "sumas-saldos" | "pyg"

export interface AccountBalance {
  cuenta: string
  label: string
  totalDebe: number
  totalHaber: number
  saldo: number
  level: number
}

export interface ReportMeta {
  companyName: string
  companyCif: string | null
  year: number
  periodLabel: string
  reportTitle: string
  generatedAt: Date
}

export interface BalanceSection {
  title: string
  rows: Array<{ cuenta: string; label: string; amount: number; level: number }>
  subtotal: number
}

export interface BalanceReportData {
  meta: ReportMeta
  activo: BalanceSection[]
  pasivo: BalanceSection[]
  totalActivo: number
  totalPasivo: number
}

export interface SumasSaldosReportData {
  meta: ReportMeta
  rows: AccountBalance[]
  totalDebe: number
  totalHaber: number
}

export interface PygSection {
  title: string
  rows: Array<{ cuenta: string; label: string; amount: number; level: number }>
  subtotal: number
}

export interface PygReportData {
  meta: ReportMeta
  ingresos: PygSection[]
  gastos: PygSection[]
  totalIngresos: number
  totalGastos: number
  resultado: number
}

export const REPORT_LABELS: Record<ReportType, string> = {
  balance: "Balance de Situación",
  "sumas-saldos": "Sumas y Saldos",
  pyg: "Pérdidas y Ganancias",
}
