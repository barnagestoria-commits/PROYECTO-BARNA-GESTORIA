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
import { isAnnualOnlyModel } from "@/lib/fiscal/fiscal-settings"
import type { A3ImportedFiscalResult } from "@/lib/imports/a3/types"

function declarationKey(year: number, quarter: number, modelCode: FiscalModelCode): string {
  return `${year}-${quarter}-${modelCode}`
}

type ImportedFiscalResultMap = Map<string, number>

function importedFiscalResultKey(
  modelCode: string,
  year: number,
  quarter: number,
): string {
  return `${modelCode}-${year}-${quarter}`
}

async function fetchImportedFiscalResults(
  companyId: string,
  year: number,
): Promise<ImportedFiscalResultMap> {
  const imports = await prisma.accountingDataImport.findMany({
    where: {
      companyId,
      status: "PROCESADO",
      fiscalResultsJson: { not: null },
    },
    select: { fiscalResultsJson: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  })
  const resultMap: ImportedFiscalResultMap = new Map()

  for (const item of imports) {
    if (!item.fiscalResultsJson) continue
    try {
      const results = JSON.parse(item.fiscalResultsJson) as A3ImportedFiscalResult[]
      for (const result of results) {
        if (
          result.year !== year ||
          !["115", "130", "303"].includes(result.modelCode) ||
          result.quarter < 1 ||
          result.quarter > 4 ||
          !Number.isFinite(result.amount)
        ) {
          continue
        }
        const key = importedFiscalResultKey(result.modelCode, result.year, result.quarter)
        if (!resultMap.has(key)) resultMap.set(key, result.amount)
      }
    } catch {
      // Una importación antigua o dañada no debe bloquear el panorama fiscal.
    }
  }

  return resultMap
}

function importedAmountForPeriod(
  results: ImportedFiscalResultMap,
  modelCode: FiscalModelId,
  year: number,
  quarter: 1 | 2 | 3 | 4 | "annual",
): number | undefined {
  if (quarter !== "annual") {
    return results.get(importedFiscalResultKey(modelCode, year, quarter))
  }

  const quarterly = ([1, 2, 3, 4] as const).map((item) =>
    results.get(importedFiscalResultKey(modelCode, year, item)),
  )
  return quarterly.some((amount) => amount !== undefined)
    ? Math.round(
        quarterly.reduce<number>((sum, amount) => sum + (amount ?? 0), 0) * 100,
      ) / 100
    : undefined
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

export async function fetchFiscalYearLines(companyId: string, year: number): Promise<RawEntryLine[]> {
  return fetchYearLines(companyId, year)
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
        select: { id: true, fecha: true, commandCode: true },
      },
    },
    orderBy: [{ entry: { fecha: "asc" } }, { sortOrder: "asc" }],
  })

  return lines.map((line) => ({
    id: line.id,
    entryId: line.entryId,
    cuenta: line.cuenta,
    concepto: line.concepto,
    debe: line.debe,
    haber: line.haber,
    entry: {
      id: line.entry.id,
      fecha: line.entry.fecha,
      concepto: line.entry.commandCode,
    },
  }))
}

function computeRowCells(
  modelCode: FiscalModelId,
  year: number,
  allLines: RawEntryLine[],
  declarationMap: Map<string, FiscalDeclaration>,
  importedResults: ImportedFiscalResultMap,
): Record<FiscalPeriodKey, FiscalPanoramaCell> {
  const model = FISCAL_MODEL_DEFINITIONS.find((item) => item.code === modelCode)!
  const cells = {} as Record<FiscalPeriodKey, FiscalPanoramaCell>

  if (isAnnualOnlyModel(modelCode)) {
    for (const period of ["q1", "q2", "q3", "q4"] as const) {
      cells[period] = buildCell(modelCode, year, period, 0, 0, 0)
    }

    const annualResult = calculateModelAmount(modelCode, allLines, year, "annual")
    cells.annual = buildCell(
      modelCode,
      year,
      "annual",
      annualResult.amount,
      annualResult.lineCount,
      annualResult.entryIds.size,
    )
    return cells
  }

  const quarterlyAmounts: number[] = []

  for (const period of ["q1", "q2", "q3", "q4"] as const) {
    const quarter = Number(period.replace("q", "")) as 1 | 2 | 3 | 4
    const result = calculateModelAmount(modelCode, allLines, year, quarter)
    const amount =
      importedAmountForPeriod(importedResults, modelCode, year, quarter) ?? result.amount
    quarterlyAmounts.push(amount)

    const declaration = declarationMap.get(
      declarationKey(year, quarter, model.prismaCode),
    )

    cells[period] = buildCell(
      modelCode,
      year,
      period,
      amount,
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
  enabledModels?: FiscalModelId[],
): Promise<FiscalPanoramaResponse> {
  const activeModels = enabledModels ?? FISCAL_MODEL_DEFINITIONS.map((model) => model.code)
  const activeDefinitions = FISCAL_MODEL_DEFINITIONS.filter((model) =>
    activeModels.includes(model.code),
  )
  const [allLines, declarations, importedResults] = await Promise.all([
    fetchYearLines(companyId, year),
    prisma.fiscalDeclaration.findMany({ where: { companyId, year } }),
    fetchImportedFiscalResults(companyId, year),
  ])

  const declarationMap = buildDeclarationMap(declarations)

  const blocks: FiscalPanoramaBlock[] = [
    {
      id: "IRPF" as const,
      label: "I.R.P.F.",
      rows: activeDefinitions.filter((model) => model.block === "IRPF").map((model) => ({
        modelCode: model.code,
        modelLabel: model.label,
        description: model.description,
        cells: computeRowCells(model.code, year, allLines, declarationMap, importedResults),
      })),
    },
    {
      id: "IVA" as const,
      label: "I.V.A.",
      rows: activeDefinitions.filter((model) => model.block === "IVA").map((model) => ({
        modelCode: model.code,
        modelLabel: model.label,
        description: model.description,
        cells: computeRowCells(model.code, year, allLines, declarationMap, importedResults),
      })),
    },
    {
      id: "INFORMATIVAS" as const,
      label: "Informativas",
      rows: activeDefinitions.filter((model) => model.block === "INFORMATIVAS").map((model) => ({
        modelCode: model.code,
        modelLabel: model.label,
        description: model.description,
        cells: computeRowCells(model.code, year, allLines, declarationMap, importedResults),
      })),
    },
  ].filter((block) => block.rows.length > 0)

  const summaryCells = {} as Record<FiscalPeriodKey, FiscalPanoramaCell>
  const summaryBreakdown = {} as NonNullable<FiscalPanoramaSummary["breakdown"]>

  for (const period of FISCAL_PERIOD_KEYS) {
    const quarter = periodKeyToQuarter(period)
    const importedOverrides = {
      "115": importedAmountForPeriod(importedResults, "115", year, quarter),
      "130": importedAmountForPeriod(importedResults, "130", year, quarter),
      "303": importedAmountForPeriod(importedResults, "303", year, quarter),
    }
    const taxSummary = calculateTaxSummary(allLines, year, quarter, {
      ...(importedOverrides["115"] !== undefined
        ? { "115": importedOverrides["115"] }
        : {}),
      ...(importedOverrides["130"] !== undefined
        ? { "130": importedOverrides["130"] }
        : {}),
      ...(importedOverrides["303"] !== undefined
        ? { "303": importedOverrides["303"] }
        : {}),
    })

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
      retenciones123: taxSummary.retenciones123,
      pagos130: taxSummary.pagos130,
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

  const [allLines, importedResults] = await Promise.all([
    fetchYearLines(companyId, year),
    fetchImportedFiscalResults(companyId, year),
  ])
  let result = calculateModelAmount(modelCode, allLines, year, quarter)

  // El asiento de liquidación 303 sirve para cerrar 472/477, pero no contiene
  // las bases ni el desglose de tipos necesario para renderizar el modelo.
  // Para el borrador, recalculamos las casillas desde los asientos origen.
  if (
    modelCode === "303" &&
    quarter !== "annual" &&
    result.breakdown.some((section) => section.key === "liquidacion")
  ) {
    const liquidationEntryIds = new Set(
      result.breakdown.flatMap((section) => section.lines.map((line) => line.entryId)),
    )
    const sourceResult = calculateModelAmount(
      modelCode,
      allLines.filter((line) => !liquidationEntryIds.has(line.entry.id)),
      year,
      quarter,
    )
    if (sourceResult.lineCount > 0) {
      result = sourceResult
    }
  }

  const importedAmount = importedAmountForPeriod(
    importedResults,
    modelCode,
    year,
    quarter,
  )
  if (importedAmount !== undefined) {
    result = {
      ...result,
      amount: importedAmount,
      breakdown: [
        {
          key: "resultado-importado-a3",
          label: "Resultado fiscal importado de A3",
          total: importedAmount,
          lines: [],
        },
        ...result.breakdown,
      ],
    }
  }

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
  return (
    value === "111" ||
    value === "115" ||
    value === "123" ||
    value === "130" ||
    value === "180" ||
    value === "190" ||
    value === "303" ||
    value === "347" ||
    value === "349" ||
    value === "390"
  )
}

export { prismaCodeToModelId }
