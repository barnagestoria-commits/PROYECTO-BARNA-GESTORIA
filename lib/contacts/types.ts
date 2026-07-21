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
}

export type ContactTabFilter = "todos" | "clientes" | "proveedores"
