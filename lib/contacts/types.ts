export type ContactType = "cliente" | "proveedor" | "ambos"

export type PaymentMethod =
  | "transferencia"
  | "domiciliacion"
  | "efectivo"
  | "tarjeta"
  | "pagare"

export interface Contact {
  id: string
  razonSocial: string
  nif: string
  tipo: ContactType
  cuentaCliente?: string
  cuentaProveedor?: string
  email: string
  telefono: string
  direccionFiscal: string
  codigoPostal: string
  ciudad: string
  iban?: string
  formaPago: PaymentMethod
  saldoPendiente: number
}

export interface ContactTreatmentInput {
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

export interface NewContactFormData {
  razonSocial: string
  nif: string
  tipo: ContactType
  cuentaCliente: string
  cuentaProveedor: string
  email: string
  telefono: string
  direccionFiscal: string
  codigoPostal: string
  ciudad: string
  iban: string
  formaPago: PaymentMethod
  tratamientoCliente?: ContactTreatmentInput | null
  tratamientoProveedor?: ContactTreatmentInput | null
}

export type ContactTabFilter = "todos" | "clientes" | "proveedores"
