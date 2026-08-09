import type { CompanyClientProfile } from "@prisma/client"
import type { FiscalModelId } from "@/lib/types/fiscal-panorama"

export interface CompanyFiscalSettingsDto {
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
    id: "123",
    label: "Modelo 123",
    description: "Retenciones e ingresos a cuenta — dividendos",
    periodicity: "trimestral",
  },
  {
    id: "349",
    label: "Modelo 349",
    description: "IVA — operaciones intracomunitarias",
    periodicity: "trimestral",
  },
  {
    id: "303",
    label: "Modelo 303",
    description: "IVA trimestral",
    periodicity: "trimestral",
  },
  {
    id: "180",
    label: "Modelo 180",
    description: "Resumen anual de retenciones de alquileres",
    periodicity: "anual",
  },
  {
    id: "190",
    label: "Modelo 190",
    description: "Resumen anual de retenciones e ingresos a cuenta",
    periodicity: "anual",
  },
  {
    id: "347",
    label: "Modelo 347",
    description: "Declaración anual de operaciones con terceros",
    periodicity: "anual",
  },
  {
    id: "390",
    label: "Modelo 390",
    description: "Resumen anual de IVA",
    periodicity: "anual",
  },
]

export const DEFAULT_SETTINGS_BY_PROFILE: Record<CompanyClientProfile, CompanyFiscalSettingsDto> = {
  PERSONA_FISICA: {
    clientProfile: "PERSONA_FISICA",
    model111Enabled: false,
    model115Enabled: false,
    model123Enabled: false,
    model180Enabled: false,
    model190Enabled: false,
    model303Enabled: false,
    model347Enabled: false,
    model349Enabled: false,
    model390Enabled: false,
  },
  AUTONOMO: {
    clientProfile: "AUTONOMO",
    model111Enabled: true,
    model115Enabled: false,
    model123Enabled: false,
    model180Enabled: false,
    model190Enabled: false,
    model303Enabled: true,
    model347Enabled: false,
    model349Enabled: false,
    model390Enabled: true,
  },
  PYME: {
    clientProfile: "PYME",
    model111Enabled: true,
    model115Enabled: true,
    model123Enabled: true,
    model180Enabled: true,
    model190Enabled: true,
    model303Enabled: true,
    model347Enabled: true,
    model349Enabled: true,
    model390Enabled: true,
  },
  GRAN_EMPRESA: {
    clientProfile: "GRAN_EMPRESA",
    model111Enabled: true,
    model115Enabled: true,
    model123Enabled: true,
    model180Enabled: true,
    model190Enabled: true,
    model303Enabled: true,
    model347Enabled: true,
    model349Enabled: true,
    model390Enabled: true,
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
    case "123":
      return settings.model123Enabled
    case "180":
      return settings.model180Enabled
    case "190":
      return settings.model190Enabled
    case "303":
      return settings.model303Enabled
    case "347":
      return settings.model347Enabled
    case "349":
      return settings.model349Enabled
    case "390":
      return settings.model390Enabled
  }
}

export function getEnabledModels(settings: CompanyFiscalSettingsDto): FiscalModelId[] {
  return FISCAL_MODEL_OPTIONS.filter((model) => isModelEnabled(settings, model.id)).map(
    (model) => model.id,
  )
}

export function getEnabledQuarterlyModels(settings: CompanyFiscalSettingsDto): FiscalModelId[] {
  return FISCAL_MODEL_OPTIONS.filter(
    (model) => model.periodicity === "trimestral" && isModelEnabled(settings, model.id),
  ).map((model) => model.id)
}

export function getEnabledAnnualModels(settings: CompanyFiscalSettingsDto): FiscalModelId[] {
  return FISCAL_MODEL_OPTIONS.filter(
    (model) => model.periodicity === "anual" && isModelEnabled(settings, model.id),
  ).map((model) => model.id)
}

export function filterModelOptionsByScope(scope: "trimestral" | "anual") {
  return FISCAL_MODEL_OPTIONS.filter((model) =>
    scope === "trimestral" ? model.periodicity === "trimestral" : model.periodicity === "anual",
  )
}

export type FiscalModelSettingsKey =
  | "model111Enabled"
  | "model115Enabled"
  | "model123Enabled"
  | "model180Enabled"
  | "model190Enabled"
  | "model303Enabled"
  | "model347Enabled"
  | "model349Enabled"
  | "model390Enabled"

export function settingsKeyForModel(model: FiscalModelId): FiscalModelSettingsKey {
  switch (model) {
    case "111":
      return "model111Enabled"
    case "115":
      return "model115Enabled"
    case "123":
      return "model123Enabled"
    case "180":
      return "model180Enabled"
    case "190":
      return "model190Enabled"
    case "303":
      return "model303Enabled"
    case "347":
      return "model347Enabled"
    case "349":
      return "model349Enabled"
    case "390":
      return "model390Enabled"
  }
}

const QUARTERLY_MODELS = new Set<FiscalModelId>(["111", "115", "123", "303", "349"])
const ANNUAL_ONLY_MODELS = new Set<FiscalModelId>(["180", "190", "347", "390"])

export function isQuarterlyModel(model: FiscalModelId): boolean {
  return QUARTERLY_MODELS.has(model)
}

export function isAnnualModel(model: FiscalModelId): boolean {
  return ANNUAL_ONLY_MODELS.has(model)
}

export function isAnnualOnlyModel(model: FiscalModelId): boolean {
  return ANNUAL_ONLY_MODELS.has(model)
}

export const ANNUAL_SUMMARY_MODELS: FiscalModelId[] = [
  "111",
  "115",
  "123",
  "180",
  "190",
  "303",
  "349",
  "347",
  "390",
]

export type FiscalImpresosMergeInput = Partial<{
  model111: boolean
  model115: boolean
  model123: boolean
  model180: boolean
  model190: boolean
  model303: boolean
  model347: boolean
  model349: boolean
  model390: boolean
}>

export function mergeImpresosIntoFiscalSettings(
  settings: CompanyFiscalSettingsDto,
  impresos: FiscalImpresosMergeInput,
): CompanyFiscalSettingsDto {
  return {
    ...settings,
    model111Enabled: impresos.model111 ?? settings.model111Enabled,
    model115Enabled: impresos.model115 ?? settings.model115Enabled,
    model123Enabled: impresos.model123 ?? settings.model123Enabled,
    model180Enabled: impresos.model180 ?? settings.model180Enabled,
    model190Enabled: impresos.model190 ?? settings.model190Enabled,
    model303Enabled: impresos.model303 ?? settings.model303Enabled,
    model347Enabled: impresos.model347 ?? settings.model347Enabled,
    model349Enabled: impresos.model349 ?? settings.model349Enabled,
    model390Enabled: impresos.model390 ?? settings.model390Enabled,
  }
}
