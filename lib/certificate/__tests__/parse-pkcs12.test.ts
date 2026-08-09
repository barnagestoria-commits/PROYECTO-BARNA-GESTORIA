import { describe, expect, it } from "vitest"

const SPANISH_TAX_ID =
  /^([0-9]{8}[A-Z]|[XYZ][0-9]{7}[A-Z]|[ABCDEFGHJNPQRSUVW][0-9]{7}[0-9A-J])$/i

function normalizeTaxId(value: string): string | null {
  const cleaned = value
    .trim()
    .toUpperCase()
    .replace(/^IDCES-/i, "")
    .replace(/^IDCE-/i, "")
    .replace(/[^A-Z0-9]/g, "")

  return SPANISH_TAX_ID.test(cleaned) ? cleaned : null
}

describe("certificate tax id parsing", () => {
  it("normalizes FNMT serial numbers", () => {
    expect(normalizeTaxId("IDCES-12345678Z")).toBe("12345678Z")
    expect(normalizeTaxId("idce-87654321x")).toBe("87654321X")
  })

  it("accepts NIF, NIE and CIF formats", () => {
    expect(normalizeTaxId("12345678Z")).toBe("12345678Z")
    expect(normalizeTaxId("X1234567L")).toBe("X1234567L")
    expect(normalizeTaxId("B12345678")).toBe("B12345678")
  })

  it("rejects invalid values", () => {
    expect(normalizeTaxId("")).toBeNull()
    expect(normalizeTaxId("NOT-A-NIF")).toBeNull()
  })
})
