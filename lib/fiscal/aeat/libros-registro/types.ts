import type { InvoiceEntryDetails } from "@/lib/types/invoice-entry-details"
import type { PartyDirectoryRecord } from "@/lib/fiscal/party-identification"

export type LibrosRegistroBookKind = "issued" | "received"
export type LibrosRegistroPeriod = "1T" | "2T" | "3T" | "4T"
export type LibrosRegistroEntityType = "PERSONA_FISICA" | "PERSONA_JURIDICA"

export interface LibrosRegistroActivity {
  epigraph?: string
  description?: string
  type?: string
  isMain?: boolean
}

export interface LibrosRegistroLineInput {
  cuenta: string
  concepto: string
  debe: number
  haber: number
}

export interface LibrosRegistroEntryInput {
  id: string
  fecha: string
  issueDate?: string | null
  operationDate?: string | null
  invoiceNumber?: string | null
  commandCode?: string | null
  invoiceDetails?: InvoiceEntryDetails | null
  lines: LibrosRegistroLineInput[]
}

export interface LibrosRegistroContext {
  year: number
  throughQuarter: 1 | 2 | 3 | 4
  companyName: string
  companyCif: string
  entityType: LibrosRegistroEntityType
  includeIrpf: boolean
  activities: LibrosRegistroActivity[]
  parties: PartyDirectoryRecord[]
}

export interface LibrosRegistroActivityCodes {
  codigo: string
  tipo: string
  epigrafe: string
}

export interface IssuedLibrosRow {
  ejercicio: number
  periodo: LibrosRegistroPeriod
  actividadCodigo: string
  actividadTipo: string
  epigrafe: string
  tipoFactura: string
  conceptoIngreso: string
  ingresoComputable: number | ""
  fechaExpedicion: string
  fechaOperacion: string
  serie: string
  numero: string
  numeroFinal: string
  nifTipo: string
  nifPais: string
  nifIdentificacion: string
  nombreDestinatario: string
  claveOperacion: string
  calificacion: string
  operacionExenta: string
  totalFactura: number
  baseImponible: number
  tipoIva: number
  cuotaIva: number
  tipoRecargo: number | ""
  cuotaRecargo: number | ""
  tipoRetencion: number | ""
  importeRetenido: number | ""
  referenciaExterna: string
}

export interface ReceivedLibrosRow {
  ejercicio: number
  periodo: LibrosRegistroPeriod
  actividadCodigo: string
  actividadTipo: string
  epigrafe: string
  tipoFactura: string
  conceptoGasto: string
  gastoDeducible: number | ""
  fechaExpedicion: string
  fechaOperacion: string
  serieNumero: string
  numeroFinal: string
  fechaRecepcion: string
  numeroRecepcion: string
  numeroRecepcionFinal: string
  nifTipo: string
  nifPais: string
  nifIdentificacion: string
  nombreExpedidor: string
  claveOperacion: string
  bienInversion: string
  inversionSujetoPasivo: string
  deduciblePeriodoPosterior: string
  totalFactura: number
  baseImponible: number
  tipoIva: number
  cuotaIva: number
  cuotaDeducible: number
  tipoRecargo: number | ""
  cuotaRecargo: number | ""
  tipoRetencion: number | ""
  importeRetenido: number | ""
  referenciaExterna: string
}

export interface LibrosRegistroBooks {
  issued: IssuedLibrosRow[]
  received: ReceivedLibrosRow[]
}
