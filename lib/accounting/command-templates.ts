import type {
  AccountingCommandCode,
  AccountingCommandTemplate,
  AccountingEntryLine,
  EntryTotals,
  LineValidation,
} from "@/lib/types/accounting-entry"
import {
  applyInvoiceConceptsToLines,
  isInvoiceConceptCommand,
} from "@/lib/accounting/invoice-entry-concepts"

export const ACCOUNTING_COMMANDS: Record<AccountingCommandCode, AccountingCommandTemplate> = {
  "17": {
    code: "17",
    label: "Nuestra factura (emitida)",
    description: "Factura de venta — Clientes, ingresos e IVA repercutido",
    lines: [
      { cuenta: "430", concepto: "Cliente", debe: 0, haber: 0 },
      { cuenta: "477", concepto: "Nuestra factura N. ", debe: 0, haber: 0 },
      { cuenta: "700", concepto: "Nuestra factura N. ", debe: 0, haber: 0 },
    ],
  },
  "34": {
    code: "34",
    label: "Su factura (recibida / proveedor)",
    description: "Factura de compra — Gastos, IVA soportado y proveedor",
    lines: [
      { cuenta: "400", concepto: "Proveedor", debe: 0, haber: 0 },
      { cuenta: "472", concepto: "Su factura N. ", debe: 0, haber: 0 },
      { cuenta: "600", concepto: "Su factura N. ", debe: 0, haber: 0 },
    ],
  },
  "16": {
    code: "16",
    label: "Bien de inversión",
    description: "Adquisición de inmovilizado material",
    lines: [
      { cuenta: "400", concepto: "Proveedor inmovilizado", debe: 0, haber: 0 },
      { cuenta: "472", concepto: "IVA soportado", debe: 0, haber: 0 },
      { cuenta: "213", concepto: "Maquinaria", debe: 0, haber: 0 },
    ],
  },
  "57": {
    code: "57",
    label: "Nóminas",
    description: "Registro de nómina — sueldos, SS e IRPF",
    lines: [
      { cuenta: "640", concepto: "Sueldos y salarios", debe: 0, haber: 0 },
      { cuenta: "642", concepto: "SS a cargo de la empresa", debe: 0, haber: 0 },
      { cuenta: "4751", concepto: "Hacienda Pública, acreedora IRPF", debe: 0, haber: 0 },
      { cuenta: "476", concepto: "Organismos de la Seguridad Social", debe: 0, haber: 0 },
    ],
  },
}

export const COMMAND_CODES = Object.keys(ACCOUNTING_COMMANDS) as AccountingCommandCode[]

export function createLineId(): string {
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export function createEmptyLine(): AccountingEntryLine {
  return { id: createLineId(), cuenta: "", concepto: "", debe: 0, haber: 0 }
}

export function linesFromTemplate(
  code: AccountingCommandCode,
  invoiceNumber = "",
): AccountingEntryLine[] {
  const lines = ACCOUNTING_COMMANDS[code].lines.map((line) => ({
    ...line,
    id: createLineId(),
  }))

  if (isInvoiceConceptCommand(code)) {
    return applyInvoiceConceptsToLines(lines, code, invoiceNumber)
  }

  return lines
}

export function parseCommandInput(value: string): AccountingCommandCode | null {
  const trimmed = value.trim()
  if (trimmed in ACCOUNTING_COMMANDS) {
    return trimmed as AccountingCommandCode
  }
  return null
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function calculateTotals(lines: AccountingEntryLine[]): EntryTotals {
  const debe = round2(lines.reduce((sum, line) => sum + (line.debe || 0), 0))
  const haber = round2(lines.reduce((sum, line) => sum + (line.haber || 0), 0))
  const difference = round2(debe - haber)

  return {
    debe,
    haber,
    difference,
    isBalanced: Math.abs(difference) < 0.01 && (debe > 0 || haber > 0),
  }
}

function getAccountGroup(cuenta: string): number | null {
  const digits = cuenta.replace(/\D/g, "")
  if (digits.length < 1) return null
  const group = Number.parseInt(digits.charAt(0), 10)
  return Number.isNaN(group) ? null : group
}

function isExpenseAccount(cuenta: string): boolean {
  const group = getAccountGroup(cuenta)
  return group === 6
}

function isIncomeAccount(cuenta: string): boolean {
  const group = getAccountGroup(cuenta)
  return group === 7
}

export function validateEntryLines(lines: AccountingEntryLine[]): LineValidation[] {
  const validations: LineValidation[] = []

  for (const line of lines) {
    const cuenta = line.cuenta.trim()
    if (!cuenta) continue

    const debe = line.debe || 0
    const haber = line.haber || 0

    if (isExpenseAccount(cuenta)) {
      if (haber > 0 && debe === 0) {
        validations.push({
          lineId: line.id,
          message: `Cuenta ${cuenta} (gasto, grupo 6): según el PGC aumenta en el DEBE, no en el Haber.`,
          severity: "warning",
        })
      } else if (haber > 0 && haber > debe) {
        validations.push({
          lineId: line.id,
          message: `Cuenta ${cuenta} (gasto): el importe principal debería ir al DEBE.`,
          severity: "warning",
        })
      }
    }

    if (isIncomeAccount(cuenta)) {
      if (debe > 0 && haber === 0) {
        validations.push({
          lineId: line.id,
          message: `Cuenta ${cuenta} (ingreso, grupo 7): según el PGC aumenta en el HABER, no en el Debe.`,
          severity: "warning",
        })
      } else if (debe > 0 && debe > haber) {
        validations.push({
          lineId: line.id,
          message: `Cuenta ${cuenta} (ingreso): el importe principal debería ir al HABER.`,
          severity: "warning",
        })
      }
    }

    if (debe > 0 && haber > 0) {
      validations.push({
        lineId: line.id,
        message: "Una misma línea no debería tener importes simultáneos en Debe y Haber.",
        severity: "warning",
      })
    }
  }

  return validations
}

export function formatEuro(amount: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(amount)
}
