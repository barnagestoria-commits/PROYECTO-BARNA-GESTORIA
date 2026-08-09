export type DateRangeKey = "this_month" | "last_quarter" | "this_year"

export interface KpiMetric {
  label: string
  value: number
  changePercent: number
  subtitle?: string
  count?: number
}

export interface MonthlyEvolutionPoint {
  month: string
  ingresos: number
  gastos: number
}

export interface ExpenseCategorySlice {
  name: string
  value: number
  color: string
}

export interface RecentTransaction {
  id: string
  counterparty: string
  date: string
  amount: number
  type: "ingreso" | "gasto"
  status: "pagada" | "pendiente" | "cancelada"
  reference: string
}

export interface FinancialAlert {
  id: string
  severity: "info" | "warning" | "urgent"
  title: string
  description: string
}

export interface FinancialDashboardData {
  rangeLabel: string
  kpis: {
    ingresos: KpiMetric
    gastos: KpiMetric
    beneficio: KpiMetric
    pendientes: KpiMetric
  }
  evolution: MonthlyEvolutionPoint[]
  expenseCategories: ExpenseCategorySlice[]
  transactions: RecentTransaction[]
  alerts: FinancialAlert[]
}

export const EXPENSE_COLORS = ["#145A32", "#0F3D2E", "#C2A878", "#2C2C2C", "#57b67d"]

export const DATE_RANGE_OPTIONS: { value: DateRangeKey; label: string }[] = [
  { value: "this_month", label: "Este mes" },
  { value: "last_quarter", label: "Último trimestre" },
  { value: "this_year", label: "Año actual" },
]

const MONTH_LABELS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]

export function monthLabel(monthIndex: number): string {
  return MONTH_LABELS[monthIndex] ?? ""
}

export function createEmptyFinancialDashboardData(range: DateRangeKey): FinancialDashboardData {
  const rangeLabel = DATE_RANGE_OPTIONS.find((option) => option.value === range)?.label ?? ""

  const emptyKpi = (label: string): KpiMetric => ({
    label,
    value: 0,
    changePercent: 0,
  })

  return {
    rangeLabel,
    kpis: {
      ingresos: emptyKpi("Ingresos totales"),
      gastos: emptyKpi("Gastos totales"),
      beneficio: emptyKpi("Beneficio neto"),
      pendientes: {
        ...emptyKpi("Facturas pendientes"),
        count: 0,
        subtitle: "cobro y pago",
      },
    },
    evolution: [],
    expenseCategories: [],
    transactions: [],
    alerts: [],
  }
}

export function formatEuro(amount: number, options?: { signed?: boolean }): string {
  const formatted = new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Math.abs(amount))

  if (options?.signed && amount < 0) return `-${formatted}`
  if (options?.signed && amount > 0) return `+${formatted}`
  return formatted
}

export function formatPercent(value: number): string {
  const prefix = value > 0 ? "+" : ""
  return `${prefix}${value.toFixed(1)}%`
}
