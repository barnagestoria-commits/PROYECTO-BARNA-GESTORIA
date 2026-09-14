import type { AccountingPlanType, CompanyClientProfile } from "@prisma/client"
import { prisma } from "@/lib/db"
import { decimalToNumber } from "@/lib/prisma/decimal"
import {
  createDefaultPresentationConfig,
  type GestoriaPresentationConfig,
} from "@/lib/contabilidad/gestoria-presentation-config"
import {
  buildChartBalanceRows,
  countAccountsWithMovement,
  type MovementTotals,
} from "@/lib/reports/build-chart-balances"
import {
  describeCompanyChartPlan,
  getPlanAccountCodes,
  type CompanyChartPlanInfo,
} from "@/lib/reports/pgc-chart-plans"
import { getAccountLabel } from "@/lib/reports/pgc-labels"
import {
  cuentaSortKey,
  getAccountLevel,
  normalizeCuenta,
  round2,
} from "@/lib/reports/format"
import type { AccountBalance, ReportMeta } from "@/lib/reports/types"

export interface LedgerQuery {
  companyId: string
  year: number
  fromMonth?: number
  toMonth?: number
  costCenterId?: string
}

export function buildPeriodLabel(year: number, fromMonth?: number, toMonth?: number): string {
  if (!fromMonth && !toMonth) return `Ejercicio ${year}`
  const from = fromMonth ?? 1
  const to = toMonth ?? 12
  if (from === 1 && to === 12) return `Ejercicio ${year}`
  return `${from.toString().padStart(2, "0")}/${year} — ${to.toString().padStart(2, "0")}/${year}`
}

function buildDateRange(year: number, fromMonth?: number, toMonth?: number) {
  const from = fromMonth ?? 1
  const to = toMonth ?? 12
  const start = new Date(`${year}-${String(from).padStart(2, "0")}-01T00:00:00.000Z`)
  const endDay = new Date(year, to, 0).getDate()
  const end = new Date(`${year}-${String(to).padStart(2, "0")}-${String(endDay).padStart(2, "0")}T23:59:59.999Z`)
  return { start, end }
}

function parsePresentationConfig(
  value: string | null | undefined,
  fallback: GestoriaPresentationConfig,
): GestoriaPresentationConfig {
  if (!value) return fallback
  try {
    const parsed = JSON.parse(value) as GestoriaPresentationConfig
    return {
      ...fallback,
      ...parsed,
      annualAccounts: { ...fallback.annualAccounts, ...parsed.annualAccounts },
      corporateTax: { ...fallback.corporateTax, ...parsed.corporateTax },
      booksLegalization: { ...fallback.booksLegalization, ...parsed.booksLegalization },
    }
  } catch {
    return fallback
  }
}

function defaultPlanForClientProfile(clientProfile: CompanyClientProfile | null): {
  planType: AccountingPlanType
  entityType: "fisica" | "juridica"
} {
  if (clientProfile === "PERSONA_FISICA" || clientProfile === "AUTONOMO") {
    return { planType: "PGC_MICRO", entityType: "fisica" }
  }
  return { planType: "PGC_PYME", entityType: "juridica" }
}

export async function resolveCompanyChartPlan(companyId: string): Promise<CompanyChartPlanInfo> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      gestoriaProfile: {
        select: {
          accountingPlanType: true,
          entityType: true,
          presentationConfigJson: true,
        },
      },
      fiscalSettings: {
        select: { clientProfile: true },
      },
    },
  })

  if (company?.gestoriaProfile) {
    const entityType: "fisica" | "juridica" =
      company.gestoriaProfile.entityType === "PERSONA_FISICA" ? "fisica" : "juridica"
    const presentation = parsePresentationConfig(
      company.gestoriaProfile.presentationConfigJson,
      createDefaultPresentationConfig(entityType),
    )
    return describeCompanyChartPlan(company.gestoriaProfile.accountingPlanType, presentation)
  }

  const inferred = defaultPlanForClientProfile(company?.fiscalSettings?.clientProfile ?? null)
  return describeCompanyChartPlan(
    inferred.planType,
    createDefaultPresentationConfig(inferred.entityType),
  )
}

async function loadMovementTotals(query: LedgerQuery): Promise<Map<string, MovementTotals>> {
  const { start, end } = buildDateRange(query.year, query.fromMonth, query.toMonth)

  const lines = await prisma.entryLine.findMany({
    where: {
      entry: {
        companyId: query.companyId,
        fecha: { gte: start, lte: end },
      },
      ...(query.costCenterId
        ? {
            analyticDistributions: {
              some: { costCenterId: query.costCenterId },
            },
          }
        : {}),
    },
    select: {
      cuenta: true,
      debe: true,
      haber: true,
      analyticDistributions: query.costCenterId
        ? {
            where: { costCenterId: query.costCenterId },
            select: { amount: true, percentage: true },
          }
        : false,
    },
  })

  const map = new Map<string, { totalDebe: number; totalHaber: number }>()

  for (const line of lines) {
    const cuenta = normalizeCuenta(line.cuenta)
    if (!cuenta) continue

    let debe = decimalToNumber(line.debe)
    let haber = decimalToNumber(line.haber)

    if (query.costCenterId && line.analyticDistributions?.length) {
      const assigned = line.analyticDistributions.reduce(
        (sum, item) => sum + decimalToNumber(item.amount),
        0,
      )
      const lineTotal = Math.max(debe, haber)
      if (lineTotal > 0 && assigned > 0) {
        const ratio = assigned / lineTotal
        debe = round2(debe * ratio)
        haber = round2(haber * ratio)
      }
    }

    const current = map.get(cuenta) ?? { totalDebe: 0, totalHaber: 0 }
    current.totalDebe += debe
    current.totalHaber += haber
    map.set(cuenta, current)
  }

  return map
}

async function loadOpenedAccountNames(companyId: string) {
  const [thirdParties, subaccounts] = await Promise.all([
    prisma.thirdParty.findMany({
      where: { companyId },
      select: { accountCode: true, name: true },
    }),
    prisma.ledgerSubaccount.findMany({
      where: { companyId },
      select: { accountCode: true, name: true },
    }),
  ])

  return [...thirdParties, ...subaccounts]
    .map((row) => ({
      code: normalizeCuenta(row.accountCode),
      name: row.name.trim(),
    }))
    .filter((row) => row.code && row.name)
}

export async function fetchAccountBalances(query: LedgerQuery): Promise<AccountBalance[]> {
  const [movements, openedAccounts] = await Promise.all([
    loadMovementTotals(query),
    loadOpenedAccountNames(query.companyId),
  ])

  const names = new Map(openedAccounts.map((row) => [row.code, row.name]))

  return Array.from(movements.entries())
    .map(([cuenta, totals]) => ({
      cuenta,
      label: names.get(cuenta) ?? getAccountLabel(cuenta),
      totalDebe: round2(totals.totalDebe),
      totalHaber: round2(totals.totalHaber),
      saldo: round2(totals.totalDebe - totals.totalHaber),
      level: getAccountLevel(cuenta),
    }))
    .sort((a, b) => cuentaSortKey(a.cuenta).localeCompare(cuentaSortKey(b.cuenta)))
}

export async function fetchCompanyChartExtract(query: LedgerQuery): Promise<{
  plan: CompanyChartPlanInfo
  rows: AccountBalance[]
  totalDebe: number
  totalHaber: number
  accountsWithMovement: number
}> {
  const [plan, movements, openedAccounts] = await Promise.all([
    resolveCompanyChartPlan(query.companyId),
    loadMovementTotals(query),
    loadOpenedAccountNames(query.companyId),
  ])

  const rows = buildChartBalanceRows({
    planCodes: getPlanAccountCodes(plan.accountingPlanType),
    openedAccounts,
    movements,
    // EX siempre lista subcuentas abiertas, como A3eco. El nivel 3/4 es para cuentas anuales.
    detailLevel: "SUBCUENTAS",
  })

  let totalDebe = 0
  let totalHaber = 0
  for (const totals of movements.values()) {
    totalDebe += totals.totalDebe
    totalHaber += totals.totalHaber
  }

  return {
    plan,
    rows,
    totalDebe: round2(totalDebe),
    totalHaber: round2(totalHaber),
    accountsWithMovement: countAccountsWithMovement(rows),
  }
}

export async function buildReportMeta(
  companyId: string,
  reportTitle: string,
  year: number,
  fromMonth?: number,
  toMonth?: number,
): Promise<ReportMeta> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true, cif: true },
  })

  if (!company) {
    throw new Error("Empresa no encontrada.")
  }

  return {
    companyName: company.name,
    companyCif: company.cif,
    year,
    periodLabel: buildPeriodLabel(year, fromMonth, toMonth),
    reportTitle,
    generatedAt: new Date(),
  }
}
