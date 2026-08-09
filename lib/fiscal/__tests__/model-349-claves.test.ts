import { describe, expect, it } from "vitest"
import { detectModel349Clave, parseModel349SectionKey } from "@/lib/fiscal/model-349-claves"
import { findModel349IvaContextLine } from "@/lib/fiscal/model-349-base-imponible"
import { extractPrimaryEuVatId } from "@/lib/fiscal/eu-vat-id"
import { buildCalculationDetailRows } from "@/lib/fiscal/model-draft/calculation-rows"
import { buildFiscalModelDraft } from "@/lib/fiscal/model-draft/build-model-draft"
import type { FiscalModelDetailResponse } from "@/lib/types/fiscal-panorama"

describe("detectModel349Clave", () => {
  it("maps IVA R. to entrega de bienes (E)", () => {
    expect(
      detectModel349Clave({
        concepto: "IVA R./CLIENTE FRANCES SA",
        cuenta: "477000000000",
        debe: 0,
        haber: 2100,
      }),
    ).toBe("E")
  })

  it("maps IVA S. to adquisición de bienes (A)", () => {
    expect(
      detectModel349Clave({
        concepto: "IVA S./PROVEEDOR ALEMAN GMBH",
        cuenta: "472000000000",
        debe: 420,
        haber: 0,
      }),
    ).toBe("A")
  })

  it("maps EU service providers on IVA S. to clave I", () => {
    expect(
      detectModel349Clave({
        concepto: "IVA S./GOOGLE IRELAND LIMITED",
        cuenta: "472000000000",
        debe: 84,
        haber: 0,
      }),
    ).toBe("I")
  })

  it("maps EU service sales to clave S", () => {
    expect(
      detectModel349Clave({
        concepto: "IVA R./PRESTACION SERVICIOS IT12345678901",
        entryConcept: "Factura servicios consultoría",
        cuenta: "477000000000",
        debe: 0,
        haber: 500,
      }),
    ).toBe("S")
  })

  it("detects triangular operations (T)", () => {
    expect(
      detectModel349Clave({
        concepto: "IVA R./OPERACION TRIANGULAR PT123456789",
        cuenta: "477000000000",
        debe: 0,
        haber: 1000,
      }),
    ).toBe("T")
  })

  it("respects explicit clave in concept", () => {
    expect(
      detectModel349Clave({
        concepto: "IVA S./PROVEEDOR NL123456789 CLAVE 349-T",
        cuenta: "472000000000",
        debe: 100,
        haber: 0,
      }),
    ).toBe("T")
  })
})

describe("model 349 draft and detail rows", () => {
  const detail: FiscalModelDetailResponse = {
    modelCode: "349",
    modelLabel: "Modelo 349",
    year: 2026,
    quarter: 1,
    periodLabel: "1T 2026",
    amount: 43000,
    status: "pendiente",
    statusLabel: "Pendiente",
    breakdown: [
      {
        key: "intracomunitarias",
        label: "Operaciones intracomunitarias",
        total: 43000,
        lines: [
          {
            entryId: "e1",
            entryDate: "2026-01-15",
            lineId: "sales",
            cuenta: "700000000000",
            concepto: "Venta intracomunitaria",
            debe: 0,
            haber: 25000,
            signedAmount: 25000,
            category: "contributing",
            model349SourceLineId: "l1",
          },
          {
            entryId: "e1",
            entryDate: "2026-01-15",
            lineId: "l1",
            cuenta: "477000000000",
            concepto: "IVA R./CLIENTE FR PT123456789",
            debe: 0,
            haber: 0,
            signedAmount: 0,
            category: "asiento",
          },
          {
            entryId: "e2",
            entryDate: "2026-02-10",
            lineId: "purchase",
            cuenta: "600000000000",
            concepto: "Servicios cloud",
            debe: 18000,
            haber: 0,
            signedAmount: 18000,
            category: "contributing",
            model349SourceLineId: "l2",
          },
          {
            entryId: "e2",
            entryDate: "2026-02-10",
            lineId: "l2",
            cuenta: "472000000000",
            concepto: "IVA S./GOOGLE IRELAND IE6388047V",
            debe: 3780,
            haber: 0,
            signedAmount: 0,
            category: "asiento",
          },
        ],
      },
    ],
  }

  it("builds casillas with clave breakdown from base lines", () => {
    const draft = buildFiscalModelDraft(detail, "EMPRESA TEST SL", "B12345678")
    expect(draft.sections.some((section) => section.id === "claves-operacion")).toBe(true)

    const claves = draft.sections.find((section) => section.id === "claves-operacion")?.casillas ?? []
    expect(claves.find((cell) => cell.code === "E")?.amount).toBe(25000)
    expect(claves.find((cell) => cell.code === "I")?.amount).toBe(18000)
  })

  it("filters detail rows by clave and shows EU VAT id", () => {
    const sectionLines = detail.breakdown[0].lines
    const salesLine = sectionLines[0]
    const ivaContext = findModel349IvaContextLine(salesLine, sectionLines)
    expect(ivaContext.lineId).toBe("l1")
    expect(extractPrimaryEuVatId(ivaContext.concepto)).toBe("PT123456789")

    const clave = parseModel349SectionKey("clave-E")
    expect(clave).toBe("E")

    const rowsE = buildCalculationDetailRows(detail, "clave-E")
    expect(rowsE).toHaveLength(1)
    expect(rowsE[0].claveOperacion).toBe("E")
    expect(rowsE[0].nif).toBe("PT123456789")
    expect(rowsE[0].cuenta).toMatch(/^700/)
    expect(rowsE[0].importe).toBe(25000)

    const rowsI = buildCalculationDetailRows(detail, "clave-I")
    expect(rowsI).toHaveLength(1)
    expect(rowsI[0].claveOperacion).toBe("I")
    expect(rowsI[0].nif).toBe("IE6388047V")
    expect(rowsI[0].importe).toBe(18000)
  })
})
