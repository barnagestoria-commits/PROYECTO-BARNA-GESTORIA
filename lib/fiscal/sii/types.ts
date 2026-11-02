export type SiiBook = "EMITIDAS" | "RECIBIDAS"

export type SiiInvoiceStatus = "LISTA" | "INCOMPLETA" | "ACEPTADA" | "RECHAZADA"

export interface SiiVatDetail {
  tipo: number
  base: number
  cuota: number
}

export interface SiiInvoiceDraft {
  entryId: string
  book: SiiBook
  ejercicio: number
  periodo: string
  numero: string
  fechaExpedicion: string
  fechaRegistro: string
  nif: string
  nombre: string
  tipoFactura: "F1" | "F2" | "R1"
  claveRegimen: "01" | "07"
  descripcion: string
  importeTotal: number
  detalles: SiiVatDetail[]
  invoiceKey: string
  status: SiiInvoiceStatus
  blockedReason: string | null
  csv: string | null
  errorMessage: string | null
}
