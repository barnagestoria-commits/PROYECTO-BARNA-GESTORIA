import { describe, expect, it } from "vitest"
import { generateModel111AeatTxt, MODEL_111_PAGE_LENGTH } from "@/lib/fiscal/aeat/generate-aeat-txt-111"
import { buildAeatTxtFilename, generateAeatTxt } from "@/lib/fiscal/aeat/generate-aeat-txt"
import { validateAeatSubmission } from "@/lib/fiscal/aeat/validate-submission"
import type { FiscalModelBreakdownLine, FiscalModelDetailResponse } from "@/lib/types/fiscal-panorama"

const VALID_NIF = "B12345674"

function detail111(amount: number): FiscalModelDetailResponse {
  return {
    modelCode: "111",
    modelLabel: "Modelo 111",
    year: 2026,
    quarter: 1,
    periodLabel: "1T 2026",
    amount,
    status: "pendiente",
    statusLabel: "Pendiente",
    breakdown: [{ key: "retenciones", label: "Retenciones practicadas", total: amount, lines: [] }],
  }
}

function withholding(
  entryId: string,
  cuenta: string,
  concepto: string,
  haber: number,
  debe: number,
  contributing = false,
): FiscalModelBreakdownLine {
  return {
    entryId,
    entryDate: "2026-01-15",
    entryConcept: concepto,
    lineId: `${entryId}-${cuenta}`,
    cuenta,
    concepto,
    debe,
    haber,
    signedAmount: contributing ? haber : 0,
    category: contributing ? "contributing" : "asiento",
  }
}

function pageOf(content: string): string {
  const start = content.indexOf("<T11101000>")
  return content.slice(start, start + MODEL_111_PAGE_LENGTH)
}

describe("fichero DR111", () => {
  it("genera la página oficial de 1000 posiciones con las retenciones en trabajo dinerario", () => {
    const detail = detail111(1500)
    const content = generateAeatTxt(detail, "EMPRESA TEST S.L.", VALID_NIF).toString("latin1")
    const page = pageOf(content)

    expect(content.startsWith("<T111020261T0000>")).toBe(true)
    expect(content.endsWith("</T111020261T0000>")).toBe(true)
    expect(content.includes("<AUX>")).toBe(true)
    expect(content.includes("</AUX>")).toBe(true)
    expect(content.includes("\n")).toBe(false)
    expect(page).toHaveLength(MODEL_111_PAGE_LENGTH)
    expect(page.endsWith("</T11101000>")).toBe(true)
    expect(page[12]).toBe("I")
    expect(content.length).toBe(17 + 311 + MODEL_111_PAGE_LENGTH + 18)
    expect(content.slice(17, 22)).toBe("<AUX>")
    expect(content.indexOf("<T11101000>")).toBe(17 + 311)
    expect(page.slice(13, 22)).toBe(VALID_NIF)
    expect(page.slice(22, 37)).toBe("EMPRESA TEST SL")
    expect(page.slice(102, 106)).toBe("2026")
    expect(page.slice(106, 108)).toBe("1T")
    expect(page.slice(108, 116)).toBe("00000001")
    expect(page.slice(116, 133)).toBe("00000000000789474")
    expect(page.slice(133, 150)).toBe("00000000000150000")
    expect(page.slice(217, 234)).toBe("00000000000000000")
    expect(page.slice(486, 503)).toBe("00000000000150000")
    expect(page.slice(503, 520)).toBe("00000000000000000")
    expect(page.slice(520, 537)).toBe("00000000000150000")
    expect(buildAeatTxtFilename(detail, VALID_NIF)).toBe("B1234567420261T.111")

    const validation = validateAeatSubmission(detail, "EMPRESA TEST S.L.", VALID_NIF)
    expect(validation.valid).toBe(true)
    expect(validation.issues.filter((issue) => issue.severity === "error")).toEqual([])
  })

  it("no deja descargar un NIF que Hacienda rechazaría", () => {
    const validation = validateAeatSubmission(detail111(1500), "EMPRESA TEST SL", "B12345678")
    expect(validation.valid).toBe(false)
    expect(validation.issues.some((issue) => issue.code === "DECLARANT_NIF")).toBe(true)
  })

  it("lleva los honorarios a actividades económicas y la nómina a trabajo", () => {
    const detail = detail111(350)
    detail.breakdown = [
      {
        key: "retenciones",
        label: "Retenciones practicadas",
        total: 350,
        lines: [
          withholding("nomina", "640000000000", "Nomina marzo", 0, 1000),
          withholding("nomina", "475100000000", "Reten./NOMINA", 200, 0, true),
          withholding("factura", "623000000000", "Honorarios", 0, 1000),
          withholding("factura", "475100000000", "Reten./BARBA YESTE", 150, 0, true),
        ],
      },
    ]
    const page = pageOf(generateAeatTxt(detail, "EMPRESA TEST SL", VALID_NIF).toString("latin1"))

    expect(page.slice(108, 116)).toBe("00000001")
    expect(page.slice(116, 133)).toBe("00000000000100000")
    expect(page.slice(133, 150)).toBe("00000000000020000")
    expect(page.slice(192, 200)).toBe("00000001")
    expect(page.slice(200, 217)).toBe("00000000000100000")
    expect(page.slice(217, 234)).toBe("00000000000015000")
    expect(page.slice(486, 503)).toBe("00000000000035000")
    expect(page.slice(520, 537)).toBe("00000000000035000")
    expect(validateAeatSubmission(detail, "EMPRESA TEST SL", VALID_NIF).valid).toBe(true)
  })

  it("marca negativa cuando no hay nada que ingresar", () => {
    const detail = detail111(0)
    const page = pageOf(generateModel111AeatTxt(detail, "EMPRESA TEST SL", "B12345678").toString("latin1"))
    expect(page[12]).toBe("N")
    expect(page.slice(108, 116)).toBe("00000000")
    expect(page.slice(520, 537)).toBe("00000000000000000")
  })
})
