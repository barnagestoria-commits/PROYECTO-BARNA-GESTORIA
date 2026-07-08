import type { FiscalDeclaration, FiscalModelCode } from "@prisma/client"
import { prisma } from "@/lib/db"
import {
  FISCAL_MODEL_DEFINITIONS,
  FISCAL_PERIOD_KEYS,
  buildDetailHref,
  calculateModelAmount,
  periodKeyFromQuarter,
  periodLabel,
  prismaCodeToModelId,
  resolveCellStatus,
  type RawEntryLine,
} from "@/lib/fiscal/panorama"
import type {
  FiscalModelDetailResponse,
  FiscalModelId,
  FiscalPanoramaBlock,
  FiscalPanoramaCell,
  FiscalPanoramaResponse,
  FiscalPanoramaRow,
  FiscalPanoramaSummary,
  FiscalPeriodKey,
} from "@/lib/types/fiscal-panorama"
import { calculateTaxSummary, periodKeyToQuarter } from "@/lib/fiscal/tax-summary"

function declarationKey(year: number, quarter: number, modelCode: FiscalModelCode): string {
  return `${year}-${quarter}-${modelCode}`
}

function buildDeclarationMap(declarations: FiscalDeclaration[]) {
  const map = new Map<string, FiscalDeclaration>()
  for (const declaration of declarations) {
    map.set(declarationKey(declaration.year, declaration.quarter, declaration.modelCode), declaration)
  }
  return map
}

function buildCell(
  modelCode: FiscalModelId,
  year: number,
  period: FiscalPeriodKey,
  amount: number,
  lineCount: number,
  entryCount: number,
  declarationStatus?: FiscalDeclaration["status"],
): FiscalPanoramaCell {
  const { status, statusLabel } = resolveCellStatus(amount, lineCount, declarationStatus)

  return {
    period,
    amount,
    status,
    statusLabel,
    entryCount,
    lineCount,
    href: buildDetailHref(modelCode, year, period),
  }
}

async function fetchYearLines(companyId: string, year: number): Promise<RawEntryLine[]> {
  const start = new Date(`${year}-01-01T00:00:00.000Z`)
  const end = new Date(`${year}-12-31T23:59:59.999Z`)

  const lines = await prisma.entryLine.findMany({
    where: {
      entry: {
        companyId,
        fecha: { gte: start, lte: end },
      },
    },
    include: {
      entry: {
        select: { id: true, fecha: true },
      },
    },
    orderBy: [{ entry: { fecha: "asc" } }, { sortOrder: "asc" }],
  })

  return lines
}

function computeRowCells(
  modelCode: FiscalModelId,
  year: number,
  allLines: RawEntryLine[],
  declarationMap: Map<string, FiscalDeclaration>,
): Record<FiscalPeriodKey, FiscalPanoramaCell> {
  const model = FISCAL_MODEL_DEFINITIONS.find((item) => item.code === modelCode)!
  const quarterlyAmounts: number[] = []

  const cells = {} as Record<FiscalPeriodKey, FiscalPanoramaCell>

  for (const period of ["q1", "q2", "q3", "q4"] as const) {
    const quarter = Number(period.replace("q", "")) as 1 | 2 | 3 | 4
    const result = calculateModelAmount(modelCode, allLines, year, quarter)
    quarterlyAmounts.push(result.amount)

    const declaration = declarationMap.get(
      declarationKey(year, quarter, model.prismaCode),
    )

    cells[period] = buildCell(
      modelCode,
      year,
      period,
      result.amount,
      result.lineCount,
      result.entryIds.size,
      declaration?.status,
    )
  }

  const annualAmount = quarterlyAmounts.reduce((sum, value) => sum + value, 0)
  const annualLineCount = FISCAL_PERIOD_KEYS.slice(0, 4).reduce(
    (sum, key) => sum + cells[key].lineCount,
    0,
  )
  const annualEntryCount = new Set(
    FISCAL_PERIOD_KEYS.slice(0, 4).flatMap((key) => {
      const quarter = Number(key.replace("q", "")) as 1 | 2 | 3 | 4
      return [...calculateModelAmount(modelCode, allLines, year, quarter).entryIds]
    }),
  ).size

  const annualDeclarations = ([1, 2, 3, 4] as const).map((quarter) =>
    declarationMap.get(declarationKey(year, quarter, model.prismaCode)),
  )
  const allPresented =
    annualDeclarations.length === 4 &&
    annualDeclarations.every((declaration) => declaration?.status === "PRESENTADO")

  cells.annual = buildCell(
    modelCode,
    year,
    "annual",
    Math.round(annualAmount * 100) / 100,
    annualLineCount,
    annualEntryCount,
    allPresented ? "PRESENTADO" : undefined,
  )

  return cells
}

export async function buildFiscalPanorama(
  companyId: string,
  companyName: string,
  year: number,
): Promise<FiscalPanoramaResponse> {
  const [allLines, declarations] = await Promise.all([
    fetchYearLines(companyId, year),
    prisma.fiscalDeclaration.findMany({ where: { companyId, year } }),
  ])

  const declarationMap = buildDeclarationMap(declarations)

  const blocks: FiscalPanoramaBlock[] = [
    {
      id: "IRPF",
      label: "I.R.P.F.",
      rows: FISCAL_MODEL_DEFINITIONS.filter((model) => model.block === "IRPF").map((model) => ({
        modelCode: model.code,
        modelLabel: model.label,
        description: model.description,
        cells: computeRowCells(model.code, year, allLines, declarationMap),
      })),
    },
    {
      id: "IVA",
      label: "I.V.A.",
      rows: FISCAL_MODEL_DEFINITIONS.filter((model) => model.block === "IVA").map((model) => ({
        modelCode: model.code,
        modelLabel: model.label,
        description: model.description,
        cells: computeRowCells(model.code, year, allLines, declarationMap),
      })),
    },
  ]

  const summaryCells = {} as Record<FiscalPeriodKey, FiscalPanoramaCell>
  const summaryBreakdown = {} as NonNullable<FiscalPanoramaSummary["breakdown"]>

  for (const period of FISCAL_PERIOD_KEYS) {
    const quarter = periodKeyToQuarter(period)
    const taxSummary = calculateTaxSummary(allLines, year, quarter)

    const amount = taxSummary.totalAPagarDevolver

    const lineCount = blocks
      .flatMap((block) => block.rows)
      .reduce((sum, row) => sum + row.cells[period].lineCount, 0)

    const entryCount = blocks
      .flatMap((block) => block.rows)
      .reduce((sum, row) => sum + row.cells[period].entryCount, 0)

    const statuses = blocks.flatMap((block) => block.rows.map((row) => row.cells[period].status))
    const allPresented = statuses.every((status) => status === "presentado")
    const allSinDatos = statuses.every((status) => status === "sin_datos")

    const { status, statusLabel } = allPresented
      ? { status: "presentado" as const, statusLabel: "Presentado" }
      : allSinDatos
        ? { status: "sin_datos" as const, statusLabel: "SD" }
        : { status: "pendiente" as const, statusLabel: "Pendiente" }

    summaryCells[period] = {
      period,
      amount: Math.round(amount * 100) / 100,
      status,
      statusLabel: taxSummary.label === "A ingresar" ? "Pendiente" : taxSummary.label === "A compensar / devolver" ? "Pendiente" : statusLabel,
      entryCount,
      lineCount,
      href: `/dashboard/fiscal/pagar-devolver/${year}/${period === "annual" ? "anual" : period.replace("q", "")}`,
    }

    summaryBreakdown[period] = {
      ivaResult: taxSummary.ivaResult,
      retenciones111: taxSummary.retenciones111,
      retenciones115: taxSummary.retenciones115,
      retenciones180: taxSummary.retenciones180,
      totalAPagarDevolver: taxSummary.totalAPagarDevolver,
      resultLabel: taxSummary.label,
    }
  }

  const summary: FiscalPanoramaSummary = {
    label: "A pagar / devolver",
    cells: summaryCells,
    breakdown: summaryBreakdown,
  }

  return {
    year,
    companyId,
    companyName,
    generatedAt: new Date().toISOString(),
    blocks,
    summary,
  }
}

export async function buildFiscalModelDetail(
  companyId: string,
  modelCode: FiscalModelId,
  year: number,
  quarter: 1 | 2 | 3 | 4 | "annual",
): Promise<FiscalModelDetailResponse | null> {
  const model = FISCAL_MODEL_DEFINITIONS.find((item) => item.code === modelCode)
  if (!model) return null

  const allLines = await fetchYearLines(companyId, year)
  const result = calculateModelAmount(modelCode, allLines, year, quarter)

  let declarationStatus: FiscalDeclaration["status"] | undefined
  if (quarter !== "annual") {
    const declaration = await prisma.fiscalDeclaration.findUnique({
      where: {
        companyId_year_quarter_modelCode: {
          companyId,
          year,
          quarter,
          modelCode: model.prismaCode,
        },
      },
    })
    declarationStatus = declaration?.status
  } else {
    const declarations = await prisma.fiscalDeclaration.findMany({
      where: { companyId, year, modelCode: model.prismaCode },
    })
    if (declarations.length === 4 && declarations.every((item) => item.status === "PRESENTADO")) {
      declarationStatus = "PRESENTADO"
    }
  }

  const period: FiscalPeriodKey = quarter === "annual" ? "annual" : periodKeyFromQuarter(quarter)
  const { status, statusLabel } = resolveCellStatus(
    result.amount,
    result.lineCount,
    declarationStatus,
  )

  return {
    modelCode,
    modelLabel: model.label,
    year,
    quarter,
    periodLabel: periodLabel(period, year),
    amount: result.amount,
    status,
    statusLabel,
    breakdown: result.breakdown,
  }
}

export function isValidModelCode(value: string): value is FiscalModelId {
  return value === "111" || value === "115" || value === "180" || value === "303"
}

export { prismaCodeToModelId }
