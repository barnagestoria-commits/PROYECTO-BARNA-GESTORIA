import { describe, expect, it } from "vitest"
import { MODEL_115_PAGE_LENGTH } from "@/lib/fiscal/aeat/generate-aeat-txt-115"
import { buildAeatTxtFilename, generateAeatTxt } from "@/lib/fiscal/aeat/generate-aeat-txt"
import { validateAeatSubmission } from "@/lib/fiscal/aeat/validate-submission"
import { buildFiscalModelDraft } from "@/lib/fiscal/model-draft/build-model-draft"
import type { FiscalModelBreakdownLine, FiscalModelDetailResponse } from "@/lib/types/fiscal-panorama"

const VALID_NIF = "B12345674"

function detail115(amount: number): FiscalModelDetailResponse {
  return {
    modelCode: "115",
    modelLabel: "Modelo 115",
    year: 2026,
    quarter: 1,
    periodLabel: "1T 2026",
    amount,
    status: "pendiente",
    statusLabel: "Pendiente",
    breakdown: [{ key: "retenciones", label: "Retenciones por arrendamientos", total: amount, lines: [] }],
  }
}

function line(
  entryId: string,
  cuenta: string,
  concepto: string,
  haber: number,
  debe: number,
  contributing = false,
): FiscalModelBreakdownLine {
  return {
    entryId,
    entryDate: "2026-02-10",
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
  const start = content.indexOf("<T11501000>")
  return content.slice(start, start + MODEL_115_PAGE_LENGTH)
}

describe("fichero DR115", () => {
  it("genera la página oficial de 500 posiciones con la retención al 19 %", () => {
    const detail = detail115(415.66)
    const content = generateAeatTxt(detail, "EMPRESA TEST S.L.", VALID_NIF).toString("latin1")
    const page = pageOf(content)

    expect(content.startsWith("<T115020261T0000>")).toBe(true)
    expect(content.endsWith("</T115020261T0000>")).toBe(true)
    expect(content.includes("\n")).toBe(false)
    expect(content.length).toBe(17 + 311 + MODEL_115_PAGE_LENGTH + 18)
    expect(content.indexOf("<T11501000>")).toBe(17 + 311)
    expect(page).toHaveLength(MODEL_115_PAGE_LENGTH)
    expect(page.endsWith("</T11501000>")).toBe(true)
    expect(page[12]).toBe("I")
    expect(page.slice(13, 22)).toBe(VALID_NIF)
    expect(page.slice(22, 37)).toBe("EMPRESA TEST SL")
    expect(page.slice(102, 106)).toBe("2026")
    expect(page.slice(106, 108)).toBe("1T")
    expect(page.slice(108, 123)).toBe("000000000000001")
    expect(page.slice(123, 140)).toBe("00000000000218768")
    expect(page.slice(140, 157)).toBe("00000000000041566")
    expect(page.slice(157, 174)).toBe("00000000000000000")
    expect(page.slice(174, 191)).toBe("00000000000041566")
    expect(buildAeatTxtFilename(detail, VALID_NIF)).toBe("B1234567420261T.115")
    expect(validateAeatSubmission(detail, "EMPRESA TEST S.L.", VALID_NIF).valid).toBe(true)
  })

  it("usa la base del alquiler y cuenta cada arrendador", () => {
    const detail = detail115(605.66)
    detail.breakdown = [
      {
        key: "retenciones",
        label: "Retenciones por arrendamientos",
        total: 605.66,
        lines: [
          line("local-a", "621000000000", "Alquiler local", 0, 2187.68),
          line("local-a", "475100000000", "Reten./VILLARONGA", 415.66, 0, true),
          line("local-b", "621000000000", "Alquiler oficina", 0, 1000),
          line("local-b", "475100000000", "Reten./GARCIA", 190, 0, true),
        ],
      },
    ]
    const page = pageOf(generateAeatTxt(detail, "EMPRESA TEST SL", VALID_NIF).toString("latin1"))
    expect(page.slice(108, 123)).toBe("000000000000002")
    expect(page.slice(123, 140)).toBe("00000000000318768")
    expect(page.slice(140, 157)).toBe("00000000000060566")
    expect(page.slice(174, 191)).toBe("00000000000060566")

    const draft = buildFiscalModelDraft(detail, "EMPRESA TEST SL", VALID_NIF)
    const amount = (code: string) =>
      draft.sections.flatMap((section) => section.casillas).find((cell) => cell.code === code)?.amount
    expect(amount("01")).toBe(2)
    expect(amount("02")).toBe(3187.68)
    expect(amount("03")).toBe(605.66)
    expect(amount("04")).toBe(0)
    expect(amount("05")).toBe(605.66)
    expect(draft.resultAmount).toBe(605.66)
    expect(validateAeatSubmission(detail, "EMPRESA TEST SL", VALID_NIF).valid).toBe(true)
  })

  it("no deja descargar un NIF que Hacienda rechazaría", () => {
    const validation = validateAeatSubmission(detail115(415.66), "EMPRESA TEST SL", "B12345678")
    expect(validation.valid).toBe(false)
    expect(validation.issues.some((issue) => issue.code === "DECLARANT_NIF")).toBe(true)
  })

  it("marca negativa cuando no hay retenciones", () => {
    const page = pageOf(generateAeatTxt(detail115(0), "EMPRESA TEST SL", VALID_NIF).toString("latin1"))
    expect(page[12]).toBe("N")
    expect(page.slice(108, 123)).toBe("000000000000000")
    expect(page.slice(174, 191)).toBe("00000000000000000")
  })
})
