import { prisma } from "@/lib/db"
import { decimalToNumber } from "@/lib/prisma/decimal"
import { normalizeCuenta } from "@/lib/reports/format"
import type {
  AnalyticDistributionInput,
  CompanyAccountingSettingsDto,
} from "@/lib/accounting/analytic-accounting-types"

export async function getCompanyAccountingSettings(
  companyId: string,
): Promise<CompanyAccountingSettingsDto> {
  const settings = await prisma.companyAccountingSettings.findUnique({
    where: { companyId },
  })

  return {
    analyticAccountingEnabled: settings?.analyticAccountingEnabled ?? false,
  }
}

export async function upsertCompanyAccountingSettings(
  companyId: string,
  input: Partial<CompanyAccountingSettingsDto>,
): Promise<CompanyAccountingSettingsDto> {
  const settings = await prisma.companyAccountingSettings.upsert({
    where: { companyId },
    create: {
      companyId,
      analyticAccountingEnabled: input.analyticAccountingEnabled ?? false,
    },
    update: {
      ...(input.analyticAccountingEnabled !== undefined
        ? { analyticAccountingEnabled: input.analyticAccountingEnabled }
        : {}),
    },
  })

  return {
    analyticAccountingEnabled: settings.analyticAccountingEnabled,
  }
}

export async function getAccountAnalyticTemplate(
  companyId: string,
  accountCode: string,
) {
  const digits = normalizeCuenta(accountCode)
  const rows = await prisma.accountAnalyticTemplate.findMany({
    where: { companyId, accountCode: digits },
    include: { costCenter: true },
    orderBy: { costCenter: { code: "asc" } },
  })

  return rows.map((row) => ({
    costCenterId: row.costCenterId,
    costCenterCode: row.costCenter.code,
    costCenterName: row.costCenter.name,
    percentage: decimalToNumber(row.percentage),
  }))
}

export async function saveAccountAnalyticTemplate(
  companyId: string,
  accountCode: string,
  distributions: AnalyticDistributionInput[],
) {
  const digits = normalizeCuenta(accountCode)

  await prisma.$transaction(async (tx) => {
    await tx.accountAnalyticTemplate.deleteMany({
      where: { companyId, accountCode: digits },
    })

    if (distributions.length === 0) return

    await tx.accountAnalyticTemplate.createMany({
      data: distributions.map((item) => ({
        companyId,
        accountCode: digits,
        costCenterId: item.costCenterId,
        percentage: item.percentage,
      })),
    })
  })
}

export async function createEntryLineAnalyticDistributions(
  entryLineId: string,
  distributions: AnalyticDistributionInput[],
) {
  if (distributions.length === 0) return

  await prisma.entryLineAnalyticDistribution.createMany({
    data: distributions.map((item) => ({
      entryLineId,
      costCenterId: item.costCenterId,
      percentage: item.percentage,
      amount: item.amount,
    })),
  })
}
