/**
 * Exportador BOE genérico (500 posiciones, registros 1/2/9).
 * @deprecated No conforme con diseños oficiales AEAT 2026+. Solo modelos pendientes de adaptador.
 */
import type { FiscalModelDetailResponse, FiscalModelId } from "@/lib/types/fiscal-panorama"
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

export function generateLegacyAeatTxt(
  detail: FiscalModelDetailResponse,
  companyName: string,
  companyCif: string | null | undefined,
): Buffer {
  const records = [buildIdentificationRecord(detail, companyName, companyCif)]
  const entries = buildOfficialCasillaEntries(detail)

  for (const entry of entries) {
    records.push(buildAmountRecord(entry.code, entry.amount))
  }

  records.push(buildClosingRecord())
  return Buffer.from(records.join("\r\n"), "latin1")
}

export function supportsLegacyAeatTxt(model: FiscalModelId): boolean {
  return (
    model === "111" ||
    model === "115" ||
    model === "123" ||
    model === "130" ||
    model === "180" ||
    model === "190" ||
    model === "347" ||
    model === "349" ||
    model === "390"
  )
}

export const LEGACY_AEAT_RECORD_LENGTH = RECORD_LENGTH
