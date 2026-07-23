export interface AccountTreatmentConfigInput {
  defaultCounterpartAccount?: string | null
  defaultVatOperation?: string | null
  defaultVatType?: string | null
  defaultVatPercent?: number | null
  defaultSurchargePercent?: number | null
  applySurcharge?: boolean
  defaultIrpfPercent?: number | null
  defaultIrpfAccount?: string | null
  defaultTaxForm?: string | null
  documentAccumulationType?: string | null
}

export interface AccountTreatmentConfigDto extends AccountTreatmentConfigInput {
  id: string
  accountCode: string
  formattedAccountCode: string
}

export const DEFAULT_ACCOUNT_TREATMENT: Required<
  Pick<
    AccountTreatmentConfigInput,
    | "defaultVatOperation"
    | "defaultVatType"
    | "defaultVatPercent"
    | "defaultTaxForm"
    | "applySurcharge"
  >
> = {
  defaultVatOperation: "1",
  defaultVatType: "04",
  defaultVatPercent: 21,
  defaultTaxForm: "347",
  applySurcharge: false,
}

export const IRPF_ACCOUNT_OPTIONS = [
  { code: "4731", label: "4731 · H.P. retenciones practicadas" },
  { code: "4732", label: "4732 · H.P. retenciones arrendamientos" },
  { code: "4751", label: "4751 · H.P. acreedora por retenciones" },
] as const

export const DOCUMENT_ACCUMULATION_OPTIONS = [
  { code: "347", label: "347 · Operaciones con terceros" },
  { code: "349", label: "349 · Operaciones intracomunitarias" },
  { code: "190", label: "190 · Resumen anual retenciones" },
  { code: "180", label: "180 · Resumen anual alquileres" },
] as const

export function normalizeAccountCodeDigits(value: string): string {
  return value.replace(/\D/g, "")
}

export function emptyAccountTreatmentInput(): AccountTreatmentConfigInput {
  return {
    defaultCounterpartAccount: "",
    defaultVatOperation: DEFAULT_ACCOUNT_TREATMENT.defaultVatOperation,
    defaultVatType: DEFAULT_ACCOUNT_TREATMENT.defaultVatType,
    defaultVatPercent: DEFAULT_ACCOUNT_TREATMENT.defaultVatPercent,
    defaultSurchargePercent: 0,
    applySurcharge: false,
    defaultIrpfPercent: null,
    defaultIrpfAccount: "",
    defaultTaxForm: DEFAULT_ACCOUNT_TREATMENT.defaultTaxForm,
    documentAccumulationType: "347",
  }
}
