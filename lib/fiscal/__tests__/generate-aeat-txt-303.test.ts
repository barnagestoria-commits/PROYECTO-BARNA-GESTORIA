import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { generateAeatTxt, buildAeatTxtFilename } from "@/lib/fiscal/aeat/generate-aeat-txt"
import { validateAeatSubmission } from "@/lib/fiscal/aeat/validate-submission"
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

beforeAll(() => {
  vi.stubEnv("AEAT_DEVELOPER_NIF", "B12345674")
  vi.stubEnv("AEAT_PROGRAM_VERSION", "0102")
})

afterAll(() => {
  vi.unstubAllEnvs()
})

describe("generateAeatTxt modelo 303 via tax-engine", () => {
  it("generates DR303 envelope without legacy 500-char records", () => {
    const buffer = generateAeatTxt(detail303, "EMPRESA TEST SL", "B12345674")
    const content = buffer.toString("latin1")

    expect(content.startsWith("<T303020261T0000>")).toBe(true)
    expect(content.endsWith("</T303020261T0000>")).toBe(true)
    expect(content).toContain("<T30301000>")
    expect(content).toContain("</T30301000>")
    expect(content).toContain("<T30303000>")
    expect(content).toContain("EMPRESA TEST SL")
    expect(content).toContain("B12345674")
    expect(content).not.toContain("\r\n")
    expect(content).not.toMatch(/^1.{499}$/m)
    expect(buildAeatTxtFilename(detail303, "B12345674")).toBe("30320261T_B12345674.303")
  })

  it("passes DR303 validation pipeline", () => {
    const validation = validateAeatSubmission(detail303, "EMPRESA TEST SL", "B12345674")
    expect(validation.valid).toBe(true)
    expect(validation.issues.filter((issue) => issue.severity === "error")).toHaveLength(0)
  })

  it("uses the client NIF as software identity during tests when AEAT_DEVELOPER_NIF is empty", () => {
    vi.stubEnv("AEAT_DEVELOPER_NIF", "")

    const validation = validateAeatSubmission(
      detail303,
      "ELGUETA VILOS MIGUEL ALEJANDRO",
      "Y1972636D",
    )
    const content = generateAeatTxt(
      detail303,
      "ELGUETA VILOS MIGUEL ALEJANDRO",
      "Y1972636D",
    ).toString("latin1")

    expect(content).toContain("Y1972636D")
    expect(content).toContain("ELGUETA VILOS MIGUEL ALEJANDRO")
    expect(validation.valid).toBe(true)

    vi.stubEnv("AEAT_DEVELOPER_NIF", "B12345674")
  })
})
