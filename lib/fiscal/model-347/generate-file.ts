/**
 * Fichero del modelo 347. Diseño lógico de la Orden EHA/3012/2008,
 * con el campo BDNS de la Orden HAC/1431/2025 (ejercicio 2025 y siguientes).
 * Registro de declarante y registros de declarado, 500 posiciones, ISO-8859-1.
 */
import type { FiscalModelBreakdownLine, FiscalModelDetailResponse } from "@/lib/types/fiscal-panorama"
import { isValidSpanishTaxId } from "@/lib/contacts/cif-lookup"
import { normalizeTaxId } from "@/lib/tax-id"

export const MODEL_347_RECORD_LENGTH = 500

export interface Model347FileIssue {
  code: string
  message: string
}

function blank(): string[] {
  return Array.from({ length: MODEL_347_RECORD_LENGTH }, () => " ")
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
    .replace(/[^A-Z0-9ÑÇ ./ -]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  return plain.slice(0, length).padEnd(length, " ")
}

function nifField(value: string): string {
  const nif = normalizeTaxId(value)
  if (!nif) return " ".repeat(9)
  return nif.padStart(9, "0").slice(-9)
}

function money(amount: number): { sign: string; amount: string } {
  const cents = Math.round(Math.abs(amount) * 100)
  return {
    sign: amount < -0.004 ? "N" : " ",
    amount: String(cents).padStart(15, "0"),
  }
}

function declaredLines(detail: FiscalModelDetailResponse): FiscalModelBreakdownLine[] {
  return detail.breakdown.flatMap((section) => section.lines).filter((line) => line.model347)
}

export function model347FileIssues(
  detail: FiscalModelDetailResponse,
  companyName: string,
  companyCif: string | null | undefined,
): Model347FileIssue[] {
  const issues: Model347FileIssue[] = []
  if (detail.quarter !== "annual") {
    issues.push({ code: "PERIOD", message: "El modelo 347 se presenta con el ejercicio completo." })
  }
  if (!normalizeTaxId(companyCif ?? "")) {
    issues.push({ code: "DECLARANT_NIF", message: "Falta el NIF de la empresa en la ficha." })
  } else if (!isValidSpanishTaxId(companyCif ?? "")) {
    issues.push({ code: "DECLARANT_NIF", message: "El NIF de la empresa no es válido." })
  }
  if (!companyName.trim()) {
    issues.push({ code: "DECLARANT_NAME", message: "Falta la razón social de la empresa." })
  }
  const lines = declaredLines(detail)
  if (detail.breakdown.some((section) => section.key === "sii-exento")) {
    issues.push({
      code: "SII",
      message: "Esta empresa lleva los libros del IVA por el SII. El modelo 347 no se presenta.",
    })
    return issues
  }
  if (lines.length === 0) {
    issues.push({
      code: "NO_DECLARADOS",
      message: "Ningún cliente o proveedor supera 3.005,06 euros en el ejercicio. No hay que presentar el 347.",
    })
    return issues
  }
  for (const line of lines) {
    if (line.model347?.blockedReason) {
      issues.push({
        code: "DECLARADO",
        message: `${line.nombre || line.concepto}: ${line.model347.blockedReason}`,
      })
    }
  }
  return issues
}

export function generateModel347AeatTxt(
  detail: FiscalModelDetailResponse,
  companyName: string,
  companyCif: string | null | undefined,
): Buffer {
  const ready = declaredLines(detail).filter((line) => line.model347 && !line.model347.blockedReason)
  const total = ready.reduce((sum, line) => sum + line.signedAmount, 0)
  const totalMoney = money(total)
  const declarant = blank()
  put(declarant, 1, "1")
  put(declarant, 2, "347")
  put(declarant, 5, digits(detail.year, 4))
  put(declarant, 9, nifField(companyCif ?? ""))
  put(declarant, 18, aeatName(companyName, 40))
  put(declarant, 58, "T")
  put(declarant, 59, "000000000")
  put(declarant, 68, aeatName(companyName, 40))
  put(declarant, 108, `347${digits(detail.year, 4)}000000`)
  put(declarant, 123, "0000000000000")
  put(declarant, 136, digits(ready.length, 9))
  put(declarant, 145, totalMoney.sign)
  put(declarant, 146, totalMoney.amount)
  put(declarant, 161, digits(0, 9))
  put(declarant, 170, " ")
  put(declarant, 171, digits(0, 15))

  const records = [declarant.join("")]
  for (const line of ready) {
    const data = line.model347!
    const annual = money(line.signedAmount)
    const record = blank()
    put(record, 1, "2")
    put(record, 2, "347")
    put(record, 5, digits(detail.year, 4))
    put(record, 9, nifField(companyCif ?? ""))
    put(record, 18, nifField(line.nif ?? ""))
    put(record, 36, aeatName(line.nombre || line.concepto, 40))
    put(record, 76, "D")
    put(record, 77, (data.province || "00").padStart(2, "0").slice(0, 2))
    put(record, 82, data.clave)
    put(record, 83, annual.sign)
    put(record, 84, annual.amount)
    const zeroSigned = (position: number) => {
      put(record, position, " ")
      put(record, position + 1, digits(0, 15))
    }
    zeroSigned(116)
    for (const position of [152, 184, 216, 248]) zeroSigned(position)
    if (data.cashBasis) {
      for (const position of [136, 168, 200, 232]) zeroSigned(position)
      put(record, 281, "X")
      put(record, 284, annual.sign)
      put(record, 285, annual.amount)
    } else {
      const quarterPositions = [136, 168, 200, 232]
      data.quarters.forEach((amount, index) => {
        const field = money(amount)
        put(record, quarterPositions[index]!, field.sign)
        put(record, quarterPositions[index]! + 1, field.amount)
      })
    }
    if (data.isp) put(record, 282, "X")
    put(record, 101, digits(0, 15))
    put(record, 132, "0000")
    put(record, 300, "000000")
    records.push(record.join(""))
  }

  return Buffer.from(records.join("\r\n"), "latin1")
}

export function buildModel347Filename(year: number, companyCif: string | null | undefined): string {
  const nif = normalizeTaxId(companyCif ?? "") || "SINNIF"
  return `347${year}_${nif}.347`
}
