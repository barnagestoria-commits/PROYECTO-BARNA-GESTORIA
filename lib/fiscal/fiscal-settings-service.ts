import type { CompanyClientProfile } from "@prisma/client"
import { prisma } from "@/lib/db"
import {
  DEFAULT_SETTINGS_BY_PROFILE,
  inferClientProfile,
  mergeImpresosIntoFiscalSettings,
  type CompanyFiscalSettingsDto,
  getEnabledModels,
} from "@/lib/fiscal/fiscal-settings"
import type { FiscalModelId } from "@/lib/types/fiscal-panorama"

function mapRecordToDto(record: {
  clientProfile: CompanyClientProfile
  model111Enabled: boolean
  model115Enabled: boolean
  model123Enabled: boolean
  model130Enabled: boolean
  model180Enabled: boolean
  model190Enabled: boolean
  model303Enabled: boolean
  model347Enabled: boolean
  model349Enabled: boolean
  model390Enabled: boolean
}): CompanyFiscalSettingsDto {
  return {
    clientProfile: record.clientProfile,
    model111Enabled: record.model111Enabled,
    model115Enabled: record.model115Enabled,
    model123Enabled: record.model123Enabled,
    model130Enabled: record.model130Enabled,
    model180Enabled: record.model180Enabled,
    model190Enabled: record.model190Enabled,
    model303Enabled: record.model303Enabled,
    model347Enabled: record.model347Enabled,
    model349Enabled: record.model349Enabled,
    model390Enabled: record.model390Enabled,
  }
}

function parseImpresosJson(value: string | null | undefined): Partial<Record<string, boolean>> {
  if (!value) return {}
  try {
    return JSON.parse(value) as Partial<Record<string, boolean>>
  } catch {
    return {}
  }
}

async function inferProfileForCompany(companyId: string): Promise<CompanyClientProfile> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      account: { select: { accountType: true } },
      gestoriaProfile: { select: { entityType: true } },
    },
  })

  return inferClientProfile({
    accountType: company?.account.accountType,
    entityType: company?.gestoriaProfile?.entityType,
  })
}

function omitUndefined<T extends Record<string, unknown>>(payload: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  ) as Partial<T>
}

async function mergeGestoriaImpresos(
  companyId: string,
  settings: CompanyFiscalSettingsDto,
): Promise<CompanyFiscalSettingsDto> {
  const gestoriaProfile = await prisma.companyGestoriaProfile.findUnique({
    where: { companyId },
    select: { impresosJson: true },
  })

  if (!gestoriaProfile?.impresosJson) return settings
  return mergeImpresosIntoFiscalSettings(settings, parseImpresosJson(gestoriaProfile.impresosJson))
}

export async function getOrCreateCompanyFiscalSettings(
  companyId: string,
): Promise<CompanyFiscalSettingsDto> {
  const existing = await prisma.companyFiscalSettings.findUnique({
    where: { companyId },
  })

  const inferredProfile = existing ? null : await inferProfileForCompany(companyId)
  const base = existing
    ? mapRecordToDto(existing)
    : DEFAULT_SETTINGS_BY_PROFILE[inferredProfile ?? "PYME"]

  return mergeGestoriaImpresos(companyId, base)
}

export async function updateCompanyFiscalSettings(
  companyId: string,
  payload: Partial<CompanyFiscalSettingsDto>,
): Promise<CompanyFiscalSettingsDto> {
  const cleanPayload = omitUndefined(payload)
  const inferredProfile = await inferProfileForCompany(companyId)
  const profile = (cleanPayload.clientProfile as CompanyClientProfile | undefined) ?? inferredProfile
  const profileDefaults = DEFAULT_SETTINGS_BY_PROFILE[profile]

  const updated = await prisma.companyFiscalSettings.upsert({
    where: { companyId },
    create: {
      companyId,
      ...profileDefaults,
      ...cleanPayload,
    },
    update: {
      ...cleanPayload,
    },
  })

  return mapRecordToDto(updated)
}

export async function applyClientProfilePreset(
  companyId: string,
  profile: CompanyClientProfile,
): Promise<CompanyFiscalSettingsDto> {
  return updateCompanyFiscalSettings(companyId, DEFAULT_SETTINGS_BY_PROFILE[profile])
}

export async function getEnabledModelsForCompany(companyId: string): Promise<FiscalModelId[]> {
  const settings = await getOrCreateCompanyFiscalSettings(companyId)
  return getEnabledModels(settings)
}
