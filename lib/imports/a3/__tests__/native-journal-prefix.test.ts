import { describe, expect, it } from "vitest"
import {
  monthFromJournalFileName,
  nativeJournalFilePrefix,
} from "@/lib/imports/a3/parse-a3-native-export"

describe("nativeJournalFilePrefix", () => {
  it("resuelve 004586 para Italians (0045826)", () => {
    expect(nativeJournalFilePrefix("0045826", ["0045861A.DAT", "004586CU.DAT"])).toBe("004586")
  })

  it("resuelve 009096 para Elgueta (0090926)", () => {
    expect(nativeJournalFilePrefix("0090926", ["0090961A.DAT", "009096CU.DAT"])).toBe("009096")
  })

  it("infiere el prefijo desde los nombres de fichero", () => {
    expect(nativeJournalFilePrefix(null, ["0090963A.DAT"])).toBe("009096")
  })
})

describe("monthFromJournalFileName", () => {
  it("lee el mes del fichero mensual", () => {
    expect(monthFromJournalFileName("0090964A.DAT", "009096")).toBe(4)
    expect(monthFromJournalFileName("00458612A.DAT", "004586")).toBe(12)
  })
})
