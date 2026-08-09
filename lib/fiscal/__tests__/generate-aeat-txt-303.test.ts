import { describe, expect, it } from "vitest"
import { generateAeatTxt } from "@/lib/fiscal/aeat/generate-aeat-txt"
import type { FiscalModelDetailResponse } from "@/lib/types/fiscal-panorama"

const detail303: FiscalModelDetailResponse = {
  modelCode: "303",
  modelLabel: "Modelo 303",
  year: 2026,
  quarter: 1,
  periodLabel: "1T 2026",
  amount: 9340.39,
  status: "pendiente",
  statusLabel: "Pendiente",
  breakdown: [
    { key: "repercutido", label: "IVA repercutido", total: 15000, lines: [] },
    { key: "soportado", label: "IVA soportado", total: 5659.61, lines: [] },
  ],
}

describe("generateAeatTxt modelo 303", () => {
  it("includes official casilla records with fixed width", () => {
    const buffer = generateAeatTxt(detail303, "EMPRESA TEST SL", "B12345678")
    const content = buffer.toString("latin1")
    expect(content).toContain("MODELO 303")
    expect(content).toContain("TOTAL CUOTA DEVENGADA")
    expect(content).toContain("RESULTADO LIQUIDACION")
    const dataLines = content.split("\r\n").filter((line) => line.startsWith("2"))
    expect(dataLines.some((line) => line.includes("TOTAL CUOTA DEVENGADA"))).toBe(true)
    expect(dataLines.some((line) => line.includes("RESULTADO LIQUIDACION"))).toBe(true)
    expect(dataLines.length).toBeGreaterThan(20)
    for (const line of dataLines) {
      expect(line.length).toBe(500)
    }
  })
})
