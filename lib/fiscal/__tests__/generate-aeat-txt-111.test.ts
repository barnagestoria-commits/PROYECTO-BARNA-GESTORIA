import { describe, expect, it } from "vitest"
import { generateModel111AeatTxt, MODEL_111_PAGE_LENGTH } from "@/lib/fiscal/aeat/generate-aeat-txt-111"
import { buildAeatTxtFilename, generateAeatTxt } from "@/lib/fiscal/aeat/generate-aeat-txt"
import { validateAeatSubmission } from "@/lib/fiscal/aeat/validate-submission"
import type { FiscalModelDetailResponse } from "@/lib/types/fiscal-panorama"

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

function pageOf(content: string): string {
  const start = content.indexOf("<T11101000>")
  return content.slice(start, start + MODEL_111_PAGE_LENGTH)
}

describe("fichero DR111", () => {
  it("genera la página oficial de 1000 posiciones con las retenciones en trabajo dinerario", () => {
    const detail = detail111(1500)
    const content = generateAeatTxt(detail, "EMPRESA TEST S.L.", "B12345678").toString("latin1")
    const page = pageOf(content)

    expect(content.startsWith("<T111020261T0000>")).toBe(true)
    expect(content.endsWith("</T111020261T0000>")).toBe(true)
    expect(content.includes("<AUX>")).toBe(true)
    expect(content.includes("</AUX>")).toBe(true)
    expect(content.includes("\n")).toBe(false)
    expect(page).toHaveLength(MODEL_111_PAGE_LENGTH)
    expect(page.endsWith("</T11101000>")).toBe(true)
    expect(page[12]).toBe("I")
    expect(page.slice(13, 22)).toBe("B12345678")
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
    expect(buildAeatTxtFilename(detail, "B12345678")).toBe("B1234567820261T.111")

    const validation = validateAeatSubmission(detail, "EMPRESA TEST S.L.", "B12345678")
    expect(validation.valid).toBe(true)
    expect(validation.issues.filter((issue) => issue.severity === "error")).toEqual([])
  })

  it("marca negativa cuando no hay nada que ingresar", () => {
    const detail = detail111(0)
    const page = pageOf(generateModel111AeatTxt(detail, "EMPRESA TEST SL", "B12345678").toString("latin1"))
    expect(page[12]).toBe("N")
    expect(page.slice(108, 116)).toBe("00000000")
    expect(page.slice(520, 537)).toBe("00000000000000000")
  })
})
