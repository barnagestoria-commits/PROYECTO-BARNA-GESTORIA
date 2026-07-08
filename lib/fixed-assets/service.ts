import type { AmortizationPeriodization, Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { decimalToNumber } from "@/lib/prisma/decimal"
import type { FixedAssetInput, FixedAssetResponse } from "@/lib/types/extended-modules"

function mapAsset(asset: {
  id: string
  companyId: string
  code: string
  name: string
  description: string | null
  cuentaInmovilizado: string
  cuentaAmortAcumulada: string
  cuentaGastoAmort: string
  acquisitionDate: Date
  acquisitionCost: Prisma.Decimal
  residualValue: Prisma.Decimal
  usefulLifeMonths: number
  accumulatedAmort: Prisma.Decimal
  isActive: boolean
  costDistributions: Array<{
    id: string
    percentage: Prisma.Decimal
    costCenter: { id: string; code: string; name: string }
  }>
}): FixedAssetResponse {
  return {
    id: asset.id,
    companyId: asset.companyId,
    code: asset.code,
    name: asset.name,
    description: asset.description ?? undefined,
    cuentaInmovilizado: asset.cuentaInmovilizado,
    cuentaAmortAcumulada: asset.cuentaAmortAcumulada,
    cuentaGastoAmort: asset.cuentaGastoAmort,
    acquisitionDate: asset.acquisitionDate.toISOString().split("T")[0],
    acquisitionCost: decimalToNumber(asset.acquisitionCost),
    residualValue: decimalToNumber(asset.residualValue),
    usefulLifeMonths: asset.usefulLifeMonths,
    accumulatedAmort: decimalToNumber(asset.accumulatedAmort),
    isActive: asset.isActive,
    distributions: asset.costDistributions.map((item) => ({
      id: item.id,
      costCenterId: item.costCenter.id,
      costCenterCode: item.costCenter.code,
      costCenterName: item.costCenter.name,
      percentage: decimalToNumber(item.percentage),
    })),
  }
}

const assetInclude = {
  costDistributions: {
    include: { costCenter: true },
  },
} as const

export async function listFixedAssets(companyId: string): Promise<FixedAssetResponse[]> {
  const assets = await prisma.fixedAsset.findMany({
    where: { companyId },
    include: assetInclude,
    orderBy: { code: "asc" },
  })
  return assets.map(mapAsset)
}

export async function createFixedAsset(
  companyId: string,
  input: FixedAssetInput,
): Promise<FixedAssetResponse> {
  const distributions = input.distributions ?? []
  const totalPct = distributions.reduce((sum, item) => sum + item.percentage, 0)
  if (distributions.length > 0 && Math.abs(totalPct - 100) > 0.01) {
    throw new Error("La distribución analítica debe sumar 100%.")
  }

  const asset = await prisma.fixedAsset.create({
    data: {
      companyId,
      code: input.code.trim(),
      name: input.name.trim(),
      description: input.description?.trim(),
      cuentaInmovilizado: input.cuentaInmovilizado.trim(),
      cuentaAmortAcumulada: input.cuentaAmortAcumulada.trim(),
      cuentaGastoAmort: input.cuentaGastoAmort.trim(),
      acquisitionDate: new Date(`${input.acquisitionDate}T00:00:00.000Z`),
      acquisitionCost: input.acquisitionCost,
      residualValue: input.residualValue ?? 0,
      usefulLifeMonths: input.usefulLifeMonths,
      isActive: input.isActive ?? true,
      costDistributions: distributions.length
        ? {
            create: distributions.map((item) => ({
              costCenterId: item.costCenterId,
              percentage: item.percentage,
            })),
          }
        : undefined,
    },
    include: assetInclude,
  })

  return mapAsset(asset)
}

export async function updateFixedAsset(
  companyId: string,
  assetId: string,
  input: Partial<FixedAssetInput>,
): Promise<FixedAssetResponse> {
  const existing = await prisma.fixedAsset.findFirst({ where: { id: assetId, companyId } })
  if (!existing) throw new Error("Activo no encontrado.")

  if (input.distributions) {
    const totalPct = input.distributions.reduce((sum, item) => sum + item.percentage, 0)
    if (input.distributions.length > 0 && Math.abs(totalPct - 100) > 0.01) {
      throw new Error("La distribución analítica debe sumar 100%.")
    }
    await prisma.fixedAssetCostDistribution.deleteMany({ where: { fixedAssetId: assetId } })
    if (input.distributions.length > 0) {
      await prisma.fixedAssetCostDistribution.createMany({
        data: input.distributions.map((item) => ({
          fixedAssetId: assetId,
          costCenterId: item.costCenterId,
          percentage: item.percentage,
        })),
      })
    }
  }

  const asset = await prisma.fixedAsset.update({
    where: { id: assetId },
    data: {
      code: input.code?.trim(),
      name: input.name?.trim(),
      description: input.description?.trim(),
      cuentaInmovilizado: input.cuentaInmovilizado?.trim(),
      cuentaAmortAcumulada: input.cuentaAmortAcumulada?.trim(),
      cuentaGastoAmort: input.cuentaGastoAmort?.trim(),
      acquisitionDate: input.acquisitionDate
        ? new Date(`${input.acquisitionDate}T00:00:00.000Z`)
        : undefined,
      acquisitionCost: input.acquisitionCost,
      residualValue: input.residualValue,
      usefulLifeMonths: input.usefulLifeMonths,
      isActive: input.isActive,
    },
    include: assetInclude,
  })

  return mapAsset(asset)
}

function getPeriodBounds(
  periodization: AmortizationPeriodization,
  reference = new Date(),
): { start: Date; end: Date; label: string } {
  const year = reference.getUTCFullYear()
  const month = reference.getUTCMonth()

  if (periodization === "ANUAL") {
    return {
      start: new Date(`${year}-01-01T00:00:00.000Z`),
      end: new Date(`${year}-12-31T00:00:00.000Z`),
      label: `${year}`,
    }
  }

  if (periodization === "MENSUAL") {
    const m = month + 1
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
    return {
      start: new Date(`${year}-${String(m).padStart(2, "0")}-01T00:00:00.000Z`),
      end: new Date(`${year}-${String(m).padStart(2, "0")}-${lastDay}T00:00:00.000Z`),
      label: `${year}-${String(m).padStart(2, "0")}`,
    }
  }

  const quarter = Math.floor(month / 3) + 1
  const ranges: Record<number, [string, string]> = {
    1: [`${year}-01-01`, `${year}-03-31`],
    2: [`${year}-04-01`, `${year}-06-30`],
    3: [`${year}-07-01`, `${year}-09-30`],
    4: [`${year}-10-01`, `${year}-12-31`],
  }
  const [start, end] = ranges[quarter]
  return { start: new Date(`${start}T00:00:00.000Z`), end: new Date(`${end}T00:00:00.000Z`), label: `${year}-Q${quarter}` }
}

export async function getAmortizationSettings(companyId: string) {
  const settings = await prisma.amortizationSettings.findUnique({ where: { companyId } })
  return { periodization: settings?.periodization ?? "TRIMESTRAL" }
}

export async function updateAmortizationSettings(
  companyId: string,
  periodization: AmortizationPeriodization,
) {
  const settings = await prisma.amortizationSettings.upsert({
    where: { companyId },
    create: { companyId, periodization },
    update: { periodization },
  })
  return { periodization: settings.periodization }
}

export async function generateAmortizations(companyId: string, createdById?: string) {
  const settings = await getAmortizationSettings(companyId)
  const { start, end, label } = getPeriodBounds(settings.periodization as AmortizationPeriodization)

  const assets = await prisma.fixedAsset.findMany({
    where: { companyId, isActive: true },
    include: assetInclude,
  })

  if (assets.length === 0) {
    throw new Error("No hay activos activos para amortizar.")
  }

  const lines: Array<{ cuenta: string; concepto: string; debe: number; haber: number }> = []
  let totalAmount = 0
  let assetsProcessed = 0

  for (const asset of assets) {
    const depreciable = decimalToNumber(asset.acquisitionCost) - decimalToNumber(asset.residualValue)
    const accumulated = decimalToNumber(asset.accumulatedAmort)
    const remaining = Math.max(0, depreciable - accumulated)
    if (remaining <= 0) continue

    const monthly = remaining / Math.max(1, asset.usefulLifeMonths)
    const months =
      settings.periodization === "ANUAL"
        ? 12
        : settings.periodization === "TRIMESTRAL"
          ? 3
          : 1
    const amount = Math.round(monthly * months * 100) / 100
    if (amount <= 0) continue

    const distNote =
      asset.costDistributions.length > 0
        ? ` [${asset.costDistributions.map((d) => `${d.costCenter.code} ${decimalToNumber(d.percentage)}%`).join(", ")}]`
        : ""

    lines.push({
      cuenta: asset.cuentaGastoAmort,
      concepto: `Amortización ${asset.code}${distNote}`,
      debe: amount,
      haber: 0,
    })
    lines.push({
      cuenta: asset.cuentaAmortAcumulada,
      concepto: `Amortización acumulada ${asset.code}`,
      debe: 0,
      haber: amount,
    })

    await prisma.fixedAsset.update({
      where: { id: asset.id },
      data: { accumulatedAmort: accumulated + amount },
    })

    totalAmount += amount
    assetsProcessed += 1
  }

  if (lines.length === 0) {
    throw new Error("No se generaron importes de amortización para el periodo.")
  }

  const entry = await prisma.accountingEntry.create({
    data: {
      companyId,
      fecha: end,
      commandCode: null,
      createdById,
      lines: {
        create: lines.map((line, index) => ({
          sortOrder: index,
          cuenta: line.cuenta,
          concepto: line.concepto,
          debe: line.debe,
          haber: line.haber,
        })),
      },
    },
  })

  await prisma.amortizationRun.create({
    data: {
      companyId,
      periodLabel: label,
      periodStart: start,
      periodEnd: end,
      totalAmount,
      entryId: entry.id,
      createdById,
    },
  })

  return {
    periodLabel: label,
    totalAmount: Math.round(totalAmount * 100) / 100,
    entryId: entry.id,
    assetsProcessed,
    message: `Amortizaciones del periodo ${label} generadas correctamente.`,
  }
}

export async function listCostCenters(companyId: string) {
  return prisma.costCenter.findMany({
    where: { companyId, isActive: true },
    orderBy: { code: "asc" },
  })
}

export async function createCostCenter(companyId: string, code: string, name: string) {
  return prisma.costCenter.create({
    data: { companyId, code: code.trim(), name: name.trim() },
  })
}
