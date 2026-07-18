import type { CompanyClientProfile } from "@prisma/client"
import { prisma } from "@/lib/db"
import {
  DEFAULT_SETTINGS_BY_PROFILE,
  type CompanyFiscalSettingsDto,
  getEnabledModels,
} from "@/lib/fiscal/fiscal-settings"
import type { FiscalModelId } from "@/lib/types/fiscal-panorama"

export async function getOrCreateCompanyFiscalSettings(
  companyId: string,
): Promise<CompanyFiscalSettingsDto> {
  const existing = await prisma.companyFiscalSettings.findUnique({
    where: { companyId },
  })

  if (existing) {
    return {
      clientProfile: existing.clientProfile,
      model111Enabled: existing.model111Enabled,
      model115Enabled: existing.model115Enabled,
      model180Enabled: existing.model180Enabled,
      model303Enabled: existing.model303Enabled,
    }
  }

  const defaults = DEFAULT_SETTINGS_BY_PROFILE.PYME
  const created = await prisma.companyFiscalSettings.create({
    data: {
      companyId,
      ...defaults,
    },
  })

  return {
    clientProfile: created.clientProfile,
    model111Enabled: created.model111Enabled,
    model115Enabled: created.model115Enabled,
    model180Enabled: created.model180Enabled,
    model303Enabled: created.model303Enabled,
  }
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

  return {
    clientProfile: updated.clientProfile,
    model111Enabled: updated.model111Enabled,
    model115Enabled: updated.model115Enabled,
    model180Enabled: updated.model180Enabled,
    model303Enabled: updated.model303Enabled,
  }
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
