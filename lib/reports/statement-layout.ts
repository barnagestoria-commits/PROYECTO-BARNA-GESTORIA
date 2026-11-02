import { round2 } from "@/lib/reports/format"

export type ReportBreakdown = "anual" | "trimestral" | "mensual"
export type CostCenterListing = "consolidado" | "centro" | "por-centros"

export interface StatementColumn {
  id: string
  label: string
  kind: "amount" | "percent" | "sum"
  /** Columnas de importe que se suman. Solo en kind "sum". */
  sourceIndexes?: number[]
  currentIndex?: number
  baseIndex?: number
  /** Se oculta si todo el informe queda a cero (resto sin centro). */
  optional?: boolean
}

export interface StatementSlice {
  id: string
  year: number
  fromMonth: number
  toMonth: number
  costCenterId?: string
  unassignedOnly?: boolean
}

export interface StatementLayoutInput {
  kind: "balance" | "pyg"
  year: number
  compareYears: number[]
  breakdown: ReportBreakdown
  fromMonth: number
  toMonth: number
  costCenterListing: CostCenterListing
  costCenters?: Array<{ id: string; code: string; name: string }>
  costCenterId?: string
}

export interface StatementLayout {
  columns: StatementColumn[]
  slices: StatementSlice[]
  compareYear: number | null
  periodLabel: string
}

export interface ColumnSourceRow {
  cuenta: string
  label: string
  level: number
  amount: number
}

const MONTH_LABELS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
const QUARTERS = [
  { label: "1T", from: 1, to: 3 },
  { label: "2T", from: 4, to: 6 },
  { label: "3T", from: 7, to: 9 },
  { label: "4T", from: 10, to: 12 },
]

export function changePercent(current: number, base: number): number | null {
  if (base === 0) return current === 0 ? 0 : null
  return round2(((current - base) / Math.abs(base)) * 100)
}

function uniqueYears(year: number, compareYears: number[]): number[] {
  return [...new Set(compareYears.filter((value) => value !== year && value >= 2000 && value <= 2100))].sort(
    (a, b) => b - a,
  )
}

function periodsOf(breakdown: ReportBreakdown, year: number, fromMonth: number, toMonth: number) {
  if (breakdown === "trimestral") {
    return QUARTERS.filter((quarter) => quarter.to >= fromMonth && quarter.from <= toMonth).map((quarter) => ({
      id: `${year}-${quarter.label}`,
      label: quarter.label,
      from: Math.max(quarter.from, fromMonth),
      to: Math.min(quarter.to, toMonth),
      end: Math.min(quarter.to, toMonth),
    }))
  }
  if (breakdown === "mensual") {
    const periods = []
    for (let month = fromMonth; month <= toMonth; month += 1) {
      periods.push({
        id: `${year}-m${month}`,
        label: MONTH_LABELS[month - 1] ?? String(month),
        from: month,
        to: month,
        end: month,
      })
    }
    return periods
  }
  return [
    {
      id: `year-${year}`,
      label: String(year),
      from: fromMonth,
      to: toMonth,
      end: toMonth,
    },
  ]
}

function sliceMonths(
  kind: "balance" | "pyg",
  period: { from: number; end: number },
): { fromMonth: number; toMonth: number } {
  if (kind === "balance") return { fromMonth: 1, toMonth: period.end }
  return { fromMonth: period.from, toMonth: period.end }
}

function amountColumn(id: string, label: string, optional = false): StatementColumn {
  return { id, label, kind: "amount", optional }
}

function percentColumn(id: string, label: string, currentIndex: number, baseIndex: number): StatementColumn {
  return { id, label, kind: "percent", currentIndex, baseIndex }
}

function pushSlice(
  slices: StatementSlice[],
  slice: StatementSlice,
): void {
  slices.push(slice)
}

function periodLabelFor(input: StatementLayoutInput, compareYears: number[]): string {
  const range =
    input.kind === "balance" && (input.fromMonth !== 1 || input.toMonth !== 12)
      ? `Saldo a ${String(input.toMonth).padStart(2, "0")}/${input.year}`
      : input.fromMonth === 1 && input.toMonth === 12
        ? `Ejercicio ${input.year}`
        : `${String(input.fromMonth).padStart(2, "0")}/${input.year} — ${String(input.toMonth).padStart(2, "0")}/${input.year}`
  const parts = [range]
  if (input.costCenterListing === "por-centros") parts.push("por centros de coste")
  else if (input.breakdown === "trimestral") parts.push("trimestral")
  else if (input.breakdown === "mensual") parts.push("mensual")
  if (compareYears.length === 1) parts.push(`comparativa ${compareYears[0]}`)
  if (compareYears.length > 1) parts.push(`comparativa ${compareYears.join(", ")}`)
  return parts.join(" · ")
}

function layoutByCostCenters(input: StatementLayoutInput, compareYears: number[]): StatementLayout {
  const centers = input.costCenters ?? []
  const columns: StatementColumn[] = []
  const slices: StatementSlice[] = []
  const range = { fromMonth: input.fromMonth, toMonth: input.toMonth }

  for (const center of centers) {
    const id = `center-${center.id}`
    columns.push(amountColumn(id, `${center.code} ${center.name}`.trim()))
    pushSlice(slices, { id, year: input.year, ...range, costCenterId: center.id })
  }

  const unassignedId = "sin-centro"
  columns.push(amountColumn(unassignedId, "Sin centro", true))
  pushSlice(slices, { id: unassignedId, year: input.year, ...range, unassignedOnly: true })

  const totalId = `total-${input.year}`
  columns.push(amountColumn(totalId, `Total ${input.year}`))
  pushSlice(slices, { id: totalId, year: input.year, ...range })
  const totalIndex = columns.length - 1

  for (const compareYear of compareYears) {
    const id = `year-${compareYear}`
    const amountIndex = columns.length + 1
    columns.push(percentColumn(`pct-${totalId}-${id}`, `% vs ${compareYear}`, totalIndex, amountIndex))
    columns.push(amountColumn(id, String(compareYear)))
    pushSlice(slices, { id, year: compareYear, ...range })
  }

  return {
    columns,
    slices,
    compareYear: compareYears[0] ?? null,
    periodLabel: periodLabelFor(input, compareYears),
  }
}

function layoutByPeriods(input: StatementLayoutInput, compareYears: number[]): StatementLayout {
  const columns: StatementColumn[] = []
  const slices: StatementSlice[] = []
  const costCenterId = input.costCenterListing === "centro" ? input.costCenterId : undefined
  const primary = periodsOf(input.breakdown, input.year, input.fromMonth, input.toMonth)
  const pairQuarters = input.breakdown === "trimestral" && compareYears.length === 1
  const nearest = pairQuarters ? compareYears[0] : null
  const paired = nearest ? periodsOf(input.breakdown, nearest, input.fromMonth, input.toMonth) : []
  const primaryIndexes: number[] = []
  const pairedIndexes: number[] = []

  primary.forEach((period, index) => {
    const months = sliceMonths(input.kind, period)
    columns.push(amountColumn(period.id, nearest ? `${period.label} ${input.year}` : period.label))
    primaryIndexes.push(columns.length - 1)
    pushSlice(slices, { id: period.id, year: input.year, ...months, costCenterId })

    const other = paired[index]
    if (nearest && other) {
      const otherMonths = sliceMonths(input.kind, other)
      const currentIndex = columns.length - 1
      const baseIndex = columns.length
      columns.push(amountColumn(other.id, `${other.label} ${nearest}`))
      pairedIndexes.push(columns.length - 1)
      pushSlice(slices, { id: other.id, year: nearest, ...otherMonths, costCenterId })
      columns.push(percentColumn(`pct-${period.id}`, `% ${period.label}`, currentIndex, baseIndex))
    }
  })

  const extraYears = nearest ? compareYears.slice(1) : compareYears
  const closeIndex = primaryIndexes[primaryIndexes.length - 1] ?? 0

  if (input.kind === "pyg" && primaryIndexes.length > 1) {
    columns.push({
      id: `sum-${input.year}`,
      label: nearest ? `Total ${input.year}` : "Total",
      kind: "sum",
      sourceIndexes: [...primaryIndexes],
    })
    const primaryTotalIndex = columns.length - 1
    if (nearest && pairedIndexes.length > 1) {
      const baseIndex = columns.length
      columns.push({
        id: `sum-${nearest}`,
        label: `Total ${nearest}`,
        kind: "sum",
        sourceIndexes: [...pairedIndexes],
      })
      columns.push(percentColumn(`pct-total-${nearest}`, `% vs ${nearest}`, primaryTotalIndex, baseIndex))
    }
    for (const compareYear of extraYears) {
      const id = `year-${compareYear}`
      const amountIndex = columns.length + 1
      columns.push(percentColumn(`pct-total-${id}`, `% vs ${compareYear}`, primaryTotalIndex, amountIndex))
      columns.push(amountColumn(id, String(compareYear)))
      pushSlice(slices, {
        id,
        year: compareYear,
        fromMonth: input.fromMonth,
        toMonth: input.toMonth,
        costCenterId,
      })
    }
  } else {
    for (const compareYear of extraYears) {
      const id = `year-${compareYear}`
      const amountIndex = columns.length + 1
      columns.push(percentColumn(`pct-${closeIndex}-${id}`, `% vs ${compareYear}`, closeIndex, amountIndex))
      columns.push(amountColumn(id, String(compareYear)))
      const end = input.kind === "balance" ? input.toMonth : input.toMonth
      const fromMonth = input.kind === "balance" ? 1 : input.fromMonth
      pushSlice(slices, { id, year: compareYear, fromMonth, toMonth: end, costCenterId })
    }
  }

  const singleAmount = columns.filter((column) => column.kind === "amount").length === 1
  if (singleAmount && columns[0]) columns[0].label = "Importe"

  return {
    columns,
    slices,
    compareYear: compareYears[0] ?? null,
    periodLabel: periodLabelFor(input, compareYears),
  }
}

export function buildStatementLayout(input: StatementLayoutInput): StatementLayout {
  const fromMonth = Math.min(Math.max(input.fromMonth, 1), 12)
  const toMonth = Math.min(Math.max(input.toMonth, fromMonth), 12)
  const normalized: StatementLayoutInput = { ...input, fromMonth, toMonth }
  const compareYears = uniqueYears(input.year, input.compareYears)
  if (input.costCenterListing === "por-centros" && (input.costCenters?.length ?? 0) > 0) {
    return layoutByCostCenters(normalized, compareYears)
  }
  return layoutByPeriods(normalized, compareYears)
}

export function fillDerivedColumns(columns: StatementColumn[], values: Array<number | null>): Array<number | null> {
  const next = [...values]
  for (const [index, column] of columns.entries()) {
    if (column.kind !== "sum") continue
    next[index] = round2((column.sourceIndexes ?? []).reduce((sum, source) => sum + (next[source] ?? 0), 0))
  }
  for (const [index, column] of columns.entries()) {
    if (column.kind !== "percent" || column.currentIndex === undefined || column.baseIndex === undefined) continue
    next[index] = changePercent(next[column.currentIndex] ?? 0, next[column.baseIndex] ?? 0)
  }
  return next
}

export function mergeColumnRows(
  columns: StatementColumn[],
  slices: Map<string, ColumnSourceRow[]>,
): {
  rows: Array<ColumnSourceRow & { amount: number; compareAmount?: number; values: Array<number | null> }>
  totals: Array<number | null>
} {
  const byAccount = new Map<string, { cuenta: string; label: string; level: number; amounts: Map<string, number> }>()

  for (const column of columns) {
    if (column.kind !== "amount") continue
    for (const row of slices.get(column.id) ?? []) {
      const current = byAccount.get(row.cuenta) ?? {
        cuenta: row.cuenta,
        label: row.label,
        level: row.level,
        amounts: new Map<string, number>(),
      }
      if (!current.label) current.label = row.label
      current.amounts.set(column.id, row.amount)
      byAccount.set(row.cuenta, current)
    }
  }

  const rows = [...byAccount.values()]
    .map((row) => {
      const seeded = columns.map((column) => (column.kind === "amount" ? row.amounts.get(column.id) ?? 0 : null))
      const values = fillDerivedColumns(columns, seeded)
      const hasAmount = columns.some((column, index) => column.kind === "amount" && (values[index] ?? 0) !== 0)
      if (!hasAmount) return null
      return {
        cuenta: row.cuenta,
        label: row.label,
        level: row.level,
        amount: firstAmount(columns, values),
        compareAmount: firstCompareAmount(columns, values),
        values,
      }
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => a.cuenta.localeCompare(b.cuenta))

  const amountTotals = columns.map(() => 0 as number | null)
  for (const row of rows) {
    columns.forEach((column, index) => {
      if (column.kind !== "amount") return
      amountTotals[index] = round2((amountTotals[index] ?? 0) + (row.values[index] ?? 0))
    })
  }

  return { rows, totals: fillDerivedColumns(columns, amountTotals) }
}

export function combineAmountTotals(
  columns: StatementColumn[],
  sectionTotals: Array<Array<number | null>>,
): Array<number | null> {
  const values = columns.map(() => 0 as number | null)
  for (const section of sectionTotals) {
    columns.forEach((column, index) => {
      if (column.kind !== "amount") return
      values[index] = round2((values[index] ?? 0) + (section[index] ?? 0))
    })
  }
  return fillDerivedColumns(columns, values)
}

export function subtractAmountTotals(
  columns: StatementColumn[],
  left: Array<number | null>,
  right: Array<number | null>,
): Array<number | null> {
  const values = columns.map((column, index) => {
    if (column.kind === "percent") return null
    return round2((left[index] ?? 0) - (right[index] ?? 0))
  })
  return fillDerivedColumns(columns, values)
}

function firstAmount(columns: StatementColumn[], values: Array<number | null>): number {
  const index = columns.findIndex((column) => column.kind === "amount")
  return index >= 0 ? values[index] ?? 0 : 0
}

function firstCompareAmount(columns: StatementColumn[], values: Array<number | null>): number | undefined {
  const percent = columns.find((column) => column.kind === "percent")
  if (!percent || percent.baseIndex === undefined) return undefined
  return values[percent.baseIndex] ?? 0
}

export function pruneOptionalColumns<T extends { values?: Array<number | null> }>(
  columns: StatementColumn[],
  groups: Array<{ rows: T[]; totals: Array<number | null> }>,
): { columns: StatementColumn[]; groups: Array<{ rows: T[]; totals: Array<number | null> }> } {
  const drop = new Set<number>()
  columns.forEach((column, index) => {
    if (!column.optional) return
    const empty = groups.every((group) => (group.totals[index] ?? 0) === 0)
    if (empty) drop.add(index)
  })
  if (drop.size === 0) return { columns, groups }

  const kept = columns.map((_, index) => index).filter((index) => !drop.has(index))
  const remap = new Map(kept.map((oldIndex, newIndex) => [oldIndex, newIndex]))
  const nextColumns = kept.map((oldIndex) => {
    const column = columns[oldIndex]
    return {
      ...column,
      sourceIndexes: column.sourceIndexes?.map((source) => remap.get(source) ?? source),
      currentIndex: column.currentIndex === undefined ? undefined : remap.get(column.currentIndex),
      baseIndex: column.baseIndex === undefined ? undefined : remap.get(column.baseIndex),
    }
  })
  const nextGroups = groups.map((group) => ({
    rows: group.rows.map((row) => ({
      ...row,
      values: kept.map((index) => row.values?.[index] ?? null),
    })),
    totals: kept.map((index) => group.totals[index] ?? null),
  }))
  return { columns: nextColumns, groups: nextGroups }
}
