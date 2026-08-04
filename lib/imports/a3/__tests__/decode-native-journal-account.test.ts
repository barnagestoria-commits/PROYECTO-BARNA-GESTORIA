import { describe, expect, it } from "vitest"
import {
  decodeDirectDebitAccountFromRecord,
  isDirectDebitConcept,
  resolveUnidentifiedBankMovementAccount,
} from "@/lib/imports/a3/decode-native-journal-account"

function makeAdeudoRecord(byte27: number, byte28: number): Buffer {
  const record = Buffer.alloc(132, 0)
  record.write("ADEUDO POR DOMICILIACION", 30, "latin1")
  record[27] = byte27
  record[28] = byte28
  return record
}

describe("decodeDirectDebitAccountFromRecord", () => {
  it("maps insurance marker 0x23 0x29 to 625", () => {
    expect(decodeDirectDebitAccountFromRecord(makeAdeudoRecord(0x23, 0x29))).toBe("625000000000")
  })

  it("maps other adeudos to 555 pending", () => {
    expect(decodeDirectDebitAccountFromRecord(makeAdeudoRecord(0x00, 0x00))).toBe("555000000000")
    expect(decodeDirectDebitAccountFromRecord(makeAdeudoRecord(0x01, 0x00))).toBe("555000000000")
  })
})

describe("resolveUnidentifiedBankMovementAccount", () => {
  it("uses binary marker for direct debits", () => {
    const record = makeAdeudoRecord(0x23, 0x29)
    expect(resolveUnidentifiedBankMovementAccount("ADEUDO POR DOMICILIACIÓN", record)).toBe("625000000000")
  })

  it("defaults unidentified payments to 555", () => {
    expect(resolveUnidentifiedBankMovementAccount("PAGO FRA F26 0057", null)).toBe("555000000000")
  })
})

describe("isDirectDebitConcept", () => {
  it("detects adeudos and domiciliaciones", () => {
    expect(isDirectDebitConcept("ADEUDO POR DOMICILIACIÓN - N 2")).toBe(true)
    expect(isDirectDebitConcept("Gasto a SKLUM")).toBe(false)
  })
})
