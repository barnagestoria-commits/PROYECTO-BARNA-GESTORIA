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
        companyNif: "B12345674",
        companyName: "EMPRESA TEST SL",
        versionKey: "AEAT:303:2026:1T:101",
        software: { version: "0102", developerNif: "B12345674" },
      },
      casillas,
    })

    const content = artifact.content.toString("latin1")
    expect(artifact.validation.valid).toBe(true)
    expect(artifact.filename).toBe("30320261T_B12345674.303")
    expect(content.startsWith("<T303020261T0000>")).toBe(true)
    expect(content.endsWith("</T303020261T0000>")).toBe(true)
    expect(content).toContain("<AUX>")
    expect(content).toContain("</AUX>")
    expect(content).toContain("EMPRESA TEST SL")
    expect(content).toContain("B12345674")
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
    expect(page01000.slice(108, 117)).toBe("223222222")
    expect(page01000.slice(117, 125)).toBe("        ")
    expect(page01000.slice(125, 126)).toBe(" ")
    expect(page01000.slice(126, 130)).toBe("2000")
    expect(page01000.slice(208, 225)).toBe("00000000010000000")
    expect(page01000.slice(225, 230)).toBe("02100")
    expect(page01000.slice(230, 247)).toBe("00000000002100000")
    expect(page03000.slice(215, 220)).toBe("10000")
    expect(page03000.slice(407, 424)).toBe(" 0000000001050000")
    expect(validateModel303Export(content, {
      modelCode: "303",
      year: 2026,
      period: "1T",
      companyNif: "B12345674",
      companyName: "EMPRESA TEST SL",
      software: { version: "0102", developerNif: "B12345674" },
    }).valid).toBe(true)
  })

  it("uses compensation type C for a negative quarterly result", () => {
    const casillas = finalizeModel303Casillas({
      base01: 1000, cuota03: 210, base04: 0, cuota06: 0, base07: 0, cuota09: 0,
      base10: 0, cuota11: 0, base12: 0, cuota13: 0, base28: 2000, cuota29: 420,
      base30: 0, cuota31: 0, base32: 0, cuota33: 0, base34: 0, cuota35: 0,
      base36: 0, cuota37: 0, base38: 0, cuota39: 0, cuota110: 0,
    })
    const artifact = exportModel303Dr303({
      context: {
        modelCode: "303",
        year: 2026,
        period: "1T",
        companyNif: "B12345674",
        companyName: "EMPRESA TEST SL",
        software: { version: "0102", developerNif: "B12345674" },
      },
      casillas,
    })
    const content = artifact.content.toString("latin1")
    const page = content.slice(content.indexOf("<T30301000>"))

    expect(page.slice(12, 13)).toBe("C")
    expect(artifact.validation.valid).toBe(true)
  })

  it("rejects missing or fictitious developer identity", () => {
    const casillas = finalizeModel303Casillas({
      base01: 0, cuota03: 0, base04: 0, cuota06: 0, base07: 0, cuota09: 0,
      base10: 0, cuota11: 0, base12: 0, cuota13: 0, base28: 0, cuota29: 0,
      base30: 0, cuota31: 0, base32: 0, cuota33: 0, base34: 0, cuota35: 0,
      base36: 0, cuota37: 0, base38: 0, cuota39: 0, cuota110: 0,
    })
    const baseContext = {
      modelCode: "303",
      year: 2026,
      period: "1T",
      companyNif: "B12345674",
      companyName: "EMPRESA TEST SL",
    }
    const missing = exportModel303Dr303({ context: baseContext, casillas })
    const fictitious = exportModel303Dr303({
      context: {
        ...baseContext,
        software: { version: "0102", developerNif: "B66287063" },
      },
      casillas,
    })
    const noActivityContent = missing.content.toString("latin1")
    const noActivityPage = noActivityContent.slice(noActivityContent.indexOf("<T30303000>"))

    expect(missing.validation.issues.some((issue) => issue.code === "MISSING_SOFTWARE_IDENTITY")).toBe(true)
    expect(fictitious.validation.issues.some((issue) => issue.code === "INVALID_DEVELOPER_NIF")).toBe(true)
    expect(noActivityPage.slice(424, 425)).toBe("X")
  })

  it("requires the official annual flags in 4T", () => {
    const casillas = finalizeModel303Casillas({
      base01: 0, cuota03: 0, base04: 0, cuota06: 0, base07: 0, cuota09: 0,
      base10: 0, cuota11: 0, base12: 0, cuota13: 0, base28: 0, cuota29: 0,
      base30: 0, cuota31: 0, base32: 0, cuota33: 0, base34: 0, cuota35: 0,
      base36: 0, cuota37: 0, base38: 0, cuota39: 0, cuota110: 0,
    })
    const artifact = exportModel303Dr303({
      context: {
        modelCode: "303",
        year: 2026,
        period: "4T",
        companyNif: "B12345674",
        companyName: "EMPRESA TEST SL",
        software: { version: "0102", developerNif: "B12345674" },
      },
      casillas,
    })

    expect(artifact.validation.valid).toBe(false)
    expect(artifact.validation.issues.some((issue) => issue.code === "MISSING_FIELD_128")).toBe(true)
    expect(artifact.validation.issues.some((issue) => issue.code === "MISSING_FIELD_129")).toBe(true)
  })
})
