import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  decodeNativeAccountingDate,
  extractNativeConcept,
  extractNativeDate,
  extractNativePostAmountMarker,
  nativeJournalLineRecordStart,
  nativeJournalReference,
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
    expect(extractNativeDate(concept, impuestoDebit!, 2026, 1, null)).toBe("2026-01-19")

    const debitMarker = extractNativePostAmountMarker(impuestoDebit!)
    const creditMarker = extractNativePostAmountMarker(impuestoCredit!)
    expect(resolveNativeAccountFromMarker(debitMarker, "D", concept, registry)).toBe("475101000000")
    expect(resolveNativeAccountFromMarker(creditMarker, "H", concept, registry)).toBe("572000020000")
  })

  it("maps modelo 303 liquidation lines to settlement and bank accounts", () => {
    const registry = buildNativePlanRegistry([], parseTpPredefiDefaults(Buffer.alloc(0)))
    const concept = "Modelo 303 1 Trimestre 1 m"

    expect(resolveNativeAccountFromMarker("AC", "D", concept, registry)).toBe("555000000000")
    expect(resolveNativeAccountFromMarker("AC", "H", concept, registry)).toBe("572000000000")
  })

  it("maps modelo 115 and 130 payments to tax and bank accounts", () => {
    const registry = buildNativePlanRegistry([], parseTpPredefiDefaults(Buffer.alloc(0)))

    expect(resolveNativeAccountFromMarker("AC", "D", "Modelo 115 1 Trimestre", registry)).toBe(
      "475101000000",
    )
    expect(resolveNativeAccountFromMarker("AC", "H", "Modelo 115 1 Trimestre", registry)).toBe(
      "572000000000",
    )
    expect(resolveNativeAccountFromMarker("AC", "D", "Modelo 130 1 Trimestre", registry)).toBe(
      "473000000000",
    )
    expect(resolveNativeAccountFromMarker("AC", "H", "Modelo 130 1 Trimestre", registry)).toBe(
      "572000000000",
    )
  })

  it("preserves Reten./ concept without treating RC invoice type as an account", () => {
    const buffer = readFileSync(join(exportDir, "0045861A.DAT"))
    const cu = parseCuDatBinarySubaccounts(readFileSync(join(exportDir, "004586CU.DAT")))
    const registry = buildNativePlanRegistry(cu, parseTpPredefiDefaults(readFileSync(join(exportDir, "TPREDEFI.Dat"))))

    let retenRecord: Buffer | null = null
    for (let pos = 512; pos + 132 <= buffer.length; pos += 132) {
      const rec = buffer.subarray(pos, pos + 132)
      const text = decodeLatin1(rec)
      if (!text.includes("Reten./")) continue
      retenRecord = rec
      break
    }

    expect(retenRecord).not.toBeNull()
    const text = decodeLatin1(retenRecord!)
    const dhMatch = text.match(/H\d{11,14}/)!
    const concept = extractNativeConcept(text, dhMatch.index!)
    expect(concept).toMatch(/^Reten\.\//i)
    expect(concept).toContain("BARBA YESTE")

    const marker = extractNativePostAmountMarker(retenRecord!)
    expect(marker).toBe("RC")
    expect(resolveNativeAccountFromMarker(marker, "H", concept, registry)).toBeNull()
  })

  it("does not treat invoice refs like 2026-025 as day-of-year tags", () => {
    const buffer = readFileSync(join(exportDir, "0045864A.DAT"))
    let sample: Buffer | null = null
    for (let pos = 512; pos + 132 <= buffer.length; pos += 132) {
      const rec = buffer.subarray(pos, pos + 132)
      const text = decodeLatin1(rec)
      if (!text.includes("2026-025")) continue
      sample = rec
      break
    }

    expect(sample).not.toBeNull()
    const text = decodeLatin1(sample!)
    const dhMatch = text.match(/H\d{11,14}/)!
    const concept = extractNativeConcept(text, dhMatch.index!)
    expect(extractNativeDate(concept, sample!, 2026, 4, null)).toBe("2026-04-29")
  })

  it("decodes the binary accounting date and logical reference", () => {
    const rec = Buffer.alloc(132)
    rec[15] = 0x35
    rec[16] = 0x25
    rec[17] = 0x06
    rec.writeUInt32BE(155, 122)

    expect(decodeNativeAccountingDate(rec, 2026)).toBe("2026-01-02")
    expect(nativeJournalReference(rec)).toBe(155)
  })
})
