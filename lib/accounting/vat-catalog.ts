export interface VatOperationType {
  code: string
  label: string
  description: string
}

export interface VatRateType {
  code: string
  vatPercent: number
  surchargePercent: number
  description: string
}

export interface TaxFormType {
  code: string
  label: string
}

export const VAT_OPERATION_TYPES: VatOperationType[] = [
  {
    code: "1",
    label: "Operaciones Interiores I.V.A. deducible",
    description:
      "Operaciones interiores sujetas y no exentas con derecho a deducción del IVA soportado.",
  },
  {
    code: "2",
    label: "Compensaciones Agrarias",
    description: "Compensaciones en régimen especial agrario y ganadero.",
  },
  {
    code: "3",
    label: "Adq. intracomunitaria bienes",
    description: "Adquisiciones intracomunitarias de bienes corporales.",
  },
  {
    code: "4",
    label: "Inversión del sujeto pasivo",
    description:
      "Operaciones en las que el destinatario es el obligado al ingreso del IVA (art. 84 LIVA).",
  },
  {
    code: "5",
    label: "Importaciones",
    description: "Importaciones de bienes con derecho o sin derecho a deducción.",
  },
  {
    code: "6",
    label: "I.V.A. no deducible",
    description: "Operaciones con IVA soportado sin derecho a deducción.",
  },
  {
    code: "7",
    label: "Adq. intracomunitaria servicios",
    description: "Adquisiciones intracomunitarias de servicios.",
  },
]

export const VAT_RATE_TYPES: VatRateType[] = [
  {
    code: "01",
    vatPercent: 4,
    surchargePercent: 0.5,
    description: "Tipo superreducido (4%).",
  },
  {
    code: "02",
    vatPercent: 2,
    surchargePercent: 0,
    description: "Tipo reducido especial (2%).",
  },
  {
    code: "03",
    vatPercent: 5,
    surchargePercent: 0.62,
    description: "Tipo reducido (5%).",
  },
  {
    code: "04",
    vatPercent: 21,
    surchargePercent: 5.2,
    description: "Tipo general (21%), vigente a partir de 01/09/2012.",
  },
  {
    code: "05",
    vatPercent: 10,
    surchargePercent: 1.4,
    description: "Tipo reducido (10%).",
  },
  {
    code: "06",
    vatPercent: 7.5,
    surchargePercent: 1,
    description: "Tipo reducido temporal (7,5%).",
  },
  {
    code: "07",
    vatPercent: 0,
    surchargePercent: 0,
    description: "Exento / no sujeto con derecho a deducción.",
  },
]

export const TAX_FORM_TYPES: TaxFormType[] = [
  { code: "303", label: "303 · IVA trimestral" },
  { code: "347", label: "347 · Operaciones con terceros" },
  { code: "349", label: "349 · Operaciones intracomunitarias" },
  { code: "390", label: "390 · Resumen anual IVA" },
  { code: "111", label: "111 · Retenciones IRPF" },
  { code: "115", label: "115 · Retenciones alquileres" },
]

export function findVatOperation(code: string): VatOperationType | undefined {
  return VAT_OPERATION_TYPES.find((item) => item.code === code.trim())
}

export function findVatRateType(code: string): VatRateType | undefined {
  const normalized = code.trim().padStart(2, "0")
  return VAT_RATE_TYPES.find((item) => item.code === normalized)
}

export function findTaxForm(code: string): TaxFormType | undefined {
  return TAX_FORM_TYPES.find((item) => item.code === code.trim())
}
