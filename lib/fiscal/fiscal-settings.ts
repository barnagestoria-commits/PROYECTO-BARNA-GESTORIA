import type { CompanyClientProfile } from "@prisma/client"
import type { FiscalModelId } from "@/lib/types/fiscal-panorama"

export interface CompanyFiscalSettingsDto {
  clientProfile: CompanyClientProfile
  model111Enabled: boolean
  model115Enabled: boolean
  model180Enabled: boolean
  model303Enabled: boolean
}

export const CLIENT_PROFILE_OPTIONS: Array<{
  id: CompanyClientProfile
  label: string
  description: string
}> = [
  {
    id: "PERSONA_FISICA",
    label: "Persona física",
    description: "Sin actividad empresarial habitual",
  },
  {
    id: "AUTONOMO",
    label: "Autónomo",
    description: "Profesional o autónomo con IVA y retenciones",
  },
  {
    id: "PYME",
    label: "PYME",
    description: "Pequeña/mediana empresa con obligaciones trimestrales",
  },
  {
    id: "GRAN_EMPRESA",
    label: "Gran empresa",
    description: "Todos los modelos y certificados anuales",
  },
]

export const FISCAL_MODEL_OPTIONS: Array<{
  id: FiscalModelId
  label: string
  description: string
  periodicity: "trimestral" | "anual"
}> = [
  {
    id: "111",
    label: "Modelo 111",
    description: "Retenciones IRPF — profesionales",
    periodicity: "trimestral",
  },
  {
    id: "115",
    label: "Modelo 115",
    description: "Retenciones IRPF — alquileres",
    periodicity: "trimestral",
  },
  {
    id: "180",
    label: "Modelo 180",
    description: "Resumen anual de retenciones de alquileres",
    periodicity: "anual",
  },
  {
    id: "303",
    label: "Modelo 303",
    description: "IVA trimestral",
    periodicity: "trimestral",
  },
]

export const DEFAULT_SETTINGS_BY_PROFILE: Record<CompanyClientProfile, CompanyFiscalSettingsDto> = {
  PERSONA_FISICA: {
    clientProfile: "PERSONA_FISICA",
    model111Enabled: false,
    model115Enabled: false,
    model180Enabled: false,
    model303Enabled: false,
  },
  AUTONOMO: {
    clientProfile: "AUTONOMO",
    model111Enabled: true,
    model115Enabled: false,
    model180Enabled: false,
    model303Enabled: true,
  },
  PYME: {
    clientProfile: "PYME",
    model111Enabled: true,
    model115Enabled: true,
    model180Enabled: true,
    model303Enabled: true,
  },
  GRAN_EMPRESA: {
    clientProfile: "GRAN_EMPRESA",
    model111Enabled: true,
    model115Enabled: true,
    model180Enabled: true,
    model303Enabled: true,
  },
}

export function isModelEnabled(
  settings: CompanyFiscalSettingsDto,
  model: FiscalModelId,
): boolean {
  switch (model) {
    case "111":
      return settings.model111Enabled
    case "115":
      return settings.model115Enabled
    case "180":
      return settings.model180Enabled
    case "303":
      return settings.model303Enabled
  }
}

export function getEnabledModels(settings: CompanyFiscalSettingsDto): FiscalModelId[] {
  return FISCAL_MODEL_OPTIONS.filter((model) => isModelEnabled(settings, model.id)).map(
    (model) => model.id,
  )
}

export type FiscalModelSettingsKey =
  | "model111Enabled"
  | "model115Enabled"
  | "model180Enabled"
  | "model303Enabled"

export function settingsKeyForModel(model: FiscalModelId): FiscalModelSettingsKey {
  switch (model) {
    case "111":
      return "model111Enabled"
    case "115":
      return "model115Enabled"
    case "180":
      return "model180Enabled"
    case "303":
      return "model303Enabled"
  }
}

export function isQuarterlyModel(model: FiscalModelId): boolean {
  return model === "111" || model === "115" || model === "303"
}

export function isAnnualModel(model: FiscalModelId): boolean {
  return model === "180"
}

export const ANNUAL_SUMMARY_MODELS: FiscalModelId[] = ["111", "115", "180", "303"]
