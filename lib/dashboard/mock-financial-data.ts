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

const EXPENSE_COLORS = ["#145A32", "#0F3D2E", "#C2A878", "#2C2C2C", "#57b67d"]

const DATA_BY_RANGE: Record<DateRangeKey, FinancialDashboardData> = {
  this_month: {
    rangeLabel: "Este mes",
    kpis: {
      ingresos: { label: "Ingresos totales", value: 42850, changePercent: 12.4 },
      gastos: { label: "Gastos totales", value: 28120, changePercent: -3.8 },
      beneficio: { label: "Beneficio neto", value: 14730, changePercent: 18.2 },
      pendientes: {
        label: "Facturas pendientes",
        value: 9340,
        changePercent: 5.1,
        count: 7,
        subtitle: "cobro y pago",
      },
    },
    evolution: [
      { month: "Ene", ingresos: 31200, gastos: 22400 },
      { month: "Feb", ingresos: 29800, gastos: 24100 },
      { month: "Mar", ingresos: 35600, gastos: 22800 },
      { month: "Abr", ingresos: 33100, gastos: 25600 },
      { month: "May", ingresos: 38900, gastos: 23900 },
      { month: "Jun", ingresos: 42850, gastos: 28120 },
    ],
    expenseCategories: [
      { name: "Personal", value: 11200, color: EXPENSE_COLORS[0] },
      { name: "Suministros", value: 5400, color: EXPENSE_COLORS[1] },
      { name: "Impuestos", value: 4800, color: EXPENSE_COLORS[2] },
      { name: "Software", value: 3200, color: EXPENSE_COLORS[3] },
      { name: "Otros", value: 3520, color: EXPENSE_COLORS[4] },
    ],
    transactions: [
      {
        id: "1",
        counterparty: "Tech Solutions SL",
        date: "2026-07-18",
        amount: 4200,
        type: "ingreso",
        status: "pagada",
        reference: "FAC-2026-0142",
      },
      {
        id: "2",
        counterparty: "Suministros García",
        date: "2026-07-17",
        amount: -890,
        type: "gasto",
        status: "pagada",
        reference: "FAC-R-8831",
      },
      {
        id: "3",
        counterparty: "Cliente Innovación BC",
        date: "2026-07-15",
        amount: 3150,
        type: "ingreso",
        status: "pendiente",
        reference: "FAC-2026-0138",
      },
      {
        id: "4",
        counterparty: "Agencia Tributaria",
        date: "2026-07-12",
        amount: -2400,
        type: "gasto",
        status: "pagada",
        reference: "MOD-303",
      },
      {
        id: "5",
        counterparty: "Cloud Services Inc.",
        date: "2026-07-10",
        amount: -129,
        type: "gasto",
        status: "cancelada",
        reference: "SUB-772",
      },
    ],
    alerts: [
      {
        id: "a1",
        severity: "urgent",
        title: "Próximo vencimiento de IVA",
        description: "Modelo 303 — plazo límite: 20 de julio de 2026",
      },
      {
        id: "a2",
        severity: "warning",
        title: "3 facturas por conciliar",
        description: "Extracto bancario de julio pendiente de revisión",
      },
      {
        id: "a3",
        severity: "info",
        title: "Cierre trimestral",
        description: "Revisa el balance de sumas y saldos antes del 25/07",
      },
    ],
  },
  last_quarter: {
    rangeLabel: "Último trimestre",
    kpis: {
      ingresos: { label: "Ingresos totales", value: 118400, changePercent: 8.6 },
      gastos: { label: "Gastos totales", value: 79250, changePercent: 2.1 },
      beneficio: { label: "Beneficio neto", value: 39150, changePercent: 14.3 },
      pendientes: {
        label: "Facturas pendientes",
        value: 18600,
        changePercent: -4.2,
        count: 12,
        subtitle: "cobro y pago",
      },
    },
    evolution: [
      { month: "Abr", ingresos: 33100, gastos: 25600 },
      { month: "May", ingresos: 38900, gastos: 23900 },
      { month: "Jun", ingresos: 46400, gastos: 29750 },
    ],
    expenseCategories: [
      { name: "Personal", value: 33600, color: EXPENSE_COLORS[0] },
      { name: "Suministros", value: 14200, color: EXPENSE_COLORS[1] },
      { name: "Impuestos", value: 12800, color: EXPENSE_COLORS[2] },
      { name: "Software", value: 8900, color: EXPENSE_COLORS[3] },
      { name: "Otros", value: 9750, color: EXPENSE_COLORS[4] },
    ],
    transactions: [
      {
        id: "6",
        counterparty: "Distribuciones Norte",
        date: "2026-06-28",
        amount: 7800,
        type: "ingreso",
        status: "pagada",
        reference: "FAC-2026-0129",
      },
      {
        id: "7",
        counterparty: "Proveedor Logística",
        date: "2026-06-22",
        amount: -1650,
        type: "gasto",
        status: "pendiente",
        reference: "FAC-R-8710",
      },
      {
        id: "8",
        counterparty: "Consultoría Martínez",
        date: "2026-06-15",
        amount: 5200,
        type: "ingreso",
        status: "pagada",
        reference: "FAC-2026-0118",
      },
      {
        id: "9",
        counterparty: "Seguros Empresa",
        date: "2026-05-30",
        amount: -980,
        type: "gasto",
        status: "pagada",
        reference: "POL-2026",
      },
    ],
    alerts: [
      {
        id: "a4",
        severity: "warning",
        title: "Modelo 130 pendiente",
        description: "Pago fraccionado IRPF del 2T — revisar borrador",
      },
      {
        id: "a5",
        severity: "info",
        title: "Informe trimestral disponible",
        description: "PyG y balance del Q2 listos para exportar",
      },
    ],
  },
  this_year: {
    rangeLabel: "Año actual",
    kpis: {
      ingresos: { label: "Ingresos totales", value: 248600, changePercent: 15.7 },
      gastos: { label: "Gastos totales", value: 171400, changePercent: 6.4 },
      beneficio: { label: "Beneficio neto", value: 77200, changePercent: 22.1 },
      pendientes: {
        label: "Facturas pendientes",
        value: 22400,
        changePercent: 1.8,
        count: 15,
        subtitle: "cobro y pago",
      },
    },
    evolution: [
      { month: "Ene", ingresos: 31200, gastos: 22400 },
      { month: "Feb", ingresos: 29800, gastos: 24100 },
      { month: "Mar", ingresos: 35600, gastos: 22800 },
      { month: "Abr", ingresos: 33100, gastos: 25600 },
      { month: "May", ingresos: 38900, gastos: 23900 },
      { month: "Jun", ingresos: 46400, gastos: 29750 },
      { month: "Jul", ingresos: 42850, gastos: 28120 },
    ],
    expenseCategories: [
      { name: "Personal", value: 68400, color: EXPENSE_COLORS[0] },
      { name: "Suministros", value: 31200, color: EXPENSE_COLORS[1] },
      { name: "Impuestos", value: 28600, color: EXPENSE_COLORS[2] },
      { name: "Software", value: 19800, color: EXPENSE_COLORS[3] },
      { name: "Otros", value: 23400, color: EXPENSE_COLORS[4] },
    ],
    transactions: [
      {
        id: "10",
        counterparty: "Cliente Anual Premium",
        date: "2026-07-01",
        amount: 12000,
        type: "ingreso",
        status: "pagada",
        reference: "FAC-2026-0100",
      },
      {
        id: "11",
        counterparty: "Alquiler Oficina",
        date: "2026-06-01",
        amount: -1800,
        type: "gasto",
        status: "pagada",
        reference: "REC-JUN",
      },
      {
        id: "12",
        counterparty: "Startup Labs",
        date: "2026-05-18",
        amount: 6500,
        type: "ingreso",
        status: "pendiente",
        reference: "FAC-2026-0095",
      },
    ],
    alerts: [
      {
        id: "a6",
        severity: "info",
        title: "Objetivo anual al 58%",
        description: "Ingresos acumulados vs. previsión 2026",
      },
      {
        id: "a7",
        severity: "warning",
        title: "5 facturas vencidas",
        description: "Total pendiente de cobro: 8.420 €",
      },
    ],
  },
}

export const DATE_RANGE_OPTIONS: { value: DateRangeKey; label: string }[] = [
  { value: "this_month", label: "Este mes" },
  { value: "last_quarter", label: "Último trimestre" },
  { value: "this_year", label: "Año actual" },
]

export function getFinancialDashboardData(range: DateRangeKey): FinancialDashboardData {
  return DATA_BY_RANGE[range]
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
