import type { CompanyClientProfile } from "@prisma/client"
import { prisma } from "@/lib/db"
import {
  DEFAULT_SETTINGS_BY_PROFILE,
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

  const base = existing
    ? mapRecordToDto(existing)
    : DEFAULT_SETTINGS_BY_PROFILE.PYME

  return mergeGestoriaImpresos(companyId, base)
}

export async function updateCompanyFiscalSettings(
  companyId: string,
  payload: Partial<CompanyFiscalSettingsDto>,
): Promise<CompanyFiscalSettingsDto> {
  const profile = payload.clientProfile
  const profileDefaults = profile ? DEFAULT_SETTINGS_BY_PROFILE[profile] : null

  const updated = await prisma.companyFiscalSettings.upsert({
    where: { companyId },
    create: {
      companyId,
      ...(profileDefaults ?? DEFAULT_SETTINGS_BY_PROFILE.PYME),
      ...payload,
    },
    update: {
      ...payload,
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
