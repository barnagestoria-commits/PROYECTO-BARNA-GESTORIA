import { prisma } from "@/lib/db"
import type { ExtracontableAsset, FixedAssetAdjustmentKind } from "@/lib/fixed-assets/extracontable"
import { decimalToNumber } from "@/lib/prisma/decimal"
import {
  DEFAULT_MODEL_202_OPTIONS,
  type Model202Modality,
  type Model202Options,
} from "@/lib/fiscal/model-202"

function adjustmentKindOf(value: string): FixedAssetAdjustmentKind {
  if (value === "LIBRE_ACELERADA" || value === "ARRENDAMIENTO" || value === "LEY_16_2012") return value
  return "NINGUNO"
}

async function loadExtracontableAssets(companyId: string): Promise<ExtracontableAsset[]> {
  const assets = await prisma.fixedAsset.findMany({
    where: { companyId, isActive: true },
    select: {
      code: true,
      name: true,
      adjustmentKind: true,
      acquisitionDate: true,
      acquisitionCost: true,
      residualValue: true,
      usefulLifeMonths: true,
      fiscalAnnualPercent: true,
    },
  })

  return assets.map((asset) => ({
    code: asset.code,
    name: asset.name,
    adjustmentKind: adjustmentKindOf(asset.adjustmentKind),
    acquisitionDate: asset.acquisitionDate,
    acquisitionCost: decimalToNumber(asset.acquisitionCost),
    residualValue: decimalToNumber(asset.residualValue),
    usefulLifeMonths: asset.usefulLifeMonths,
    fiscalAnnualPercent:
      asset.fiscalAnnualPercent === null ? null : decimalToNumber(asset.fiscalAnnualPercent),
  }))
}

function modalityOf(value: string | null | undefined): Model202Modality {
  return value === "ART_40_3" ? "ART_40_3" : "ART_40_2"
}

export async function loadModel202Options(companyId: string): Promise<Model202Options> {
  const settings = await prisma.companyFiscalSettings.findUnique({
    where: { companyId },
    select: {
      model202Modality: true,
      model202TaxRate: true,
      model202PriorNetQuota: true,
      model202LargeTurnover: true,
      model202Increase: true,
      model202Decrease: true,
      model202NegativeBases: true,
    },
  })

  const assets = await loadExtracontableAssets(companyId)
  if (!settings) return { ...DEFAULT_MODEL_202_OPTIONS, assets }

  return {
    modality: modalityOf(settings.model202Modality),
    taxRate: settings.model202TaxRate > 0 ? settings.model202TaxRate : DEFAULT_MODEL_202_OPTIONS.taxRate,
    priorNetQuota:
      settings.model202PriorNetQuota === null ? null : decimalToNumber(settings.model202PriorNetQuota),
    turnoverAtLeast10m: settings.model202LargeTurnover,
    correctionsIncrease: decimalToNumber(settings.model202Increase),
    correctionsDecrease: decimalToNumber(settings.model202Decrease),
    negativeBases: decimalToNumber(settings.model202NegativeBases),
    assets,
  }
}
