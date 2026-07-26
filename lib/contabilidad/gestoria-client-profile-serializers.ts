import type { CompanyGestoriaProfile } from "@prisma/client"
import type { CompanyFiscalSettingsDto } from "@/lib/fiscal/fiscal-settings"
import {
  createEmptyGestoriaProfile,
  type GestoriaActivity,
  type GestoriaBankAccount,
  type GestoriaClientProfileDto,
  type GestoriaFormalObligations,
  type GestoriaImpresosConfig,
  type GestoriaInmovilizadoParams,
  type GestoriaLocale,
  type GestoriaModulesConfig,
  type GestoriaProrrataConfig,
  type GestoriaRelatedPerson,
} from "@/lib/contabilidad/gestoria-client-profile-types"
import { resolveCompanyAccessPath } from "@/lib/contabilidad/gestoria-companies"

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export function profileRecordToDto(
  record: CompanyGestoriaProfile,
  fiscalSettings: CompanyFiscalSettingsDto,
): GestoriaClientProfileDto {
  const base = createEmptyGestoriaProfile(record.clientCode)
  const impresosFromJson = parseJson<GestoriaImpresosConfig>(record.impresosJson, {})

  return {
    ...base,
    clientCode: record.clientCode,
    entityType: record.entityType,
    accountingPlanType: record.accountingPlanType,
    email: record.email ?? "",
    phone: record.phone ?? "",
    fax: record.fax ?? "",
    website: record.website ?? "",
    streetType: record.streetType ?? "CL",
    streetName: record.streetName ?? "",
    streetNumber: record.streetNumber ?? "",
    floor: record.floor ?? "",
    door: record.door ?? "",
    postalCode: record.postalCode ?? "",
    city: record.city ?? "",
    province: record.province ?? "",
    country: record.country ?? "ES",
    technicianName: record.technicianName ?? "",
    responsibleCode: record.responsibleCode ?? "",
    accessPath:
      record.accessPath ?? resolveCompanyAccessPath(record.clientCode, "cloud"),
    modules: parseJson<GestoriaModulesConfig>(record.modulesJson, base.modules),
    feeBank: parseJson<GestoriaBankAccount | null>(record.feeBankJson, null),
    bankAccounts: parseJson<GestoriaBankAccount[]>(record.bankAccountsJson, []),
    activities: parseJson<GestoriaActivity[]>(record.activitiesJson, []),
    relatedPersons: parseJson<GestoriaRelatedPerson[]>(record.relatedPersonsJson, []),
    formalObligations: parseJson<GestoriaFormalObligations>(
      record.formalObligationsJson,
      {},
    ),
    locales: parseJson<GestoriaLocale[]>(record.localesJson, []),
    impresos: {
      ...base.impresos,
      ...impresosFromJson,
      model111: fiscalSettings.model111Enabled,
      model115: fiscalSettings.model115Enabled,
      model180: fiscalSettings.model180Enabled,
      model303: fiscalSettings.model303Enabled,
    },
    inmovilizadoParams: parseJson<GestoriaInmovilizadoParams>(
      record.inmovilizadoParamsJson,
      base.inmovilizadoParams,
    ),
    prorrata: parseJson<GestoriaProrrataConfig>(record.prorrataJson, base.prorrata),
  }
}

export function profileDtoToRecordData(profile: GestoriaClientProfileDto) {
  const { impresos, ...rest } = profile

  return {
    clientCode: profile.clientCode,
    entityType: profile.entityType,
    accountingPlanType: profile.accountingPlanType,
    email: profile.email || null,
    phone: profile.phone || null,
    fax: profile.fax || null,
    website: profile.website || null,
    streetType: profile.streetType || null,
    streetName: profile.streetName || null,
    streetNumber: profile.streetNumber || null,
    floor: profile.floor || null,
    door: profile.door || null,
    postalCode: profile.postalCode || null,
    city: profile.city || null,
    province: profile.province || null,
    country: profile.country || null,
    technicianName: profile.technicianName || null,
    responsibleCode: profile.responsibleCode || null,
    accessPath: profile.accessPath || null,
    modulesJson: JSON.stringify(rest.modules),
    feeBankJson: profile.feeBank ? JSON.stringify(profile.feeBank) : null,
    bankAccountsJson: JSON.stringify(profile.bankAccounts),
    activitiesJson: JSON.stringify(profile.activities),
    relatedPersonsJson: JSON.stringify(profile.relatedPersons),
    formalObligationsJson: JSON.stringify(profile.formalObligations),
    localesJson: JSON.stringify(profile.locales),
    impresosJson: JSON.stringify({
      model123: impresos.model123,
      model347: impresos.model347,
      model349: impresos.model349,
      model390: impresos.model390,
      presentsViaDespacho: impresos.presentsViaDespacho,
      negativeVatCompensate: impresos.negativeVatCompensate,
      siiEnabled: impresos.siiEnabled,
    }),
    inmovilizadoParamsJson: JSON.stringify(profile.inmovilizadoParams),
    prorrataJson: JSON.stringify(profile.prorrata),
  }
}

export function fiscalSettingsFromProfileImpresos(
  profile: GestoriaClientProfileDto,
  current: CompanyFiscalSettingsDto,
): CompanyFiscalSettingsDto {
  return {
    ...current,
    model111Enabled: profile.impresos.model111 ?? current.model111Enabled,
    model115Enabled: profile.impresos.model115 ?? current.model115Enabled,
    model180Enabled: profile.impresos.model180 ?? current.model180Enabled,
    model303Enabled: profile.impresos.model303 ?? current.model303Enabled,
  }
}
