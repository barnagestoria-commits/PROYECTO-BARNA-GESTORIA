import { describe, expect, it } from "vitest"
import {
  buildNativeFileIndex,
  getNativeFileByBase,
  isMacOsMetadataPath,
  normalizeA3BaseName,
} from "@/lib/imports/a3/native-file-index"

describe("native-file-index", () => {
  it("normaliza con casefold", () => {
    expect(normalizeA3BaseName("E0045826/TPREDEFI.Dat")).toBe("tpredefi.dat")
    expect(normalizeA3BaseName("folder/STAIVARE.DAT")).toBe("staivare.dat")
  })

  it("detecta metadatos macOS", () => {
    expect(isMacOsMetadataPath("__MACOSX/E0045826/._TCLIPRO.DAT")).toBe(true)
    expect(isMacOsMetadataPath("E0045826/TCLIPRO.DAT")).toBe(false)
  })

  it("resuelve ficheros sin distinguir mayúsculas", () => {
    const files = new Map<string, Uint8Array>([
      ["E0045826/TPREDEFI.Dat", Uint8Array.from([1, 2, 3])],
      ["E0045826/STAIVARE.Dat", Uint8Array.from([4, 5])],
    ])
    const index = buildNativeFileIndex(files)
    expect(getNativeFileByBase(index, "TPREDEFI.DAT")?.buffer).toEqual(Uint8Array.from([1, 2, 3]))
    expect(getNativeFileByBase(index, "staivare.dat")?.buffer).toEqual(Uint8Array.from([4, 5]))
  })
})
