import { createBlankRecord, recordToString, writeAt } from "../../record-builder"

/** DP303DID — 823 posiciones. La sede rechaza el fichero si esta página no viene. */
export const MODEL_303_PAGE_DID_LENGTH = 823

function compactIban(value: string | null | undefined): string {
  return (value ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase()
}

function sepaMark(iban: string): string {
  if (!iban) return "0"
  if (iban.startsWith("ES")) return "1"
  const sepa = new Set([
    "AD", "AT", "BE", "BG", "CH", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GB", "GI",
    "GR", "HR", "HU", "IE", "IS", "IT", "LI", "LT", "LU", "LV", "MC", "MT", "NL", "NO", "PL",
    "PT", "RO", "SE", "SI", "SK", "SM", "VA",
  ])
  return sepa.has(iban.slice(0, 2)) ? "2" : "3"
}

export function buildModel303PageDid(taxDirectDebitIban?: string | null): string {
  const record = createBlankRecord(MODEL_303_PAGE_DID_LENGTH)
  const iban = compactIban(taxDirectDebitIban)
  writeAt(record, 1, "<T303DID00>", 11)
  if (iban) writeAt(record, 23, iban, 34)
  writeAt(record, 194, sepaMark(iban), 1)
  writeAt(record, 812, "</T303DID00>", 12)
  return recordToString(record)
}
