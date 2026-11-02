export interface InvoiceVatLine {
  id: string
  operation: string
  base: number
  vatType: string
  vatPercent: number
  quota: number
  taxForm: string
}

export interface InvoiceEntryDetails {
  invoiceNumber: string
  issueDate: string
  operationDate: string
  thirdPartyName: string
  nif: string
  isRectificativa: boolean
  /** Ejercicio de la factura errónea, cuando esta factura la rectifica. */
  rectifiedYear?: number | null
  /** Periodo 349 de esa factura: 1T-4T o 01-12. */
  rectifiedPeriod?: string | null
  /** Base que ya se declaró en ese periodo. Vacío si está en la contabilidad y se calcula sola. */
  rectifiedDeclaredBase?: number | null
  /** NIF-IVA del operador sustituido. Solo lo usa la clave C del 349. */
  substituteEuVat?: string | null
  substituteName?: string | null
  vatLines: InvoiceVatLine[]
  applyIrpf: boolean
  irpfPercent: number
  irpfAccount: string
}

export function createEmptyVatLine(): InvoiceVatLine {
  return {
    id: `vat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    operation: "1",
    base: 0,
    vatType: "04",
    vatPercent: 21,
    quota: 0,
    taxForm: "347",
  }
}

export function createDefaultInvoiceDetails(fecha: string): InvoiceEntryDetails {
  return {
    invoiceNumber: "",
    issueDate: fecha,
    operationDate: fecha,
    thirdPartyName: "",
    nif: "",
    isRectificativa: false,
    rectifiedYear: null,
    rectifiedPeriod: null,
    rectifiedDeclaredBase: null,
    substituteEuVat: null,
    substituteName: null,
    vatLines: [createEmptyVatLine()],
    applyIrpf: false,
    irpfPercent: 0,
    irpfAccount: "",
  }
}

export function recalculateVatQuota(line: InvoiceVatLine): InvoiceVatLine {
  const quota = Math.round(line.base * (line.vatPercent / 100) * 100) / 100
  return { ...line, quota }
}

export function sumInvoiceTotals(vatLines: InvoiceVatLine[]): {
  base: number
  quota: number
  total: number
} {
  const base = vatLines.reduce((sum, line) => sum + (line.base || 0), 0)
  const quota = vatLines.reduce((sum, line) => sum + (line.quota || 0), 0)
  return {
    base: Math.round(base * 100) / 100,
    quota: Math.round(quota * 100) / 100,
    total: Math.round((base + quota) * 100) / 100,
  }
}
