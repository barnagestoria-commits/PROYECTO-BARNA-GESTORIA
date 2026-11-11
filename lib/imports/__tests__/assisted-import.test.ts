import { describe, expect, it } from "vitest"
import {
  ASSISTED_ACCOUNTING_IMPORT_MAX_BYTES,
  accountingImportNeedsAssistance,
  assistedAccountingImportMessage,
} from "@/lib/imports/assisted-import"

describe("importación asistida", () => {
  it("deja pasar un ZIP pequeño y pide correo a partir de 3 MB", () => {
    expect(accountingImportNeedsAssistance(ASSISTED_ACCOUNTING_IMPORT_MAX_BYTES)).toBe(false)
    expect(accountingImportNeedsAssistance(ASSISTED_ACCOUNTING_IMPORT_MAX_BYTES + 1)).toBe(true)
    expect(assistedAccountingImportMessage()).toMatch(/infotaxlyn@gmail.com/)
  })
})