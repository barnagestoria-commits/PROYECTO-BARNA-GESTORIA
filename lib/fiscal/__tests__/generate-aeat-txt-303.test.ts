import { describe, expect, it } from "vitest"
import { AEAT_RECORD_LENGTH, generateAeatTxt } from "@/lib/fiscal/aeat/generate-aeat-txt"
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
  it("generates only fixed-width official records without comments or branding", () => {
    const buffer = generateAeatTxt(detail303, "EMPRESA TEST SL", "B12345678")
    const content = buffer.toString("latin1")
    const lines = content.split("\r\n")

    expect(lines.some((line) => line.startsWith("#"))).toBe(false)
    expect(content).not.toContain("BARNA GESTORIA")
    expect(content).not.toContain("GENERADO POR")
    expect(content).toContain("EMPRESA TEST SL")
    expect(content).toContain("B12345678")

    expect(lines.length).toBeGreaterThan(20)
    for (const line of lines) {
      expect(line.length).toBe(AEAT_RECORD_LENGTH)
    }

    expect(lines[0]?.startsWith("1")).toBe(true)
    expect(lines.some((line) => line.startsWith("2"))).toBe(true)
    expect(lines.at(-1)?.startsWith("9")).toBe(true)
    expect(lines.some((line) => line.startsWith("3"))).toBe(false)
  })
})
