import { describe, expect, it } from "vitest"
import { generateFiscalPdf } from "@/lib/fiscal/export-fiscal-model"
import type { FiscalModelDetailResponse } from "@/lib/types/fiscal-panorama"

const sampleDetail: FiscalModelDetailResponse = {
  modelCode: "123",
  modelLabel: "Modelo 123",
  year: 2026,
  quarter: 1,
  periodLabel: "1T 2026",
  amount: 22870.38,
  status: "pendiente",
  statusLabel: "Pendiente",
  breakdown: [
    {
      key: "retenciones-dividendos",
      label: "Retenciones sobre dividendos",
      total: 22870.38,
      lines: [
        {
          entryId: "e1",
          entryDate: "2026-01-11",
          entryConcept: "Pago dividendos accionistas",
          lineId: "l1",
          cuenta: "473000000000",
          concepto: "RETENCION DIVIDENDOS",
          debe: 0,
          haber: 22870.38,
          signedAmount: 22870.38,
          category: "contributing",
        },
        {
          entryId: "e1",
          entryDate: "2026-01-11",
          entryConcept: "Pago dividendos accionistas",
          lineId: "l2",
          cuenta: "572000000000",
          concepto: "Pago dividendos",
          debe: 22870.38,
          haber: 0,
          signedAmount: 0,
          category: "asiento",
        },
      ],
    },
  ],
}

describe("generateFiscalPdf", () => {
  it("generates a valid PDF buffer with breakdown rows", async () => {
    const buffer = await generateFiscalPdf(sampleDetail, "ITALIANS DO IT BETTER S.L.")
    expect(buffer.length).toBeGreaterThan(500)
    expect(buffer.subarray(0, 4).toString()).toBe("%PDF")
  })
})
