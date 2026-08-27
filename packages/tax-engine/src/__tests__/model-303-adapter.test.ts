import { describe, expect, it } from "vitest"
import {
  exportModel303Dr303,
  finalizeModel303Casillas,
  MODEL_303_PAGE_01000_LENGTH,
  MODEL_303_PAGE_03000_LENGTH,
  validateModel303Export,
} from "@gestoria/tax-engine"

describe("exportModel303Dr303", () => {
  it("generates DR303 envelope with pages 01000 and 03000 at official lengths", () => {
    const casillas = finalizeModel303Casillas({
      base01: 100000,
      cuota03: 21000,
      base04: 0,
      cuota06: 0,
      base07: 0,
      cuota09: 0,
      base10: 0,
      cuota11: 0,
      base12: 0,
      cuota13: 0,
      base28: 50000,
      cuota29: 10500,
      base30: 0,
      cuota31: 0,
      base32: 0,
      cuota33: 0,
      base34: 0,
      cuota35: 0,
      base36: 0,
      cuota37: 0,
      base38: 0,
      cuota39: 0,
      cuota110: 0,
    })

    const artifact = exportModel303Dr303({
      context: {
        modelCode: "303",
        year: 2026,
        period: "1T",
        companyNif: "B12345678",
        companyName: "EMPRESA TEST SL",
        versionKey: "AEAT:303:2026:1T:101",
      },
      casillas,
    })

    const content = artifact.content.toString("latin1")
    expect(artifact.validation.valid).toBe(true)
    expect(artifact.filename).toBe("30320261T_B12345678.303")
    expect(content.startsWith("<T303020261T0000>")).toBe(true)
    expect(content.endsWith("</T303020261T0000>")).toBe(true)
    expect(content).toContain("<AUX>")
    expect(content).toContain("</AUX>")
    expect(content).toContain("EMPRESA TEST SL")
    expect(content).toContain("B12345678")
    expect(content).not.toContain("\n")
    expect(content).not.toContain("BARNA GESTORIA")

    const page01000Start = content.indexOf("<T30301000>")
    const page01000End = content.indexOf("</T30301000>") + "</T30301000>".length
    const page03000Start = content.indexOf("<T30303000>")
    const page03000End = content.indexOf("</T30303000>") + "</T30303000>".length

    expect(page01000End - page01000Start).toBe(MODEL_303_PAGE_01000_LENGTH)
    expect(page03000End - page03000Start).toBe(MODEL_303_PAGE_03000_LENGTH)
    const page01000 = content.slice(page01000Start, page01000End)
    const page03000 = content.slice(page03000Start, page03000End)
    expect(page01000.slice(208, 225)).toBe("00000000010000000")
    expect(page01000.slice(225, 230)).toBe("02100")
    expect(page01000.slice(230, 247)).toBe("00000000002100000")
    expect(page03000.slice(215, 220)).toBe("10000")
    expect(page03000.slice(407, 424)).toBe(" 0000000001050000")
    expect(validateModel303Export(content, {
      modelCode: "303",
      year: 2026,
      period: "1T",
      companyNif: "B12345678",
      companyName: "EMPRESA TEST SL",
    }).valid).toBe(true)
  })
})
