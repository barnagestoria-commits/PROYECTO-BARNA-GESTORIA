/**
 * Fichero de presentación del modelo 202.
 * Diseño DR202e25, versión 1.3 (ejercicio 2025 y siguientes).
 * Envolvente <T2020…>, bloque <AUX> y páginas 01 (700) y 02 (900).
 */
import { formatAeatNumAmount, formatAeatPercent, formatAeatSignedAmount, normalizeNif } from "@gestoria/tax-engine"
import { model202PaymentForQuarter } from "@/lib/fiscal/model-202"
import { officialModel202Amounts } from "@/lib/fiscal/official-layouts/model-202-layout"
import type { FiscalModelDetailResponse } from "@/lib/types/fiscal-panorama"

export const MODEL_202_PAGE1_LENGTH = 700
export const MODEL_202_PAGE2_LENGTH = 900
const AUX_BLOCK_LENGTH = 311

type AmountKind = "num" | "signed" | "percent"

const PAGE1_AMOUNTS: Record<string, { position: number; kind: AmountKind }> = {
  "01": { position: 149, kind: "num" },
  "02": { position: 166, kind: "num" },
  "03": { position: 183, kind: "num" },
  "04": { position: 200, kind: "signed" },
  "05": { position: 217, kind: "num" },
  "06": { position: 234, kind: "num" },
  "67": { position: 251, kind: "num" },
  "37": { position: 268, kind: "num" },
  "07": { position: 285, kind: "num" },
  "08": { position: 302, kind: "num" },
  "38": { position: 319, kind: "num" },
  "39": { position: 336, kind: "num" },
  "13": { position: 353, kind: "signed" },
  "44": { position: 370, kind: "num" },
  "14": { position: 387, kind: "num" },
  "45": { position: 404, kind: "num" },
  "46": { position: 421, kind: "num" },
}

const PAGE2_AMOUNTS: Record<string, { position: number; kind: AmountKind }> = {
  "16": { position: 13, kind: "num" },
  "17": { position: 30, kind: "percent" },
  "47": { position: 35, kind: "signed" },
  "40": { position: 52, kind: "num" },
  "48": { position: 69, kind: "num" },
  "49": { position: 86, kind: "num" },
  "18": { position: 103, kind: "num" },
  "19": { position: 120, kind: "num" },
  "20": { position: 137, kind: "signed" },
  "21": { position: 154, kind: "percent" },
  "22": { position: 159, kind: "signed" },
  "23": { position: 176, kind: "signed" },
  "24": { position: 193, kind: "percent" },
  "25": { position: 198, kind: "signed" },
  "61": { position: 215, kind: "signed" },
  "62": { position: 232, kind: "percent" },
  "63": { position: 237, kind: "signed" },
  "64": { position: 254, kind: "signed" },
  "65": { position: 271, kind: "percent" },
  "66": { position: 276, kind: "signed" },
  "50": { position: 293, kind: "num" },
  "42": { position: 310, kind: "num" },
  "51": { position: 327, kind: "num" },
  "52": { position: 344, kind: "num" },
  "26": { position: 361, kind: "num" },
  "27": { position: 378, kind: "num" },
  "28": { position: 395, kind: "num" },
  "29": { position: 412, kind: "percent" },
  "30": { position: 417, kind: "num" },
  "31": { position: 434, kind: "num" },
  "32": { position: 451, kind: "signed" },
  "33": { position: 468, kind: "num" },
  "34": { position: 485, kind: "num" },
}

const PAGE2_EXTRA_AMOUNTS = [525, 542, 559, 576, 593, 610, 627, 644, 661, 678, 695]

function createBlank(length: number): string[] {
  return Array.from({ length }, () => " ")
}

function writeAt(record: string[], position: number, value: string, length: number): void {
  const start = position - 1
  const normalized = value.slice(0, length).padEnd(length, " ")
  for (let index = 0; index < length; index += 1) {
    record[start + index] = normalized[index] ?? " "
  }
}

function formatAmount(amount: number, kind: AmountKind): string {
  if (kind === "percent") return formatAeatPercent(amount)
  if (kind === "signed") return formatAeatSignedAmount(amount)
  return formatAeatNumAmount(amount)
}

function aeatText(value: string, length: number): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/Ñ/g, "N")
    .replace(/\./g, "")
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, length)
    .padEnd(length, " ")
}

function isCompanyTaxId(nif: string): boolean {
  return /^[ABCDEFGHJNPQRSUVW]/.test(nif.trim())
}

function splitDeclarantName(companyName: string, companyTaxId: boolean): { apellidos: string; nombre: string } {
  if (companyTaxId) return { apellidos: companyName.trim(), nombre: "" }
  const value = companyName.trim().replace(/\s+/g, " ")
  if (value.includes(",")) {
    const [apellidos, nombre] = value.split(",", 2)
    return { apellidos: (apellidos ?? "").trim(), nombre: (nombre ?? "").trim() }
  }
  const parts = value.split(" ").filter(Boolean)
  if (parts.length <= 1) return { apellidos: value, nombre: "" }
  return { apellidos: parts.slice(0, -1).join(" "), nombre: parts[parts.length - 1] ?? "" }
}

export function model202FilePeriod(
  quarter: FiscalModelDetailResponse["quarter"],
): "1P" | "2P" | "3P" | null {
  if (quarter === "annual") return null
  return model202PaymentForQuarter(quarter)
}

function breakdownTotal(detail: FiscalModelDetailResponse, key: string): number {
  return detail.breakdown.find((section) => section.key === key)?.total ?? 0
}

function breakdownLabel(detail: FiscalModelDetailResponse, key: string): string {
  return detail.breakdown.find((section) => section.key === key)?.label ?? ""
}

function declarationType(amountDue: number): string {
  return amountDue > 0 ? "I" : "N"
}

function buildAuxBlock(companyCif: string | null | undefined): string {
  const configuredDeveloperNif = process.env.AEAT_DEVELOPER_NIF?.trim()
  const version = (process.env.AEAT_PROGRAM_VERSION?.trim() || "0103").slice(0, 4).padEnd(4, " ")
  const developerNif = normalizeNif(configuredDeveloperNif || companyCif)
  const aux = createBlank(AUX_BLOCK_LENGTH)
  writeAt(aux, 1, "<AUX>", 5)
  writeAt(aux, 76, version, 4)
  writeAt(aux, 84, developerNif, 9)
  writeAt(aux, 306, "</AUX>", 6)
  return aux.join("")
}

function writeAmounts(
  page: string[],
  fields: Record<string, { position: number; kind: AmountKind }>,
  amounts: Record<string, number>,
): void {
  for (const [code, field] of Object.entries(fields)) {
    const length = field.kind === "percent" ? 5 : 17
    writeAt(page, field.position, formatAmount(amounts[code] ?? 0, field.kind), length)
  }
}

export function buildModel202Pages(
  detail: FiscalModelDetailResponse,
  companyName: string,
  companyCif: string | null | undefined,
): { page1: string; page2: string } {
  const period = model202FilePeriod(detail.quarter)
  if (!period) {
    throw new Error("El modelo 202 solo se presenta en los periodos 1P, 2P y 3P.")
  }

  const nif = normalizeNif(companyCif)
  const names = splitDeclarantName(companyName || " ", isCompanyTaxId(nif))
  const amounts = officialModel202Amounts(detail)
  const modalityB = breakdownTotal(detail, "modalidad") === 3
  const due = modalityB ? amounts["34"] ?? 0 : amounts["03"] ?? 0
  const cnae = breakdownLabel(detail, "cnae").replace(/\D/g, "").slice(0, 4).padStart(4, "0")
  const taxRate = Math.round(breakdownTotal(detail, "gravamen") || 25)
  const turnoverBracket = breakdownTotal(detail, "tramo") > 0 ? "1" : "0"
  const periodStart = `0101${String(detail.year).padStart(4, "0").slice(0, 4)}`

  const page1 = createBlank(MODEL_202_PAGE1_LENGTH)
  writeAt(page1, 1, "<T20201000>", 11)
  writeAt(page1, 13, declarationType(due), 1)
  writeAt(page1, 14, nif, 9)
  writeAt(page1, 23, aeatText(names.apellidos, 60), 60)
  writeAt(page1, 83, aeatText(names.nombre, 20), 20)
  writeAt(page1, 104, String(detail.year).padStart(4, "0").slice(0, 4), 4)
  writeAt(page1, 108, period, 2)
  writeAt(page1, 110, periodStart, 8)
  writeAt(page1, 118, cnae === "0000" ? "0000" : cnae, 4)
  writeAt(page1, 132, String(taxRate).slice(0, 15).padEnd(15, " "), 15)
  writeAt(page1, 147, turnoverBracket, 1)
  writeAt(page1, 148, modalityB ? "B" : "A", 1)
  writeAmounts(page1, PAGE1_AMOUNTS, amounts)
  writeAt(page1, 689, "</T20201000>", 12)

  const page2 = createBlank(MODEL_202_PAGE2_LENGTH)
  writeAt(page2, 1, "<T20202000>", 11)
  writeAmounts(page2, PAGE2_AMOUNTS, amounts)
  for (const position of PAGE2_EXTRA_AMOUNTS) {
    writeAt(page2, position, formatAeatNumAmount(0), 17)
  }
  writeAt(page2, 889, "</T20202000>", 12)

  return { page1: page1.join(""), page2: page2.join("") }
}

export function buildModel202Filename(
  detail: Pick<FiscalModelDetailResponse, "year" | "quarter">,
  companyCif: string | null | undefined,
): string {
  const nif = normalizeNif(companyCif).trim() || "SINNIF"
  const period = model202FilePeriod(detail.quarter) ?? "0A"
  return `${nif}${detail.year}${period}.202`
}

export function generateModel202AeatTxt(
  detail: FiscalModelDetailResponse,
  companyName: string,
  companyCif: string | null | undefined,
): Buffer {
  const period = model202FilePeriod(detail.quarter)
  if (!period) {
    throw new Error("El modelo 202 solo se presenta en los periodos 1P, 2P y 3P.")
  }
  const pages = buildModel202Pages(detail, companyName, companyCif)
  const opening = `<T2020${detail.year}${period}0000>`
  const closing = `</T2020${detail.year}${period}0000>`
  const content = opening + buildAuxBlock(companyCif) + pages.page1 + pages.page2 + closing
  return Buffer.from(content, "latin1")
}

export function model202Cnae(detail: FiscalModelDetailResponse): string {
  return breakdownLabel(detail, "cnae").replace(/\D/g, "").slice(0, 4)
}
