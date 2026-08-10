import { describe, expect, it } from "vitest"
import { AEAT_RECORD_LENGTH } from "@/lib/fiscal/aeat/generate-aeat-txt"
import { validateAeatSubmission } from "@/lib/fiscal/aeat/validate-submission"
import type { FiscalModelDetailResponse } from "@/lib/types/fiscal-panorama"

function detail303(): FiscalModelDetailResponse {
  return {
    modelCode: "303",
    modelLabel: "Modelo 303",
    year: 2026,
    quarter: 1,
    periodLabel: "1T",
    amount: 100,
    status: "pendiente",
    statusLabel: "Pendiente",
    breakdown: [],
  } as FiscalModelDetailResponse
}

describe("validateAeatSubmission", () => {
  it("valida fichero BOE de 500 posiciones para modelo 303", () => {
    const result = validateAeatSubmission(detail303(), "EMPRESA TEST SL", "B12345678")
    expect(result.valid).toBe(true)
    expect(result.recordCount).toBeGreaterThan(2)
    expect(result.issues.filter((i) => i.severity === "error")).toHaveLength(0)
  })

  it("rechaza periodo anual para modelo trimestral", () => {
    const annual = { ...detail303(), quarter: "annual" as const, periodLabel: "Anual" }
    const result = validateAeatSubmission(annual, "EMPRESA TEST SL", "B12345678")
    expect(result.valid).toBe(false)
    expect(result.issues.some((i) => i.code === "PERIOD_NOT_APPLICABLE")).toBe(true)
  })

  it("expone longitud oficial de registro", () => {
    expect(AEAT_RECORD_LENGTH).toBe(500)
  })
})
