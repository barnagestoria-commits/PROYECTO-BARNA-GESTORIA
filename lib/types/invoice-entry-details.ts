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
