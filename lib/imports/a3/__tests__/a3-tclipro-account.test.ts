import { describe, expect, it } from "vitest"
import {
  decodeTcliproRecordAccount,
  isTcliproRecordStart,
} from "@/lib/imports/a3/a3-tclipro-account"

function makeRecord(byte16: number, byte17: number): Buffer {
  const record = Buffer.alloc(536, 0)
  record[4] = 0x10
  record[5] = 0x04
  record[16] = byte16
  record[17] = byte17
  return record
}

describe("decodeTcliproRecordAccount", () => {
  it("decodes grupo 400 mercaderías (byte16=0, byte17 directo)", () => {
    expect(decodeTcliproRecordAccount(makeRecord(0, 29))).toBe("400000290000")
    expect(decodeTcliproRecordAccount(makeRecord(0, 31))).toBe("400000310000")
    expect(decodeTcliproRecordAccount(makeRecord(0, 39))).toBe("400000390000")
  })

  it("decodes grupo 410 servicios (byte17−61)", () => {
    expect(decodeTcliproRecordAccount(makeRecord(0, 161))).toBe("410001000000")
    expect(decodeTcliproRecordAccount(makeRecord(0, 253))).toBe("410001920000")
    expect(decodeTcliproRecordAccount(makeRecord(0, 65))).toBe("410000040000")
  })

  it("returns null for invalid bytes", () => {
    expect(decodeTcliproRecordAccount(makeRecord(0, 0))).toBeNull()
    expect(decodeTcliproRecordAccount(makeRecord(1, 50))).toBeNull()
  })
})

describe("isTcliproRecordStart", () => {
  it("detects TCLIPRO header signature", () => {
    const record = Buffer.alloc(20, 0)
    record[4] = 0x10
    record[5] = 0x04
    expect(isTcliproRecordStart(record, 0)).toBe(true)
    expect(isTcliproRecordStart(record, 1)).toBe(false)
  })
})
