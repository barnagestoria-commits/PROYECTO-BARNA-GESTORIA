import { canonicalAccountDigits } from "@/lib/accounting/canonical-account-code"
import { normalizeTaxId } from "@/lib/tax-id"

export class DuplicateInvoiceError extends Error {
  readonly code = "DUPLICATE_INVOICE"
  readonly duplicate: DuplicateInvoiceMatch

  constructor(duplicate: DuplicateInvoiceMatch) {
    super(
      `Esta factura ya está contabilizada (asiento ${duplicate.refNumber}, nº ${duplicate.invoiceNumber}).`,
    )
    this.name = "DuplicateInvoiceError"
    this.duplicate = duplicate
  }
}

export interface DuplicateInvoiceMatch {
  entryId: string
  refNumber: number
  invoiceNumber: string
  fecha: string
}

export interface DuplicateInvoiceProbe {
  cif?: string
  numeroFactura?: string
  fechaFactura?: string
  total?: number
  accountCode?: string
}

const MIN_INVOICE_SUFFIX = 5
const AMOUNT_TOLERANCE = 0.02

export function normalizeInvoiceNumberKey(value: string): string {
  return value.trim().toUpperCase().replace(/[\s./-]+/g, "")
}

export function invoiceNumberDigits(value: string): string {
  return normalizeInvoiceNumberKey(value).replace(/\D/g, "")
}

/** El asiento rápido a menudo solo trae los 5 u 8 últimos dígitos del número de factura. */
export function invoiceNumbersCompatible(left: string, right: string): boolean {
  const a = normalizeInvoiceNumberKey(left)
  const b = normalizeInvoiceNumberKey(right)
  if (!a || !b) return false
  if (a === b) return true

  const aDigits = invoiceNumberDigits(left)
  const bDigits = invoiceNumberDigits(right)
  if (aDigits.length >= MIN_INVOICE_SUFFIX && bDigits.length >= MIN_INVOICE_SUFFIX) {
    if (aDigits === bDigits) return true
    if (aDigits.endsWith(bDigits) || bDigits.endsWith(aDigits)) return true
  }

  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a]
  return shorter.length >= MIN_INVOICE_SUFFIX && longer.endsWith(shorter)
}

export function shouldProbeDuplicateInvoice(
  commandCode: string | null | undefined,
  probe: DuplicateInvoiceProbe,
): boolean {
  if (commandCode === "17" || commandCode === "34") return true
  const digits = invoiceNumberDigits(probe.numeroFactura ?? "")
  if (digits.length >= MIN_INVOICE_SUFFIX) return true
  if (normalizeTaxId(probe.cif ?? "") && (probe.total ?? 0) > 0) return true
  return false
}

function amountsMatch(left?: number, right?: number): boolean {
  if (!(left && left > 0) || !(right && right > 0)) return false
  return Math.abs(left - right) < AMOUNT_TOLERANCE
}

function datesMatch(left?: string, right?: string): boolean {
  const a = left?.trim().slice(0, 10) ?? ""
  const b = right?.trim().slice(0, 10) ?? ""
  return Boolean(a && b && a === b)
}

export function isDuplicateInvoiceSignal(
  incoming: DuplicateInvoiceProbe,
  stored: DuplicateInvoiceProbe,
): boolean {
  const numberHit = invoiceNumbersCompatible(
    incoming.numeroFactura ?? "",
    stored.numeroFactura ?? "",
  )
  const incomingDigits = invoiceNumberDigits(incoming.numeroFactura ?? "")
  const storedDigits = invoiceNumberDigits(stored.numeroFactura ?? "")
  const numbersContradict =
    incomingDigits.length >= MIN_INVOICE_SUFFIX &&
    storedDigits.length >= MIN_INVOICE_SUFFIX &&
    !numberHit
  const dateHit = datesMatch(incoming.fechaFactura, stored.fechaFactura)
  const amountHit = amountsMatch(incoming.total, stored.total)
  const partyHit = partiesMatch(incoming, stored)

  if (!partyHit || numbersContradict) return false
  if (numberHit) return true
  return dateHit && amountHit
}

function partiesMatch(incoming: DuplicateInvoiceProbe, stored: DuplicateInvoiceProbe): boolean {
  const incomingCif = normalizeTaxId(incoming.cif ?? "")
  const storedCif = normalizeTaxId(stored.cif ?? "")
  if (incomingCif && storedCif) return incomingCif === storedCif

  const incomingAccount = canonicalAccountDigits(incoming.accountCode ?? "")
  const storedAccount = canonicalAccountDigits(stored.accountCode ?? "")
  if (incomingAccount && storedAccount) return incomingAccount === storedAccount

  if (incomingCif && storedCif === "" && incomingAccount && storedAccount) {
    return incomingAccount === storedAccount
  }
  if (!incomingCif && !incomingAccount) return true
  if (incomingCif && !storedCif && !storedAccount) return true
  if (incomingAccount && !storedAccount && !storedCif) return true
  return false
}

