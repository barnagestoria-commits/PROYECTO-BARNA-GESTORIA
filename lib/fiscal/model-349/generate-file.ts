/**
 * Fichero del modelo 349. Diseño lógico del anexo de presentación telemática:
 * registro de declarante y un registro por operador y clave, 500 posiciones, ISO-8859-1.
 */
import type { FiscalModelBreakdownLine, FiscalModelDetailResponse } from "@/lib/types/fiscal-panorama"
import { isValidSpanishTaxId } from "@/lib/contacts/cif-lookup"
import { normalizeTaxId } from "@/lib/tax-id"
import { extractPrimaryEuVatId, formatEuVatIdForAeat, EU_VAT_COUNTRY_PREFIXES } from "@/lib/fiscal/eu-vat-id"
import {
  detectModel349Clave,
  MODEL_349_CLAVE_ORDER,
  type Model349Clave,
} from "@/lib/fiscal/model-349-claves"
import {
  collectModel349EntryText,
  findModel349IvaContextLine,
} from "@/lib/fiscal/model-349-base-imponible"

export const MODEL_349_RECORD_LENGTH = 500

export interface Model349FileIssue {
  code: string
  message: string
}

interface Model349Operator {
  vatId: string
  country: string
  number: string
  name: string
  clave: Model349Clave
  base: number
}

function blank(): string[] {
  return Array.from({ length: MODEL_349_RECORD_LENGTH }, () => " ")
}

function put(record: string[], position: number, value: string): void {
  for (let index = 0; index < value.length && position - 1 + index < record.length; index += 1) {
    record[position - 1 + index] = value[index] ?? " "
  }
}

function digits(value: number, length: number): string {
  return String(Math.max(0, Math.round(value))).padStart(length, "0").slice(-length)
}

function aeatName(value: string, length: number): string {
  const protectedN = value.toUpperCase().replace(/Ñ/g, "\u0001").replace(/Ç/g, "\u0002")
  const plain = protectedN
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0001/g, "Ñ")
    .replace(/\u0002/g, "Ç")
    .replace(/\./g, "")
    .replace(/[^A-Z0-9ÑÇ ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  return plain.slice(0, length).padEnd(length, " ")
}

function nifField(value: string): string {
  const nif = normalizeTaxId(value)
  if (!nif) return " ".repeat(9)
  return nif.padStart(9, "0").slice(-9)
}

function money(amount: number, length: number): string {
  return digits(Math.round(Math.abs(amount) * 100), length)
}

function cleanParty(value: string): string {
  const vat = extractPrimaryEuVatId(value)
  let text = value.replace(/^IVA\s+[SR]\.\/\s*/i, "")
  if (vat) text = text.replace(vat, " ")
  return text.replace(/-/g, " ").replace(/\s+/g, " ").trim()
}

function operatorName(line: FiscalModelBreakdownLine, sectionLines: FiscalModelBreakdownLine[]): string {
  if (line.nombre?.trim()) return line.nombre.trim()
  const context = findModel349IvaContextLine(line, sectionLines)
  const fromIva = cleanParty(context.concepto)
  if (fromIva.length >= 2) return fromIva
  const sibling = sectionLines.find((item) => {
    if (item.entryId !== line.entryId || item.lineId === line.lineId) return false
    const party = cleanParty(item.concepto)
    return party.length >= 2 && !/^IVA\s+[SR]\./i.test(item.concepto.trim())
  })
  return sibling ? cleanParty(sibling.concepto) : ""
}

function operatorVat(line: FiscalModelBreakdownLine, sectionLines: FiscalModelBreakdownLine[]): string | null {
  const fromLine = extractPrimaryEuVatId(line.nif)
  if (fromLine) return formatEuVatIdForAeat(fromLine)
  const fromText = extractPrimaryEuVatId(collectModel349EntryText(line, sectionLines))
  return fromText ? formatEuVatIdForAeat(fromText) : null
}

export function buildModel349Operators(detail: FiscalModelDetailResponse): {
  operators: Model349Operator[]
  issues: Model349FileIssue[]
} {
  const lines = detail.breakdown.flatMap((section) => section.lines)
  const contributing = lines.filter((line) => line.category === "contributing" && line.signedAmount > 0)
  const issues: Model349FileIssue[] = []
  const grouped = new Map<string, Model349Operator>()

  for (const line of contributing) {
    const sectionLines = lines.filter((item) => item.entryId === line.entryId)
    const context = findModel349IvaContextLine(line, sectionLines)
    const clave = detectModel349Clave({
      concepto: context.concepto,
      entryConcept: line.entryConcept,
      cuenta: context.cuenta,
      debe: context.debe,
      haber: context.haber,
    })
    const name = operatorName(line, sectionLines)
    const vatId = operatorVat(line, sectionLines)
    const label = name || line.concepto
    if (!vatId) {
      issues.push({
        code: "OPERATOR_VAT",
        message: `Falta el NIF-IVA de ${label}. Sin él, Hacienda rechaza el operador del modelo 349.`,
      })
      continue
    }
    const country = vatId.slice(0, 2)
    const number = vatId.slice(2)
    if (!EU_VAT_COUNTRY_PREFIXES.has(country) || number.length < 2 || number.length > 15) {
      issues.push({
        code: "OPERATOR_VAT",
        message: `El NIF-IVA ${vatId} de ${label} no tiene el formato de un operador comunitario.`,
      })
      continue
    }
    if (aeatName(name, 40).trim().length < 2) {
      issues.push({
        code: "OPERATOR_NAME",
        message: `Falta el nombre del operador ${vatId}. Hacienda lo exige en el modelo 349.`,
      })
      continue
    }

    const key = `${vatId}|${clave}`
    const current = grouped.get(key)
    if (current) {
      current.base = Math.round((current.base + line.signedAmount) * 100) / 100
    } else {
      grouped.set(key, { vatId, country, number, name, clave, base: line.signedAmount })
    }
  }

  const operators = [...grouped.values()].sort((a, b) => {
    const claveOrder = MODEL_349_CLAVE_ORDER.indexOf(a.clave) - MODEL_349_CLAVE_ORDER.indexOf(b.clave)
    if (claveOrder !== 0) return claveOrder
    return a.vatId.localeCompare(b.vatId)
  })

  if (operators.length === 0 && detail.amount > 0 && issues.length === 0) {
    issues.push({
      code: "NO_OPERATORS",
      message: "El modelo 349 tiene importe pero ningún operador con NIF-IVA. Hacienda rechazaría el fichero.",
    })
  }

  return { operators, issues }
}

export function model349FilePeriod(quarter: FiscalModelDetailResponse["quarter"]): string | null {
  if (quarter === "annual") return null
  return `${quarter}T`
}

export function model349FileIssues(
  detail: FiscalModelDetailResponse,
  companyName: string,
  companyCif: string | null | undefined,
): Model349FileIssue[] {
  const issues: Model349FileIssue[] = []
  if (!model349FilePeriod(detail.quarter)) {
    issues.push({
      code: "PERIOD",
      message: "El modelo 349 se presenta por trimestre o por mes. El resumen de este ejercicio no lleva fichero.",
    })
  }
  if (!normalizeTaxId(companyCif ?? "")) {
    issues.push({ code: "DECLARANT_NIF", message: "Falta el NIF de la empresa en la ficha." })
  } else if (!isValidSpanishTaxId(companyCif ?? "")) {
    issues.push({ code: "DECLARANT_NIF", message: "El NIF de la empresa no es válido. Hacienda rechazaría el fichero." })
  }
  if (!companyName.trim()) {
    issues.push({ code: "DECLARANT_NAME", message: "Falta la razón social de la empresa." })
  }
  issues.push(...buildModel349Operators(detail).issues)
  return issues
}

export function buildModel349Filename(
  detail: Pick<FiscalModelDetailResponse, "year" | "quarter">,
  companyCif: string | null | undefined,
): string {
  const nif = normalizeTaxId(companyCif ?? "") || "SINNIF"
  const period = model349FilePeriod(detail.quarter) ?? "0A"
  return `349${detail.year}${period}_${nif}.349`
}

export function generateModel349AeatTxt(
  detail: FiscalModelDetailResponse,
  companyName: string,
  companyCif: string | null | undefined,
): Buffer {
  const { operators } = buildModel349Operators(detail)
  const year = String(detail.year).padStart(4, "0").slice(0, 4)
  const period = model349FilePeriod(detail.quarter) ?? "0A"
  const declarantNif = nifField(companyCif ?? "")
  const declarationId = `349${year}000000`.slice(0, 13)
  const total = operators.reduce((sum, item) => sum + item.base, 0)

  const declarant = blank()
  put(declarant, 1, "1")
  put(declarant, 2, "349")
  put(declarant, 5, year)
  put(declarant, 9, declarantNif)
  put(declarant, 18, aeatName(companyName, 40))
  put(declarant, 59, "000000000")
  put(declarant, 108, declarationId)
  put(declarant, 123, digits(0, 13))
  put(declarant, 136, period)
  put(declarant, 138, digits(operators.length, 9))
  put(declarant, 147, money(total, 15))
  put(declarant, 162, digits(0, 9))
  put(declarant, 171, money(0, 15))

  const records = [declarant.join("")]
  for (const operator of operators) {
    const record = blank()
    put(record, 1, "2")
    put(record, 2, "349")
    put(record, 5, year)
    put(record, 9, declarantNif)
    put(record, 76, operator.country)
    put(record, 78, operator.number.slice(0, 15).padEnd(15, " "))
    put(record, 93, aeatName(operator.name, 40))
    put(record, 133, operator.clave)
    put(record, 134, money(operator.base, 13))
    records.push(record.join(""))
  }

  return Buffer.from(records.join("\r\n"), "latin1")
}
