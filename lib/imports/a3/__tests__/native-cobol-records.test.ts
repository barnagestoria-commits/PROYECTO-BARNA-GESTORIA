import { describe, expect, it } from "vitest"
import {
  cobolRecordLength,
  cobolRecordStatusByte,
  countNativeCobolRecords,
  isActiveCobolStatus,
  isDeletedCobolStatus,
  isNativeCobolFile,
  nativeCobolDataStart,
  walkNativeCobolRecords,
} from "@/lib/imports/a3/native-cobol-records"

describe("native-cobol-records", () => {
  it("detecta cabecera 30 7E y salta 128 bytes", () => {
    const buffer = Uint8Array.from([
      0x30, 0x7e, ...Array(126).fill(0),
      0x40, 0x05, ...Array(3).fill(0),
      0x20, 0x04, ...Array(2).fill(0),
    ])
    expect(isNativeCobolFile(buffer)).toBe(true)
    expect(nativeCobolDataStart(buffer)).toBe(128)
  })

  it("clasifica estados activo/borrado", () => {
    expect(cobolRecordStatusByte(0x40)).toBe("active")
    expect(cobolRecordStatusByte(0x41)).toBe("active")
    expect(cobolRecordStatusByte(0x42)).toBe("active")
    expect(cobolRecordStatusByte(0x20)).toBe("deleted")
    expect(cobolRecordStatusByte(0x21)).toBe("deleted")
    expect(cobolRecordStatusByte(0x22)).toBe("deleted")
    expect(isActiveCobolStatus(0x41)).toBe(true)
    expect(isDeletedCobolStatus(0x21)).toBe(true)
  })

  it("calcula longitud variable COBOL", () => {
    const buffer = Uint8Array.from([0x41, 0x08, 1, 2, 3, 4, 5, 6])
    expect(cobolRecordLength(buffer, 0)).toBe(264)
  })

  it("recorre solo registros activos por defecto", () => {
    const buffer = Uint8Array.from([
      0x30, 0x7e, ...Array(126).fill(0),
      0x40, 0x04, 9, 9,
      0x20, 0x03, 1, 1,
    ])
    const active = walkNativeCobolRecords(buffer)
    expect(active).toHaveLength(1)
    expect(active[0]?.status).toBe("active")

    const counts = countNativeCobolRecords(buffer)
    expect(counts.active).toBe(1)
    expect(counts.deleted).toBe(1)
  })
})
