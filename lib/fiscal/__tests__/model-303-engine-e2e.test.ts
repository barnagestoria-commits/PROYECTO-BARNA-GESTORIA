import { PDFDocument } from "pdf-lib"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import {
  buildModel303EngineResult,
  summarizeModel303EngineResult,
} from "@/lib/fiscal/model-303/engine-service"
import { generateOfficialDraftPdf } from "@/lib/fiscal/official-pdf/generate-official-draft-pdf"
import type {
  FiscalModelBreakdownLine,
  FiscalModelDetailResponse,
} from "@/lib/types/fiscal-panorama"

function line(
  lineId: string,
  entryId: string,
  cuenta: string,
  debe: number,
  haber: number,
): FiscalModelBreakdownLine {
  return {
    lineId,
    entryId,
    entryDate: "2026-03-31",
    cuenta,
    concepto: "Factura 303 E2E",
    debe,
    haber,
    signedAmount: Math.abs(debe - haber),
  }
}

function detail303(): FiscalModelDetailResponse {
  const saleLines = [
    line("sale-base", "sale-entry", "7000000", 0, 1000),
    line("sale-vat", "sale-entry", "4770000", 0, 210),
  ]
  const purchaseLines = [
    line("purchase-base", "purchase-entry", "6000000", 500, 0),
    line("purchase-vat", "purchase-entry", "4720000", 105, 0),
  ]

  return {
    modelCode: "303",
    modelLabel: "Modelo 303",
    year: 2026,
    quarter: 1,
    periodLabel: "1T 2026",
    amount: 105,
    status: "pendiente",
    statusLabel: "Pendiente",
    breakdown: [
      {
        key: "repercutido",
        label: "IVA repercutido",
        total: 210,
        lines: saleLines,
      },
      {
        key: "soportado",
        label: "IVA soportado",
        total: 105,
        lines: purchaseLines,
      },
    ],
  }
}

beforeAll(() => {
  vi.stubEnv("AEAT_DEVELOPER_NIF", "B12345674")
  vi.stubEnv("AEAT_PROGRAM_VERSION", "0102")
})

afterAll(() => {
  vi.unstubAllEnvs()
})

describe("modelo 303 end-to-end", () => {
  it("uses one engine result for casillas, traceability and DR303 export", () => {
    const result = buildModel303EngineResult(detail303(), "EMPRESA TEST SL", "B12345674")
    const summary = summarizeModel303EngineResult(result)
    const byCode = new Map(summary.casillas.map((casilla) => [casilla.code, casilla]))

    expect(summary.engine).toBe("@gestoria/tax-engine")
    expect(summary.versionKey).toBe("AEAT:303:2026:DR303e26v101")
    expect(summary.valid).toBe(true)
    expect(summary.filename).toBe("30320261T_B12345674.303")
    expect(byCode.get("01")?.amount).toBe(1000)
    expect(byCode.get("03")?.amount).toBe(210)
    expect(byCode.get("28")?.amount).toBe(500)
    expect(byCode.get("29")?.amount).toBe(105)
    expect(byCode.get("71")?.amount).toBe(105)
    expect(byCode.get("03")?.sourceCount).toBe(2)
    expect(byCode.get("29")?.sourceCount).toBe(2)
  })

  it("renders the official PDF from tax-engine casillas", async () => {
    const buffer = await generateOfficialDraftPdf(
      detail303(),
      "EMPRESA TEST SL",
      "B12345674",
    )
    const pdf = await PDFDocument.load(buffer)

    expect(buffer.byteLength).toBeGreaterThan(10_000)
    expect(pdf.getPageCount()).toBe(3)
  })
})
