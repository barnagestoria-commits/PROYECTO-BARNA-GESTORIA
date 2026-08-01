import { describe, expect, it } from "vitest"
import { parseA3Amount, normalizeAccountCode, formatA3Date } from "@/lib/imports/a3/fixed-record"

describe("parseA3Amount", () => {
  it("parsea importes positivos con punto decimal", () => {
    expect(parseA3Amount("+0000000121.00")).toBe(121)
    expect(parseA3Amount("500.00")).toBe(500)
  })

  it("parsea importes con coma decimal (formato A3 sin separador de miles)", () => {
    expect(parseA3Amount("121,50")).toBe(121.5)
    // El formato SUENLACE usa "+0000000121.00"; con punto y coma mezclados se interpreta como US
    expect(parseA3Amount("1.234,56")).toBe(1.23)
  })

  it("parsea importes negativos", () => {
    expect(parseA3Amount("-0000000050.00")).toBe(-50)
  })

  it("devuelve 0 para cadenas vacías", () => {
    expect(parseA3Amount("")).toBe(0)
    expect(parseA3Amount("   ")).toBe(0)
  })

  it("redondea a 2 decimales", () => {
    expect(parseA3Amount("10.005")).toBe(10.01)
    expect(parseA3Amount("10.004")).toBe(10)
  })
})

describe("normalizeAccountCode", () => {
  it("elimina caracteres no numéricos", () => {
    expect(normalizeAccountCode("629.000.000003")).toBe("629000000003")
    expect(normalizeAccountCode(" 572000000001 ")).toBe("572000000001")
  })
})

describe("formatA3Date", () => {
  it("convierte YYYYMMDD a ISO", () => {
    expect(formatA3Date("20250115")).toBe("2025-01-15")
  })

  it("rechaza fechas inválidas", () => {
    expect(formatA3Date("20251301")).toBeNull()
    expect(formatA3Date("20250132")).toBeNull()
    expect(formatA3Date("2025011")).toBeNull()
  })
})
