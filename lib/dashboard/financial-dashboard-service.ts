import { prisma } from "@/lib/db"
import { decimalToNumber } from "@/lib/prisma/decimal"
import { getAccountLabel } from "@/lib/reports/pgc-labels"
import { normalizeCuenta, round2 } from "@/lib/reports/format"
import {
  EXPENSE_COLORS,
  createEmptyFinancialDashboardData,
  monthLabel,
  type DateRangeKey,
  type ExpenseCategorySlice,
  type FinancialAlert,
  type FinancialDashboardData,
  type KpiMetric,
  type MonthlyEvolutionPoint,
  type RecentTransaction,
} from "@/lib/dashboard/financial-dashboard-data"

interface PeriodBounds {
  start: Date
  end: Date
}

interface ResolvedRange {
  key: DateRangeKey
  label: string
  current: PeriodBounds
  previous: PeriodBounds
  evolutionMonths: Array<{ year: number; month: number }>
}

interface LineRow {
  cuenta: string
  debe: number
  haber: number
  fecha: Date
  entryId: string
  refNumber: number
  invoiceNumber: string | null
  concepto: string
}

function startOfMonth(year: number, month: number): Date {
  return new Date(`${year}-${String(month).padStart(2, "0")}-01T00:00:00.000Z`)
}

function endOfMonth(year: number, month: number): Date {
  const day = new Date(year, month, 0).getDate()
  return new Date(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T23:59:59.999Z`)
}

function resolveRange(key: DateRangeKey, now = new Date()): ResolvedRange {
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const currentQuarter = Math.ceil(month / 3)

  if (key === "this_month") {
    const previousMonth = month === 1 ? 12 : month - 1
    const previousYear = month === 1 ? year - 1 : year

    return {
      key,
      label: "Este mes",
      current: { start: startOfMonth(year, month), end: endOfMonth(year, month) },
      previous: {
        start: startOfMonth(previousYear, previousMonth),
        end: endOfMonth(previousYear, previousMonth),
      },
      evolutionMonths: Array.from({ length: month }, (_, index) => ({
        year,
        month: index + 1,
      })),
    }
  }

  if (key === "last_quarter") {
    const quarter = currentQuarter === 1 ? 4 : currentQuarter - 1
    const quarterYear = currentQuarter === 1 ? year - 1 : year
    const startMonth = (quarter - 1) * 3 + 1
    const endMonth = startMonth + 2

    const previousQuarter = quarter === 1 ? 4 : quarter - 1
    const previousQuarterYear = quarter === 1 ? quarterYear - 1 : quarterYear
    const previousStartMonth = (previousQuarter - 1) * 3 + 1

    return {
      key,
      label: "Último trimestre",
      current: {
        start: startOfMonth(quarterYear, startMonth),
        end: endOfMonth(quarterYear, endMonth),
      },
      previous: {
        start: startOfMonth(previousQuarterYear, previousStartMonth),
        end: endOfMonth(previousQuarterYear, previousStartMonth + 2),
      },
      evolutionMonths: [
        { year: quarterYear, month: startMonth },
        { year: quarterYear, month: startMonth + 1 },
        { year: quarterYear, month: endMonth },
      ],
    }
  }

  const previousYear = year - 1
  const previousEndMonth = month

  return {
    key,
    label: "Año actual",
    current: { start: startOfMonth(year, 1), end: endOfMonth(year, month) },
    previous: {
      start: startOfMonth(previousYear, 1),
      end: endOfMonth(previousYear, previousEndMonth),
    },
    evolutionMonths: Array.from({ length: month }, (_, index) => ({
      year,
      month: index + 1,
    })),
  }
}

function isWithinPeriod(date: Date, period: PeriodBounds): boolean {
  return date >= period.start && date <= period.end
}

function ingresoAmount(debe: number, haber: number): number {
  return round2(haber - debe)
}

function gastoAmount(debe: number, haber: number): number {
  return round2(debe - haber)
}

function isIngresoAccount(cuenta: string): boolean {
  return normalizeCuenta(cuenta).startsWith("7")
}

function isGastoAccount(cuenta: string): boolean {
  return normalizeCuenta(cuenta).startsWith("6")
}

function isClientAccount(cuenta: string): boolean {
  const digits = normalizeCuenta(cuenta)
  return digits.startsWith("430") || digits.startsWith("431") || digits.startsWith("438")
}

function isSupplierAccount(cuenta: string): boolean {
  const digits = normalizeCuenta(cuenta)
  return digits.startsWith("400") || digits.startsWith("410")
}

function computeChangePercent(current: number, previous: number): number {
  if (current === 0 && previous === 0) return 0
  if (previous === 0) return 100
  return round2(((current - previous) / Math.abs(previous)) * 100)
}

function sumIngresos(lines: LineRow[], period: PeriodBounds): number {
  return round2(
    lines
      .filter((line) => isIngresoAccount(line.cuenta) && isWithinPeriod(line.fecha, period))
      .reduce((sum, line) => sum + ingresoAmount(line.debe, line.haber), 0),
  )
}

function sumGastos(lines: LineRow[], period: PeriodBounds): number {
  return round2(
    lines
      .filter((line) => isGastoAccount(line.cuenta) && isWithinPeriod(line.fecha, period))
      .reduce((sum, line) => sum + gastoAmount(line.debe, line.haber), 0),
  )
}

function buildKpi(label: string, value: number, previous: number, extra?: Partial<KpiMetric>): KpiMetric {
  return {
    label,
    value,
    changePercent: computeChangePercent(value, previous),
    ...extra,
  }
}

function buildEvolution(lines: LineRow[], months: Array<{ year: number; month: number }>): MonthlyEvolutionPoint[] {
  return months.map(({ year, month }) => {
    const period = { start: startOfMonth(year, month), end: endOfMonth(year, month) }
    return {
      month: monthLabel(month - 1),
      ingresos: sumIngresos(lines, period),
      gastos: sumGastos(lines, period),
    }
  })
}

function buildExpenseCategories(lines: LineRow[], period: PeriodBounds): ExpenseCategorySlice[] {
  const totals = new Map<string, number>()

  for (const line of lines) {
    if (!isGastoAccount(line.cuenta) || !isWithinPeriod(line.fecha, period)) continue

    const subgroup = normalizeCuenta(line.cuenta).slice(0, 2)
    if (!subgroup.startsWith("6")) continue

    const amount = gastoAmount(line.debe, line.haber)
    if (amount === 0) continue

    totals.set(subgroup, round2((totals.get(subgroup) ?? 0) + amount))
  }

  const sorted = [...totals.entries()]
    .map(([subgroup, value]) => ({
      name: getAccountLabel(subgroup),
      value,
    }))
    .sort((a, b) => b.value - a.value)

  if (sorted.length === 0) return []

  const top = sorted.slice(0, 4)
  const rest = sorted.slice(4)
  const otrosValue = round2(rest.reduce((sum, item) => sum + item.value, 0))

  const slices: ExpenseCategorySlice[] = top.map((item, index) => ({
    name: item.name,
    value: item.value,
    color: EXPENSE_COLORS[index % EXPENSE_COLORS.length],
  }))

  if (otrosValue > 0) {
    slices.push({
      name: "Otros",
      value: otrosValue,
      color: EXPENSE_COLORS[4],
    })
  }

  return slices
}

function computePending(lines: LineRow[]): { total: number; count: number } {
  const balances = new Map<string, number>()

  for (const line of lines) {
    const cuenta = normalizeCuenta(line.cuenta)
    if (!isClientAccount(cuenta) && !isSupplierAccount(cuenta)) continue

    const current = balances.get(cuenta) ?? 0
    balances.set(cuenta, round2(current + line.debe - line.haber))
  }

  let total = 0
  let count = 0

  for (const [cuenta, saldo] of balances) {
    const pending = isClientAccount(cuenta)
      ? saldo > 0
        ? saldo
        : 0
      : saldo < 0
        ? round2(Math.abs(saldo))
        : 0

    if (pending > 0) {
      total = round2(total + pending)
      count += 1
    }
  }

  return { total, count }
}

function buildRecentTransactions(
  lines: LineRow[],
  thirdPartyNames: Map<string, string>,
): RecentTransaction[] {
  const byEntry = new Map<string, LineRow[]>()

  for (const line of lines) {
    const current = byEntry.get(line.entryId) ?? []
    current.push(line)
    byEntry.set(line.entryId, current)
  }

  const entries = [...byEntry.values()]
    .map((entryLines) => {
      const sample = entryLines[0]
      const ingresos = entryLines
        .filter((line) => isIngresoAccount(line.cuenta))
        .reduce((sum, line) => sum + ingresoAmount(line.debe, line.haber), 0)
      const gastos = entryLines
        .filter((line) => isGastoAccount(line.cuenta))
        .reduce((sum, line) => sum + gastoAmount(line.debe, line.haber), 0)

      const thirdPartyLine = entryLines.find(
        (line) => isClientAccount(line.cuenta) || isSupplierAccount(line.cuenta),
      )
      const thirdPartyAccount = thirdPartyLine ? normalizeCuenta(thirdPartyLine.cuenta) : null
      const counterparty =
        (thirdPartyAccount && thirdPartyNames.get(thirdPartyAccount)) ||
        thirdPartyLine?.concepto ||
        sample.concepto ||
        "Sin tercero"

      const type: RecentTransaction["type"] = ingresos >= gastos ? "ingreso" : "gasto"
      const amount = type === "ingreso" ? round2(ingresos) : round2(-gastos)

      return {
        id: sample.entryId,
        counterparty,
        date: sample.fecha.toISOString().split("T")[0],
        amount,
        type,
        status: "pagada" as const,
        reference: sample.invoiceNumber ?? `Asiento ${sample.refNumber}`,
        sortDate: sample.fecha,
        sortRef: sample.refNumber,
      }
    })
    .filter((entry) => entry.amount !== 0)
    .sort((a, b) => {
      const dateDiff = b.sortDate.getTime() - a.sortDate.getTime()
      if (dateDiff !== 0) return dateDiff
      return b.sortRef - a.sortRef
    })
    .slice(0, 8)
    .map(({ sortDate: _sortDate, sortRef: _sortRef, ...entry }) => entry)

  return entries
}

async function buildFiscalAlerts(companyId: string, year: number, quarter: number): Promise<FinancialAlert[]> {
  const declarations = await prisma.fiscalDeclaration.findMany({
    where: {
      companyId,
      year,
      quarter,
      status: "PENDIENTE",
    },
    take: 3,
  })

  if (declarations.length === 0) return []

  const labels: Record<string, string> = {
    M111: "Modelo 111",
    M115: "Modelo 115",
    M123: "Modelo 123",
    M180: "Modelo 180",
    M190: "Modelo 190",
    M303: "Modelo 303",
    M347: "Modelo 347",
    M349: "Modelo 349",
    M390: "Modelo 390",
  }

  return declarations.map((declaration) => ({
    id: declaration.id,
    severity: "warning" as const,
    title: `${labels[declaration.modelCode] ?? declaration.modelCode} pendiente`,
    description: `Revisa el borrador del ${quarter}T ${year} antes de presentarlo.`,
  }))
}

async function fetchRecentEntryLines(companyId: string, limit: number): Promise<LineRow[]> {
  const entries = await prisma.accountingEntry.findMany({
    where: { companyId },
    orderBy: [{ fecha: "desc" }, { refNumber: "desc" }],
    take: limit,
    select: { id: true },
  })

  if (entries.length === 0) return []

  const lines = await prisma.entryLine.findMany({
    where: { entryId: { in: entries.map((entry) => entry.id) } },
    select: {
      cuenta: true,
      debe: true,
      haber: true,
      concepto: true,
      entry: {
        select: {
          id: true,
          refNumber: true,
          fecha: true,
          invoiceNumber: true,
        },
      },
    },
    orderBy: [{ entry: { fecha: "desc" } }, { sortOrder: "asc" }],
  })

  return lines.map((line) => ({
    cuenta: line.cuenta,
    debe: decimalToNumber(line.debe),
    haber: decimalToNumber(line.haber),
    concepto: line.concepto,
    fecha: line.entry.fecha,
    entryId: line.entry.id,
    refNumber: line.entry.refNumber,
    invoiceNumber: line.entry.invoiceNumber,
  }))
}

async function fetchLines(companyId: string, from: Date, to: Date): Promise<LineRow[]> {
  const lines = await prisma.entryLine.findMany({
    where: {
      entry: {
        companyId,
        fecha: { gte: from, lte: to },
      },
    },
    select: {
      cuenta: true,
      debe: true,
      haber: true,
      concepto: true,
      entry: {
        select: {
          id: true,
          refNumber: true,
          fecha: true,
          invoiceNumber: true,
        },
      },
    },
    orderBy: [{ entry: { fecha: "desc" } }, { sortOrder: "asc" }],
  })

  return lines.map((line) => ({
    cuenta: line.cuenta,
    debe: decimalToNumber(line.debe),
    haber: decimalToNumber(line.haber),
    concepto: line.concepto,
    fecha: line.entry.fecha,
    entryId: line.entry.id,
    refNumber: line.entry.refNumber,
    invoiceNumber: line.entry.invoiceNumber,
  }))
}

export async function buildFinancialDashboardData(
  companyId: string,
  rangeKey: DateRangeKey,
): Promise<FinancialDashboardData> {
  const entryCount = await prisma.accountingEntry.count({ where: { companyId } })
  if (entryCount === 0) {
    return createEmptyFinancialDashboardData(rangeKey)
  }

  const resolved = resolveRange(rangeKey)
  const fetchFrom = resolved.previous.start < resolved.current.start
    ? resolved.previous.start
    : resolved.current.start
  const fetchTo = resolved.current.end

  const [lines, recentLines, thirdParties] = await Promise.all([
    fetchLines(companyId, fetchFrom, fetchTo),
    fetchRecentEntryLines(companyId, 8),
    prisma.thirdParty.findMany({
      where: { companyId },
      select: { accountCode: true, name: true },
    }),
  ])

  const thirdPartyNames = new Map(
    thirdParties.map((party) => [normalizeCuenta(party.accountCode), party.name]),
  )

  const allLinesForPending = await fetchLines(
    companyId,
    new Date("2000-01-01T00:00:00.000Z"),
    new Date(),
  )

  const ingresos = sumIngresos(lines, resolved.current)
  const gastos = sumGastos(lines, resolved.current)
  const previousIngresos = sumIngresos(lines, resolved.previous)
  const previousGastos = sumGastos(lines, resolved.previous)
  const beneficio = round2(ingresos - gastos)
  const previousBeneficio = round2(previousIngresos - previousGastos)
  const pending = computePending(allLinesForPending)

  const currentYear = new Date().getFullYear()
  const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3)
  const alerts = await buildFiscalAlerts(companyId, currentYear, currentQuarter)

  return {
    rangeLabel: resolved.label,
    kpis: {
      ingresos: buildKpi("Ingresos totales", ingresos, previousIngresos),
      gastos: buildKpi("Gastos totales", gastos, previousGastos),
      beneficio: buildKpi("Beneficio neto", beneficio, previousBeneficio),
      pendientes: {
        label: "Facturas pendientes",
        value: pending.total,
        changePercent: 0,
        count: pending.count,
        subtitle: "cobro y pago",
      },
    },
    evolution: buildEvolution(lines, resolved.evolutionMonths),
    expenseCategories: buildExpenseCategories(lines, resolved.current),
    transactions: buildRecentTransactions(recentLines, thirdPartyNames),
    alerts,
  }
}
