import type { AccountingCommandCode, AccountingEntryLine } from "@/lib/types/accounting-entry"
import type { InvoiceEntryDetails } from "@/lib/types/invoice-entry-details"
import { createEmptyLine, createLineId } from "@/lib/accounting/command-templates"
import { isEmitidaThirdPartyAccount } from "@/lib/accounting/account-suggestions"
import { isThirdPartyAccountPrefix } from "@/lib/accounting/new-account-prefix"
import {
  applyInvoiceConceptsToLines,
  isInvoiceConceptCommand,
} from "@/lib/accounting/invoice-entry-concepts"
import { findVatRateType } from "@/lib/accounting/vat-catalog"
import type { AccountTreatmentConfigDto } from "@/lib/accounting/account-treatment-types"
import { formatAccountCodeDisplay } from "@/lib/accounting/third-party-types"
import { recalculateVatQuota } from "@/lib/types/invoice-entry-details"

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function accountDigits(cuenta: string): string {
  return cuenta.replace(/\D/g, "")
}

function isVatAccount(cuenta: string): boolean {
  const digits = accountDigits(cuenta)
  return digits.startsWith("472") || digits.startsWith("477")
}

function isBaseAccount(cuenta: string): boolean {
  const digits = accountDigits(cuenta)
  return /^[567]/.test(digits) && !isVatAccount(cuenta) && !isThirdPartyAccountPrefix(cuenta)
}

function isIrpfAccount(cuenta: string): boolean {
  const digits = accountDigits(cuenta)
  return digits.startsWith("473") || digits.startsWith("4751")
}

export function applyTreatmentToInvoiceDetails(
  details: InvoiceEntryDetails,
  treatment: AccountTreatmentConfigDto,
): InvoiceEntryDetails {
  const vatType = treatment.defaultVatType ?? "04"
  const rate = findVatRateType(vatType)
  const vatLine = recalculateVatQuota({
    ...(details.vatLines[0] ?? {
      id: `vat-${Date.now()}`,
      operation: "1",
      base: 0,
      vatType: "04",
      vatPercent: 21,
      quota: 0,
      taxForm: "347",
    }),
    operation: treatment.defaultVatOperation ?? "1",
    vatType,
    vatPercent: treatment.defaultVatPercent ?? rate?.vatPercent ?? 21,
    taxForm: treatment.defaultTaxForm ?? "347",
  })

  return {
    ...details,
    vatLines: [vatLine, ...details.vatLines.slice(1)],
    irpfPercent: treatment.defaultIrpfPercent ?? 0,
    irpfAccount: treatment.defaultIrpfAccount ?? "",
    applyIrpf: Boolean(treatment.defaultIrpfPercent && treatment.defaultIrpfPercent > 0),
  }
}

export function applyTreatmentToEntryLines(
  lines: AccountingEntryLine[],
  treatment: AccountTreatmentConfigDto,
  options: {
    activeCommand?: string | null
    thirdPartyRow?: number
  } = {},
): AccountingEntryLine[] {
  const thirdIdx =
    options.thirdPartyRow ??
    lines.findIndex((line) => isThirdPartyAccountPrefix(line.cuenta))

  if (thirdIdx < 0) return lines

  const thirdPartyAccount = lines[thirdIdx]?.cuenta ?? ""
  const emitida =
    options.activeCommand === "17" ||
    (options.activeCommand !== "34" && isEmitidaThirdPartyAccount(thirdPartyAccount))

  const counterpart = treatment.defaultCounterpartAccount?.trim()
  const vatAccount = emitida ? "477" : "472"
  const irpfAccount = treatment.defaultIrpfAccount?.trim() || (emitida ? "4731" : "4751")

  let next = [...lines]

  if (counterpart) {
    const formattedCounterpart = formatAccountCodeDisplay(counterpart)
    const baseIdx = next.findIndex((line) => isBaseAccount(line.cuenta))
    if (baseIdx >= 0) {
      next[baseIdx] = { ...next[baseIdx], cuenta: formattedCounterpart }
    }
  }

  const vatIdx = next.findIndex((line) => isVatAccount(line.cuenta))
  if (vatIdx >= 0) {
    next[vatIdx] = { ...next[vatIdx], cuenta: formatAccountCodeDisplay(vatAccount) }
  }

  const hasIrpf = Boolean(treatment.defaultIrpfPercent && treatment.defaultIrpfPercent > 0)
  const irpfIdx = next.findIndex((line) => isIrpfAccount(line.cuenta))

  if (hasIrpf) {
    const irpfLine: AccountingEntryLine = {
      id: createLineId(),
      cuenta: formatAccountCodeDisplay(irpfAccount),
      concepto: emitida ? "Retención IRPF" : "Retención practicada",
      debe: 0,
      haber: 0,
    }

    if (irpfIdx >= 0) {
      next[irpfIdx] = { ...next[irpfIdx], cuenta: irpfLine.cuenta, concepto: irpfLine.concepto }
    } else {
      next.splice(thirdIdx + 1, 0, irpfLine)
    }
  } else if (irpfIdx >= 0) {
    next = next.filter((_, index) => index !== irpfIdx)
  }

  return next
}

export interface InvoiceAmountsWithIrpf {
  base: number
  quota: number
  irpf: number
  total: number
}

export function calculateInvoiceAmountsWithIrpf(
  details: InvoiceEntryDetails,
): InvoiceAmountsWithIrpf {
  const base = details.vatLines.reduce((sum, line) => sum + (line.base || 0), 0)
  const quota = details.vatLines.reduce((sum, line) => sum + (line.quota || 0), 0)
  const roundedBase = round2(base)
  const roundedQuota = round2(quota)
  const irpf =
    details.applyIrpf && details.irpfPercent > 0
      ? round2(roundedBase * (details.irpfPercent / 100))
      : 0
  const total = round2(roundedBase + roundedQuota - irpf)

  return { base: roundedBase, quota: roundedQuota, irpf, total }
}

/** Calcula base y cuota IVA a partir del total factura (flujo A3: importe en 430/400). */
export function calculateAmountsFromTotal(
  total: number,
  details: InvoiceEntryDetails,
): InvoiceAmountsWithIrpf {
  if (total <= 0) {
    return { base: 0, quota: 0, irpf: 0, total: 0 }
  }

  const vatPercent = details.vatLines[0]?.vatPercent ?? 21
  const vatRate = vatPercent / 100
  const irpfRate =
    details.applyIrpf && details.irpfPercent > 0 ? details.irpfPercent / 100 : 0
  const divisor = 1 + vatRate - irpfRate

  const base = round2(total / divisor)
  const quota = round2(base * vatRate)
  const irpf = irpfRate > 0 ? round2(base * irpfRate) : 0
  const reconciledTotal = round2(base + quota - irpf)

  return { base, quota, irpf, total: reconciledTotal }
}

export function syncInvoiceDetailsFromAmounts(
  details: InvoiceEntryDetails,
  amounts: InvoiceAmountsWithIrpf,
): InvoiceEntryDetails {
  const vatLines = details.vatLines.map((line, index) =>
    index === 0 ? recalculateVatQuota({ ...line, base: amounts.base }) : line,
  )

  return { ...details, vatLines }
}

export function buildFullInvoiceEntry(
  lines: AccountingEntryLine[],
  details: InvoiceEntryDetails,
  options: {
    activeCommand: AccountingCommandCode | null
    invoiceMode: "emitida" | "recibida"
    total: number
  },
): { lines: AccountingEntryLine[]; details: InvoiceEntryDetails } {
  const amounts = calculateAmountsFromTotal(options.total, details)
  const nextDetails = syncInvoiceDetailsFromAmounts(details, amounts)

  let nextLines = ensureMinimumInvoiceLines(lines)
  nextLines = applyInvoiceAmountsToLines(nextLines, amounts, {
    activeCommand: options.activeCommand ?? undefined,
  })

  const conceptCode =
    options.activeCommand && isInvoiceConceptCommand(options.activeCommand)
      ? options.activeCommand
      : options.invoiceMode === "emitida"
        ? "17"
        : "34"

  nextLines = applyInvoiceConceptsToLines(nextLines, conceptCode, {
    invoiceNumber: nextDetails.invoiceNumber,
    thirdPartyLabel: nextDetails.thirdPartyName,
    invoiceMode: options.invoiceMode,
  })

  const documento = nextDetails.invoiceNumber.trim()
  if (documento) {
    nextLines = nextLines.map((line) => ({ ...line, documento }))
  }

  return { lines: nextLines, details: nextDetails }
}

export function applyInvoiceAmountsToLines(
  lines: AccountingEntryLine[],
  amounts: InvoiceAmountsWithIrpf,
  options: {
    activeCommand?: string | null
  } = {},
): AccountingEntryLine[] {
  const thirdIdx = lines.findIndex((line) => isThirdPartyAccountPrefix(line.cuenta))
  const vatIdx = lines.findIndex((line) => isVatAccount(line.cuenta))
  const baseIdx = lines.findIndex((line) => isBaseAccount(line.cuenta))
  const irpfIdx = lines.findIndex((line) => isIrpfAccount(line.cuenta))

  const thirdPartyIndex = thirdIdx >= 0 ? thirdIdx : 0
  const vatIndex = vatIdx >= 0 ? vatIdx : 1
  const baseIndex = baseIdx >= 0 ? baseIdx : 2

  const emitida =
    options.activeCommand === "17" ||
    (options.activeCommand !== "34" &&
      isEmitidaThirdPartyAccount(lines[thirdPartyIndex]?.cuenta ?? ""))

  return lines.map((line, index) => {
    if (emitida) {
      if (index === thirdPartyIndex) return { ...line, debe: amounts.total, haber: 0 }
      if (index === vatIndex) return { ...line, debe: 0, haber: amounts.quota }
      if (index === baseIndex) return { ...line, debe: 0, haber: amounts.base }
      if (index === irpfIdx && amounts.irpf > 0) {
        return { ...line, debe: amounts.irpf, haber: 0 }
      }
    } else {
      if (index === thirdPartyIndex) return { ...line, debe: 0, haber: amounts.total }
      if (index === vatIndex) return { ...line, debe: amounts.quota, haber: 0 }
      if (index === baseIndex) return { ...line, debe: amounts.base, haber: 0 }
      if (index === irpfIdx && amounts.irpf > 0) {
        return { ...line, debe: 0, haber: amounts.irpf }
      }
    }
    return line
  })
}

export function ensureMinimumInvoiceLines(lines: AccountingEntryLine[]): AccountingEntryLine[] {
  if (lines.length >= 3) return lines
  const padded = [...lines]
  while (padded.length < 3) {
    padded.push(createEmptyLine())
  }
  return padded
}
