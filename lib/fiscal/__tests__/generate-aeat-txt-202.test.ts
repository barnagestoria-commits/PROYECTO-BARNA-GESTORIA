import { describe, expect, it } from "vitest"
import { buildAeatTxtFilename, generateAeatTxt, shouldOfferAeatTxt } from "@/lib/fiscal/aeat/generate-aeat-txt"
import { MODEL_202_PAGE1_LENGTH, MODEL_202_PAGE2_LENGTH } from "@/lib/fiscal/aeat/generate-aeat-txt-202"
import { validateAeatSubmission } from "@/lib/fiscal/aeat/validate-submission"
import { buildOfficialModelSections } from "@/lib/fiscal/official-layouts"
import type { FiscalModelDetailResponse } from "@/lib/types/fiscal-panorama"

function detail202(overrides: Partial<FiscalModelDetailResponse> = {}): FiscalModelDetailResponse {
  return {
    modelCode: "202",
    modelLabel: "Modelo 202",
    year: 2026,
    quarter: 1,
    periodLabel: "1P 2026",
    amount: 1800,
    status: "pendiente",
    statusLabel: "Pendiente",
    breakdown: [
      { key: "modalidad", label: "ART_40_2", total: 2, lines: [] },
      { key: "c01", label: "Base", total: 10000, lines: [] },
      { key: "c03", label: "A ingresar", total: 1800, lines: [] },
      { key: "c04", label: "Resultado", total: 0, lines: [] },
      { key: "c05", label: "Aumento", total: 0, lines: [] },
      { key: "c06", label: "Disminución", total: 0, lines: [] },
      { key: "c07", label: "Resto aumentos", total: 0, lines: [] },
      { key: "c08", label: "Resto disminuciones", total: 0, lines: [] },
      { key: "c13", label: "Base previa", total: 0, lines: [] },
      { key: "c14", label: "Bases negativas", total: 0, lines: [] },
      { key: "c16", label: "Base", total: 0, lines: [] },
      { key: "c17", label: "Porcentaje", total: 18, lines: [] },
      { key: "c18", label: "Cuota", total: 0, lines: [] },
      { key: "c28", label: "Retenciones", total: 0, lines: [] },
      { key: "c30", label: "Pagos anteriores", total: 0, lines: [] },
      { key: "c32", label: "Resultado", total: 0, lines: [] },
      { key: "c33", label: "Mínimo", total: 0, lines: [] },
      { key: "c34", label: "Cantidad", total: 1800, lines: [] },
      { key: "aviso-cuota", label: "", total: 0, lines: [] },
      { key: "gravamen", label: "Tipo de gravamen", total: 25, lines: [] },
      { key: "cnae", label: "6201", total: 0, lines: [] },
      { key: "tramo", label: "Cifra de negocios", total: 0, lines: [] },
    ],
    ...overrides,
  } as FiscalModelDetailResponse
}

describe("borrador y fichero del modelo 202", () => {
  it("muestra las casillas del 40.2 y del 40.3, con el 40.3 a cero", () => {
    const codes = buildOfficialModelSections(detail202())
      .flatMap((section) => section.casillas)
      .map((cell) => cell.code)

    expect(codes).toEqual(expect.arrayContaining(["01", "02", "03", "04", "16", "17", "29", "34", "67", "19", "26"]))
    const cells = buildOfficialModelSections(detail202()).flatMap((section) => section.casillas)
    expect(cells.find((cell) => cell.code === "01")?.amount).toBe(10000)
    expect(cells.find((cell) => cell.code === "02")?.amount).toBe(0)
    expect(cells.find((cell) => cell.code === "03")?.amount).toBe(1800)
    expect(cells.find((cell) => cell.code === "04")?.amount).toBe(0)
    expect(cells.find((cell) => cell.code === "17")?.amountText).toBe("0,00 %")
    expect(cells.find((cell) => cell.code === "29")?.amountText).toBe("0,00 %")
  })

  it("sigue mostrando la casilla 01 y el resto cuando falta la cuota", () => {
    const detail = detail202()
    detail.breakdown = detail.breakdown.map((item) =>
      item.key === "aviso-cuota" ? { ...item, total: 1 } : item.key === "c01" || item.key === "c03" ? { ...item, total: 0 } : item,
    )
    detail.amount = 0
    const cells = buildOfficialModelSections(detail).flatMap((section) => section.casillas)
    expect(cells.find((cell) => cell.code === "01")?.description).toContain("cuota neta")
    expect(cells.find((cell) => cell.code === "03")).toBeTruthy()
    expect(cells.filter((cell) => cell.code === "04")).toHaveLength(1)
  })

  it("genera el diseño DR202 con las dos páginas y la extensión .202", () => {
    const detail = detail202()
    expect(shouldOfferAeatTxt(detail)).toBe(true)
    expect(shouldOfferAeatTxt({ ...detail, quarter: 2 })).toBe(false)
    expect(buildAeatTxtFilename(detail, "B67330225")).toBe("B6733022520261P.202")

    const content = generateAeatTxt(detail, "ITALIANS DO IT BETTER S.L.", "B67330225").toString("latin1")
    expect(content.startsWith("<T202020261P0000>")).toBe(true)
    expect(content.endsWith("</T202020261P0000>")).toBe(true)
    expect(content).toContain("<AUX>")
    expect(content).toContain("</AUX>")

    const page1Start = content.indexOf("<T20201000>")
    const page2Start = content.indexOf("<T20202000>")
    const page1 = content.slice(page1Start, page1Start + MODEL_202_PAGE1_LENGTH)
    const page2 = content.slice(page2Start, page2Start + MODEL_202_PAGE2_LENGTH)
    expect(page1).toHaveLength(700)
    expect(page2).toHaveLength(900)
    expect(page1.endsWith("</T20201000>")).toBe(true)
    expect(page2.endsWith("</T20202000>")).toBe(true)
    expect(page1[12]).toBe("I")
    expect(page1.slice(13, 22)).toBe("B67330225")
    expect(page1.slice(22, 46)).toBe("ITALIANS DO IT BETTER SL")
    expect(page1.slice(103, 107)).toBe("2026")
    expect(page1.slice(107, 109)).toBe("1P")
    expect(page1.slice(109, 117)).toBe("01012026")
    expect(page1.slice(117, 121)).toBe("6201")
    expect(page1.slice(131, 146)).toBe("25             ")
    expect(page1[146]).toBe("0")
    expect(page1[147]).toBe("A")
    expect(page1.slice(148, 165)).toBe("00000000001000000")
    expect(page1.slice(165, 182)).toBe("00000000000000000")
    expect(page1.slice(182, 199)).toBe("00000000000180000")
    expect(page1.slice(199, 216)).toBe("00000000000000000")
    expect(page2.slice(12, 29)).toBe("00000000000000000")
    expect(page2.slice(29, 34)).toBe("00000")
    expect(page2.slice(411, 416)).toBe("00000")

    const validation = validateAeatSubmission(detail, "ITALIANS DO IT BETTER S.L.", "B67330225")
    expect(validation.valid).toBe(true)
    expect(validation.issues.filter((issue) => issue.severity === "error")).toHaveLength(0)
  })

  it("en el 40.3 deja a cero el 40.2 y cuadra las casillas calculadas", () => {
    const detail = detail202({
      amount: 1360,
      quarter: 3,
      breakdown: [
        { key: "modalidad", label: "ART_40_3", total: 3, lines: [] },
        { key: "c01", label: "Base", total: 999, lines: [] },
        { key: "c03", label: "A ingresar", total: 999, lines: [] },
        { key: "c04", label: "Resultado", total: 8000, lines: [] },
        { key: "c05", label: "Aumento", total: 200, lines: [] },
        { key: "c06", label: "Disminución", total: 50, lines: [] },
        { key: "c07", label: "Resto aumentos", total: 100, lines: [] },
        { key: "c08", label: "Resto disminuciones", total: 25, lines: [] },
        { key: "c13", label: "Base previa", total: 8225, lines: [] },
        { key: "c14", label: "Bases negativas", total: 0, lines: [] },
        { key: "c16", label: "Base", total: 8225, lines: [] },
        { key: "c17", label: "Porcentaje", total: 17, lines: [] },
        { key: "c18", label: "Cuota", total: 1398.25, lines: [] },
        { key: "c28", label: "Retenciones", total: 0, lines: [] },
        { key: "c30", label: "Pagos anteriores", total: 0, lines: [] },
        { key: "c32", label: "Resultado", total: 1398.25, lines: [] },
        { key: "c33", label: "Mínimo", total: 0, lines: [] },
        { key: "c34", label: "Cantidad", total: 1398.25, lines: [] },
        { key: "aviso-cuota", label: "", total: 0, lines: [] },
        { key: "gravamen", label: "Tipo de gravamen", total: 25, lines: [] },
        { key: "cnae", label: "6201", total: 0, lines: [] },
        { key: "tramo", label: "Cifra de negocios", total: 0, lines: [] },
      ],
    })

    const cells = buildOfficialModelSections(detail).flatMap((section) => section.casillas)
    expect(cells.find((cell) => cell.code === "01")?.amount).toBe(0)
    expect(cells.find((cell) => cell.code === "03")?.amount).toBe(0)
    expect(cells.find((cell) => cell.code === "38")?.amount).toBe(300)
    expect(cells.find((cell) => cell.code === "39")?.amount).toBe(75)
    expect(cells.find((cell) => cell.code === "17")?.amountText).toBe("17,00 %")
    expect(cells.find((cell) => cell.code === "29")?.amount).toBe(100)

    const content = generateAeatTxt(detail, "ITALIANS DO IT BETTER S.L.", "B67330225").toString("latin1")
    const page1 = content.slice(content.indexOf("<T20201000>"), content.indexOf("<T20201000>") + 700)
    const page2 = content.slice(content.indexOf("<T20202000>"), content.indexOf("<T20202000>") + 900)
    expect(page1[147]).toBe("B")
    expect(page1.slice(107, 109)).toBe("2P")
    expect(page1.slice(148, 165)).toBe("00000000000000000")
    expect(page1.slice(318, 335)).toBe("00000000000030000")
    expect(page1.slice(335, 352)).toBe("00000000000007500")
    expect(page2.slice(12, 29)).toBe("00000000000822500")
    expect(page2.slice(29, 34)).toBe("01700")
    expect(page2.slice(411, 416)).toBe("10000")
    expect(buildAeatTxtFilename(detail, "B67330225")).toBe("B6733022520262P.202")
    expect(validateAeatSubmission(detail, "ITALIANS DO IT BETTER S.L.", "B67330225").valid).toBe(true)
  })

  it("no da por válido el fichero si falta el CNAE", () => {
    const detail = detail202()
    detail.breakdown = detail.breakdown.map((item) => (item.key === "cnae" ? { ...item, label: "" } : item))
    const validation = validateAeatSubmission(detail, "ITALIANS DO IT BETTER S.L.", "B67330225")
    expect(validation.valid).toBe(false)
    expect(validation.issues.some((issue) => issue.code === "DR202_CNAE")).toBe(true)
  })
})
