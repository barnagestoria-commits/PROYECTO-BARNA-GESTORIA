export type TipoIva = 0 | 4 | 10 | 21

export interface IvaDesgloseLine {
  base_imponible: number
  tipo_iva: TipoIva
  cuota_iva: number
}

export interface RecargoEquivalencia {
  porcentaje: number
  cuota: number
}

export type InvoicePurchaseNature = "mercaderias" | "suministros" | "reparaciones" | "servicios"

export interface InvoiceOcrResult {
  proveedor: string
  cif: string
  numeroFactura: string
  fechaFactura: string
  iva_desglose: IvaDesgloseLine[]
  recargo_equivalencia: RecargoEquivalencia | null
  baseImponible: number
  iva: number
  total: number
  isIntracomunitaria: boolean
  isSujetoPasivo: boolean
  naturalezaCompra?: InvoicePurchaseNature
  accountPrefix?: "400" | "410" | "430"
  expenseAccount?: string
  incomeAccount?: string
  classificationReason?: string
  preferredAccountCode?: string
  /** Página inicial del PDF (1-indexada) de esta factura, no del lote. */
  pagina?: number
  /** Última página inclusive de esta factura. */
  paginaFin?: number
}

export interface InvoiceOcrResponse {
  success: true
  data: InvoiceOcrResult
  invoices?: InvoiceOcrResult[]
  fileName: string
  companyId: string
  processedAt: string
}

export interface InvoiceOcrErrorResponse {
  success: false
  error: string
}

export const TIPOS_IVA: TipoIva[] = [21, 10, 4, 0]

/** Recargos de equivalencia oficiales asociados a cada tipo de IVA */
export const RECARGO_EQUIVALENCIA_POR_IVA: Record<Exclude<TipoIva, 0>, number> = {
  21: 5.2,
  10: 1.4,
  4: 0.5,
}
