import type { AccountTreatmentConfig } from "@prisma/client"
import { prisma } from "@/lib/db"
import { formatAccountCodeDisplay } from "@/lib/accounting/third-party-types"
import {
  DEFAULT_ACCOUNT_TREATMENT,
  emptyAccountTreatmentInput,
  normalizeAccountCodeDigits,
  type AccountTreatmentConfigDto,
  type AccountTreatmentConfigInput,
} from "@/lib/accounting/account-treatment-types"

function decimalToNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  return Number(value)
}

function mapTreatment(record: AccountTreatmentConfig): AccountTreatmentConfigDto {
  return {
    id: record.id,
    accountCode: record.accountCode,
    formattedAccountCode: formatAccountCodeDisplay(record.accountCode),
    defaultCounterpartAccount: record.defaultCounterpartAccount ?? "",
    defaultVatOperation: record.defaultVatOperation ?? DEFAULT_ACCOUNT_TREATMENT.defaultVatOperation,
    defaultVatType: record.defaultVatType ?? DEFAULT_ACCOUNT_TREATMENT.defaultVatType,
    defaultVatPercent:
      decimalToNumber(record.defaultVatPercent) ?? DEFAULT_ACCOUNT_TREATMENT.defaultVatPercent,
    defaultSurchargePercent: decimalToNumber(record.defaultSurchargePercent) ?? 0,
    applySurcharge: record.applySurcharge,
    defaultIrpfPercent: decimalToNumber(record.defaultIrpfPercent),
    defaultIrpfAccount: record.defaultIrpfAccount ?? "",
    defaultTaxForm: record.defaultTaxForm ?? DEFAULT_ACCOUNT_TREATMENT.defaultTaxForm,
    documentAccumulationType: record.documentAccumulationType ?? "347",
  }
}

export async function getAccountTreatment(
  companyId: string,
  accountCode: string,
): Promise<AccountTreatmentConfigDto | null> {
  const normalized = normalizeAccountCodeDigits(accountCode)
  if (!normalized) return null

  const record = await prisma.accountTreatmentConfig.findUnique({
    where: {
      companyId_accountCode: {
        companyId,
        accountCode: normalized,
      },
    },
  })

  return record ? mapTreatment(record) : null
}

export async function upsertAccountTreatment(
  companyId: string,
  accountCode: string,
  input: AccountTreatmentConfigInput,
): Promise<AccountTreatmentConfigDto> {
  const normalized = normalizeAccountCodeDigits(accountCode)
  if (!normalized) {
    throw new Error("Código de cuenta no válido.")
  }

  const record = await prisma.accountTreatmentConfig.upsert({
    where: {
      companyId_accountCode: {
        companyId,
        accountCode: normalized,
      },
    },
    create: {
      companyId,
      accountCode: normalized,
      defaultCounterpartAccount: input.defaultCounterpartAccount?.trim() || null,
      defaultVatOperation: input.defaultVatOperation?.trim() || DEFAULT_ACCOUNT_TREATMENT.defaultVatOperation,
      defaultVatType: input.defaultVatType?.trim() || DEFAULT_ACCOUNT_TREATMENT.defaultVatType,
      defaultVatPercent: input.defaultVatPercent ?? DEFAULT_ACCOUNT_TREATMENT.defaultVatPercent,
      defaultSurchargePercent: input.defaultSurchargePercent ?? 0,
      applySurcharge: input.applySurcharge ?? false,
      defaultIrpfPercent: input.defaultIrpfPercent ?? null,
      defaultIrpfAccount: input.defaultIrpfAccount?.trim() || null,
      defaultTaxForm: input.defaultTaxForm?.trim() || DEFAULT_ACCOUNT_TREATMENT.defaultTaxForm,
      documentAccumulationType: input.documentAccumulationType?.trim() || null,
    },
    update: {
      defaultCounterpartAccount: input.defaultCounterpartAccount?.trim() || null,
      defaultVatOperation: input.defaultVatOperation?.trim() || DEFAULT_ACCOUNT_TREATMENT.defaultVatOperation,
      defaultVatType: input.defaultVatType?.trim() || DEFAULT_ACCOUNT_TREATMENT.defaultVatType,
      defaultVatPercent: input.defaultVatPercent ?? DEFAULT_ACCOUNT_TREATMENT.defaultVatPercent,
      defaultSurchargePercent: input.defaultSurchargePercent ?? 0,
      applySurcharge: input.applySurcharge ?? false,
      defaultIrpfPercent: input.defaultIrpfPercent ?? null,
      defaultIrpfAccount: input.defaultIrpfAccount?.trim() || null,
      defaultTaxForm: input.defaultTaxForm?.trim() || DEFAULT_ACCOUNT_TREATMENT.defaultTaxForm,
      documentAccumulationType: input.documentAccumulationType?.trim() || null,
    },
  })

  return mapTreatment(record)
}

export function mergeWithDefaults(
  treatment: AccountTreatmentConfigDto | null,
): AccountTreatmentConfigInput {
  const base = emptyAccountTreatmentInput()
  if (!treatment) return base

  return {
    ...base,
    ...treatment,
    defaultCounterpartAccount: treatment.defaultCounterpartAccount ?? "",
    defaultIrpfAccount: treatment.defaultIrpfAccount ?? "",
  }
}
