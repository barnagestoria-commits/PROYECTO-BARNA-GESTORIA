import type { FiscalModelDetailResponse, FiscalModelId } from "@/lib/types/fiscal-panorama"
import {
  buildModel303CasillaValues,
  model303CasillaEntries,
} from "@/lib/fiscal/model-303/official-layout"
import { buildOfficialCasillaEntries } from "@/lib/fiscal/official-layouts"

const RECORD_LENGTH = 500

function normalizeNif(value: string | null | undefined): string {
  return (value ?? "").replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 9).padEnd(9, " ")
}

function normalizeName(value: string): string {
  return value.toUpperCase().replace(/[^\w\sÁÉÍÓÚÜÑ./-]/gi, "").slice(0, 40).padEnd(40, " ")
}

function padLeft(value: string, length: number, char = "0"): string {
  return value.slice(0, length).padStart(length, char)
}

function padRight(value: string, length: number, char = " "): string {
  return value.slice(0, length).padEnd(length, char)
}

function formatAeatAmount(amount: number): string {
  return padLeft(Math.round(Math.abs(amount) * 100).toString(), 15)
}

function formatSignedAmount(amount: number): string {
  const sign = amount < 0 ? "N" : " "
  return `${sign}${formatAeatAmount(amount)}`
}

function buildRecord(parts: string[]): string {
  const line = parts.join("")
  if (line.length > RECORD_LENGTH) {
    return line.slice(0, RECORD_LENGTH)
  }
  return padRight(line, RECORD_LENGTH)
}

function quarterCode(quarter: FiscalModelDetailResponse["quarter"]): string {
  if (quarter === "annual") return "5"
  return String(quarter)
}

function periodLabelForFile(quarter: FiscalModelDetailResponse["quarter"]): string {
  if (quarter === "annual") return "0A"
  return `${quarter}T`
}

export function buildAeatTxtFilename(
  detail: Pick<FiscalModelDetailResponse, "modelCode" | "year" | "quarter">,
  companyCif: string | null | undefined,
): string {
  const nif = normalizeNif(companyCif).trim() || "SINNIF"
  const period = periodLabelForFile(detail.quarter)
  return `${detail.modelCode}${detail.year}${period}_${nif}.txt`
}

function buildIdentificationRecord(
  detail: FiscalModelDetailResponse,
  companyName: string,
  companyCif: string | null | undefined,
): string {
  const nif = normalizeNif(companyCif)
  const name = normalizeName(companyName || " ")
  return buildRecord([
    "1",
    padRight(detail.modelCode, 3),
    nif,
    name,
    padLeft(String(detail.year), 4),
    quarterCode(detail.quarter),
    nif,
    name,
  ])
}

function buildAmountRecord(casilla: string, amount: number): string {
  return buildRecord(["2", padLeft(casilla, 6, " "), formatSignedAmount(amount)])
}

function buildClosingRecord(): string {
  return buildRecord(["9"])
}

function buildOfficialRecords(
  detail: FiscalModelDetailResponse,
  companyName: string,
  companyCif: string | null | undefined,
): string[] {
  const records = [buildIdentificationRecord(detail, companyName, companyCif)]
  const entries =
    detail.modelCode === "303"
      ? model303CasillaEntries(buildModel303CasillaValues(detail))
      : buildOfficialCasillaEntries(detail)

  for (const entry of entries) {
    records.push(buildAmountRecord(entry.code, entry.amount))
  }

  records.push(buildClosingRecord())
  return records
}

export function generateAeatTxt(
  detail: FiscalModelDetailResponse,
  companyName: string,
  companyCif: string | null | undefined,
): Buffer {
  const records = buildOfficialRecords(detail, companyName, companyCif)
  const content = records.join("\r\n")
  return Buffer.from(content, "latin1")
}

export function supportsAeatTxtImport(model: FiscalModelId): boolean {
  return (
    model === "111" ||
    model === "115" ||
    model === "123" ||
    model === "180" ||
    model === "190" ||
    model === "303" ||
    model === "347" ||
    model === "349" ||
    model === "390"
  )
}

export function shouldOfferAeatTxt(
  detail: Pick<FiscalModelDetailResponse, "modelCode" | "quarter">,
): boolean {
  const annualModels: FiscalModelId[] = ["180", "190", "347", "390"]
  if (annualModels.includes(detail.modelCode)) return detail.quarter === "annual"
  return detail.quarter !== "annual"
}

export const AEAT_RECORD_LENGTH = RECORD_LENGTH
