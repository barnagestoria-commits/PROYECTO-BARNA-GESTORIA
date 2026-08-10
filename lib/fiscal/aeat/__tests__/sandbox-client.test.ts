import { describe, expect, it } from "vitest"
import { validateWithOfficialAeatPipeline } from "@/lib/fiscal/aeat/sandbox-client"
import type { FiscalModelDetailResponse } from "@/lib/types/fiscal-panorama"

const detail303 = {
  modelCode: "303",
  modelLabel: "Modelo 303",
  year: 2026,
  quarter: 1,
  periodLabel: "1T",
  amount: 0,
  status: "sin_datos",
  statusLabel: "SD",
  breakdown: [],
} as FiscalModelDetailResponse

describe("validateWithOfficialAeatPipeline", () => {
  it("valida localmente conforme al diseño BOE cuando no hay sandbox", async () => {
    const result = await validateWithOfficialAeatPipeline(detail303, "EMPRESA TEST SL", "B12345678")
    expect(result.valid).toBe(true)
    expect(result.source).toBe("local-boe")
    expect(result.sandboxConfigured).toBe(false)
    expect(result.sandboxNotice).toContain("500 pos.")
  })
})
