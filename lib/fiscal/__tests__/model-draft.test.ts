import { describe, expect, it } from "vitest"
import { buildFiscalModelDraft } from "@/lib/fiscal/model-draft/build-model-draft"
import type { FiscalModelDetailResponse } from "@/lib/types/fiscal-panorama"

const baseDetail: FiscalModelDetailResponse = {
  modelCode: "303",
  modelLabel: "Modelo 303",
  year: 2026,
  quarter: 1,
  periodLabel: "1T 2026",
  amount: 1000,
  status: "pendiente",
  statusLabel: "Pendiente",
  breakdown: [
    { key: "repercutido", label: "IVA repercutido", total: 5000, lines: [] },
    { key: "soportado", label: "IVA soportado", total: 4000, lines: [] },
    { key: "resultado", label: "Resultado", total: 1000, lines: [] },
  ],
}

describe("buildFiscalModelDraft", () => {
  it("builds AEAT casillas for modelo 303", () => {
    const draft = buildFiscalModelDraft(baseDetail, "EMPRESA TEST SL", "B12345678")
    expect(draft.nif).toBe("B12345678")
    expect(draft.sections.some((section) => section.casillas.some((cell) => cell.code === "01"))).toBe(true)
    expect(draft.supportsGenerateEntry).toBe(true)
  })

  it("builds casillas for modelo 349", () => {
    const detail: FiscalModelDetailResponse = {
      ...baseDetail,
      modelCode: "349",
      modelLabel: "Modelo 349",
      amount: 25000,
      breakdown: [
        {
          key: "intracomunitarias",
          label: "Operaciones intracomunitarias",
          total: 25000,
          lines: [
            {
              entryId: "e1",
              entryDate: "2026-01-15",
              lineId: "l1",
              cuenta: "477000000000",
              concepto: "IVA R./CLIENTE UE",
              debe: 0,
              haber: 25000,
              signedAmount: 25000,
              category: "contributing",
            },
          ],
        },
      ],
    }

    const draft = buildFiscalModelDraft(detail, "EMPRESA TEST SL", "B12345678")
    expect(draft.sections[0].casillas.find((cell) => cell.code === "02")?.amount).toBe(25000)
    expect(draft.supportsGenerateEntry).toBe(false)
  })
})
