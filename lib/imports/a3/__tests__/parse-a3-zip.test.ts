import JSZip from "jszip"
import { describe, expect, it } from "vitest"
import { parseA3ZipBuffer } from "@/lib/imports/a3/parse-a3-zip"
import { validateA3ImportPreview, summarizeImportValidation } from "@/lib/accounting/import-validation"
import {
  buildBalancedExpenseEntry,
  buildSubaccountRecord,
  buildSuenlaceRecord,
} from "@/lib/imports/a3/__tests__/fixtures/suenlace-builder"

async function buildSuenlaceZip(): Promise<Buffer> {
  const zip = new JSZip()
  zip.file("ASIENT.DAT", buildBalancedExpenseEntry(), { binary: true })
  zip.file(
    "SUBCUE.DAT",
    buildSubaccountRecord("629000000003", "SERVICIOS VARIOS") +
      buildSubaccountRecord("400000000523", "PROVEEDOR SL", { nif: "B12345678" }),
    { binary: true },
  )
  zip.file("SUBCUENT.TXT", "629000000003SERVICIOS VARIOS              \n")
  zip.file("VERSION.TXT", "a3ASESOR eco 9.50")
  return Buffer.from(await zip.generateAsync({ type: "nodebuffer" }))
}

describe("parseA3ZipBuffer (SUENLACE)", () => {
  it("parsea un ZIP SUENLACE con asientos equilibrados y subcuentas", async () => {
    const buffer = await buildSuenlaceZip()
    const preview = await parseA3ZipBuffer(buffer, "demo-2025.zip")

    expect(preview.entryCount).toBeGreaterThanOrEqual(1)
    expect(preview.subaccountCount).toBeGreaterThanOrEqual(1)
    expect(preview.contents.importMode).toBe("suenlace-matrix")

    const validation = summarizeImportValidation(validateA3ImportPreview(preview))
    expect(validation.errorCount).toBe(0)
  })

  it("conserva códigos de subcuenta en las líneas del diario", async () => {
    const buffer = await buildSuenlaceZip()
    const preview = await parseA3ZipBuffer(buffer, "demo-2025.zip")

    const allCuentas = preview.entries.flatMap((entry) => entry.lines.map((line) => line.cuenta))
    expect(allCuentas).toContain("629000000003")
    expect(allCuentas).not.toContain("629000000000")
  })
})

describe("parseA3ZipBuffer (native export — escenario Italians)", () => {
  it("detecta subcuentas no enlazadas cuando el diario usa códigos genéricos", async () => {
    const zip = new JSZip()
    zip.file("VERSION.TXT", "a3ASESOR eco 9.50")

    const genericJournal =
      buildSuenlaceRecord({
        fecha: "20250115",
        recordType: "0",
        cuenta: "629000000000",
        dh: "D",
        documento: "G001",
        lineMarker: "I",
        concepto: "GASTO A PROVEEDOR SL",
        importe: "+0000000100.00",
      }) +
      buildSuenlaceRecord({
        fecha: "20250115",
        recordType: "0",
        cuenta: "400000000000",
        dh: "H",
        documento: "G001",
        lineMarker: "U",
        concepto: "GASTO A PROVEEDOR SL",
        importe: "+0000000100.00",
      })

    zip.file("ASIENT.DAT", genericJournal, { binary: true })
    zip.file("SUBCUE.DAT", buildSubaccountRecord("629000000003", "SERVICIOS IT"), { binary: true })

    const buffer = Buffer.from(await zip.generateAsync({ type: "nodebuffer" }))
    const preview = await parseA3ZipBuffer(buffer, "generic-codes.zip")

    const issues = validateA3ImportPreview(preview)
    expect(issues.some((issue) => issue.code === "GENERIC_ACCOUNT_CODE")).toBe(true)
  })
})
