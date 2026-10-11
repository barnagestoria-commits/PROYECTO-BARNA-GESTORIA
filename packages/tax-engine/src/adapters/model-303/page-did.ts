import { createBlankRecord, recordToString, writeAt } from "../../record-builder"

/** DP303DID — 823 posiciones. La sede rechaza el fichero si esta página no viene. */
export const MODEL_303_PAGE_DID_LENGTH = 823

export function buildModel303PageDid(): string {
  const record = createBlankRecord(MODEL_303_PAGE_DID_LENGTH)
  writeAt(record, 1, "<T303DID00>", 11)
  // Sin devolución ni domiciliación: marca SEPA 0 y el resto en blanco.
  writeAt(record, 194, "0", 1)
  writeAt(record, 812, "</T303DID00>", 12)
  return recordToString(record)
}
