import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  extractNativeConcept,
  extractNativeDate,
  extractNativePostAmountMarker,
  nativeJournalLineRecordStart,
  resolveNativeAccountFromMarker,
} from "@/lib/imports/a3/native-journal-record"
import { decodeLatin1 } from "@/lib/imports/a3/import-bytes"
import { buildNativePlanRegistry, parseCuDatBinarySubaccounts, parseTpPredefiDefaults } from "@/lib/imports/a3/parse-native-plan"

const exportDir = "/Users/soniamac/Downloads/E0045826"

describe("native journal record parsing", () => {
  it("uses header offset 512 for A3 v9.50 exports", () => {
    const buffer = readFileSync(join(exportDir, "0045861A.DAT"))
    expect(nativeJournalLineRecordStart(buffer)).toBe(512)
  })

  it("extracts clean IMPUESTOS concept and accounts from January export", () => {
    const buffer = readFileSync(join(exportDir, "0045861A.DAT"))
    const cu = parseCuDatBinarySubaccounts(readFileSync(join(exportDir, "004586CU.DAT")))
    const registry = buildNativePlanRegistry(cu, parseTpPredefiDefaults(readFileSync(join(exportDir, "TPREDEFI.Dat"))))

    let impuestoDebit: Buffer | null = null
    let impuestoCredit: Buffer | null = null

    for (let pos = 512; pos + 132 <= buffer.length; pos += 132) {
      const rec = buffer.subarray(pos, pos + 132)
      const text = decodeLatin1(rec)
      if (!text.includes("IMPUESTOS") || !text.includes("NRC 111")) continue
      if (text.includes("D00000000016200")) impuestoDebit = rec
      if (text.includes("H00000000016200")) impuestoCredit = rec
    }

    expect(impuestoDebit).not.toBeNull()
    expect(impuestoCredit).not.toBeNull()

    const debitText = decodeLatin1(impuestoDebit!)
    const debitDh = debitText.match(/D\d{11,14}/)!
    const concept = extractNativeConcept(debitText, debitDh.index!)
    expect(concept).toBe("IMPUESTOS - TRIBUTOS - NRC 111")
    expect(extractNativeDate(concept, impuestoDebit!, 2026, 1, null)).toBe("2026-01-13")

    const debitMarker = extractNativePostAmountMarker(impuestoDebit!)
    const creditMarker = extractNativePostAmountMarker(impuestoCredit!)
    expect(resolveNativeAccountFromMarker(debitMarker, "D", concept, registry)).toBe("475101000000")
    expect(resolveNativeAccountFromMarker(creditMarker, "H", concept, registry)).toBe("572000020000")
  })
})
