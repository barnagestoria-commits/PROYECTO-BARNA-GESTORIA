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
    expect(draft.sections).toHaveLength(3)
    expect(draft.sections.some((section) => section.casillas.some((cell) => cell.code === "01"))).toBe(true)
    expect(draft.sections.some((section) => section.casillas.some((cell) => cell.code === "71"))).toBe(true)
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

  it("builds official casillas for modelo 111", () => {
    const detail: FiscalModelDetailResponse = {
      ...baseDetail,
      modelCode: "111",
      modelLabel: "Modelo 111",
      amount: 1500,
      breakdown: [{ key: "retenciones", label: "Retenciones practicadas", total: 1500, lines: [] }],
    }
    const draft = buildFiscalModelDraft(detail, "EMPRESA TEST SL", "B12345678")
    expect(draft.sections.some((section) => section.casillas.some((cell) => cell.code === "30" && cell.amount === 1500))).toBe(
      true,
    )
    expect(draft.sections.some((section) => section.casillas.some((cell) => cell.code === "28" && cell.amount === 1500))).toBe(
      true,
    )
    expect(draft.sections.some((section) => section.casillas.some((cell) => cell.code === "03" && cell.amount === 1500))).toBe(
      true,
    )
    expect(draft.sections.some((section) => section.casillas.some((cell) => cell.code === "09" && cell.amount === 0))).toBe(
      true,
    )
    expect(draft.resultAmount).toBe(1500)
  })

  it("separa nómina y honorarios en las casillas 03 y 09 del modelo 111", () => {
    const detail: FiscalModelDetailResponse = {
      ...baseDetail,
      modelCode: "111",
      modelLabel: "Modelo 111",
      amount: 350,
      breakdown: [
        {
          key: "retenciones",
          label: "Retenciones practicadas",
          total: 350,
          lines: [
            {
              entryId: "nomina",
              entryDate: "2026-01-31",
              lineId: "sueldo",
              cuenta: "640000000000",
              concepto: "Nomina",
              debe: 1000,
              haber: 0,
              signedAmount: 0,
              category: "asiento",
            },
            {
              entryId: "nomina",
              entryDate: "2026-01-31",
              lineId: "irpf-nomina",
              cuenta: "475100000000",
              concepto: "Reten./NOMINA",
              debe: 0,
              haber: 200,
              signedAmount: 200,
              category: "contributing",
            },
            {
              entryId: "factura",
              entryDate: "2026-02-10",
              lineId: "gasto",
              cuenta: "623000000000",
              concepto: "Honorarios",
              debe: 1000,
              haber: 0,
              signedAmount: 0,
              category: "asiento",
            },
            {
              entryId: "factura",
              entryDate: "2026-02-10",
              lineId: "irpf-factura",
              cuenta: "475100000000",
              concepto: "Reten./BARBA YESTE",
              debe: 0,
              haber: 150,
              signedAmount: 150,
              category: "contributing",
            },
          ],
        },
      ],
    }
    const draft = buildFiscalModelDraft(detail, "EMPRESA TEST SL", "B12345674")
    const amount = (code: string) =>
      draft.sections.flatMap((section) => section.casillas).find((cell) => cell.code === code)?.amount
    expect(amount("03")).toBe(200)
    expect(amount("02")).toBe(1000)
    expect(amount("09")).toBe(150)
    expect(amount("08")).toBe(1000)
    expect(amount("28")).toBe(350)
    expect(amount("30")).toBe(350)
    expect(draft.resultAmount).toBe(350)
  })

  it("builds official casillas for modelo 130 from the imported quarterly result", () => {
    const detail: FiscalModelDetailResponse = {
      ...baseDetail,
      modelCode: "130",
      modelLabel: "Modelo 130",
      amount: 1165.49,
      breakdown: [
        {
          key: "resultado-importado-a3",
          label: "Resultado fiscal importado de A3",
          total: 1165.49,
          lines: [],
        },
      ],
    }
    const draft = buildFiscalModelDraft(detail, "ELGUETA VILOS MIGUEL ALEJANDRO", "Y1972636D")
    expect(draft.nif).toBe("Y1972636D")
    expect(draft.sections[0]?.casillas.find((cell) => cell.code === "19")?.amount).toBe(1165.49)
    expect(draft.resultAmount).toBe(1165.49)
  })

  it("builds official casillas for modelo 390 annual", () => {
    const detail: FiscalModelDetailResponse = {
      ...baseDetail,
      modelCode: "390",
      modelLabel: "Modelo 390",
      quarter: "annual",
      periodLabel: "Resumen anual 2026",
      amount: 4000,
      breakdown: [{ key: "resumen-iva", label: "Resumen anual IVA", total: 4000, lines: [] }],
    }
    const draft = buildFiscalModelDraft(detail, "EMPRESA TEST SL", "B12345678")
    expect(draft.sections.some((section) => section.casillas.some((cell) => cell.code === "71"))).toBe(true)
  })

  it("builds official casillas for modelo 347 annual", () => {
    const detail: FiscalModelDetailResponse = {
      ...baseDetail,
      modelCode: "347",
      modelLabel: "Modelo 347",
      quarter: "annual",
      periodLabel: "Resumen anual 2026",
      amount: 50000,
      breakdown: [{ key: "operaciones-terceros", label: "Operaciones terceros", total: 50000, lines: [] }],
    }
    const draft = buildFiscalModelDraft(detail, "EMPRESA TEST SL", "B12345678")
    expect(draft.sections.some((section) => section.casillas.some((cell) => cell.code === "28"))).toBe(true)
  })
})
