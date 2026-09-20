import { describe, expect, it } from "vitest"
import { AEAT_OFFICIAL_PORTALS } from "@/lib/fiscal/aeat/official-sources"
import { FISCAL_MODEL_OPTIONS } from "@/lib/fiscal/fiscal-settings"
import {
  getFiscalPresentationChoice,
  officialBooksLabel,
  officialFormatsForModel,
  officialModelFileLabel,
  officialPackLabel,
  parsePresentationQuarter,
  presentationQuarterForModel,
} from "@/lib/fiscal/presentation-choice"

describe("fiscal presentation choice", () => {
  it("offers both the Sede and official files for the 303 without preferring one", () => {
    const choice = getFiscalPresentationChoice({ modelCode: "303", quarter: 2 })
    expect(choice.offersModelFile).toBe(true)
    expect(choice.offersBooks).toBe(true)
    expect(choice.offersOfficialPack).toBe(true)
    expect(choice.modelFileLabel).toBe("Fichero AEAT .303")
    expect(choice.booksLabel).toBe("Libros Excel Hacienda")
    expect(choice.sedeTitle).toBe("Presentar en Hacienda")
    expect(choice.filesTitle).toBe("Presentar con ficheros")
    expect(choice.sedeUrl).toContain("modelo-303")
    expect(choice.headerDescription).toMatch(/tú eliges/i)
    expect(choice.filesDescription).toMatch(/tú decides/i)
    expect(choice.filesDescription).toMatch(/conexión/i)
    expect(choice.modelFileHint).toMatch(/303/)
    expect(choice.booksHint).toMatch(/Pre303|facturas/i)
  })

  it("offers both the Sede and official files for the 130", () => {
    const choice = getFiscalPresentationChoice({ modelCode: "130", quarter: 2 })
    expect(choice.offersModelFile).toBe(true)
    expect(choice.offersBooks).toBe(true)
    expect(choice.sedeUrl).toBe(AEAT_OFFICIAL_PORTALS.pre130Service)
    expect(choice.booksHint).toMatch(/130/)
  })

  it("keeps the model file without libros for retentions", () => {
    const choice = getFiscalPresentationChoice({ modelCode: "111", quarter: 1 })
    expect(choice.offersModelFile).toBe(true)
    expect(choice.offersBooks).toBe(false)
    expect(choice.offersOfficialPack).toBe(true)
    expect(choice.sedeUrl).toBe(AEAT_OFFICIAL_PORTALS.declarationsByModel)
  })

  it("does not offer a 303 telematic file on the annual summary", () => {
    const choice = getFiscalPresentationChoice({ modelCode: "303", quarter: "anual" })
    expect(choice.offersModelFile).toBe(false)
    expect(choice.offersBooks).toBe(false)
    expect(choice.offersOfficialPack).toBe(true)
    expect(officialFormatsForModel({ modelCode: "303", quarter: "anual" })).toEqual(["zip"])
  })

  it("offers the official file for every user model in its filing period", () => {
    const quarterly = ["111", "115", "123", "130", "303", "349"] as const
    const annual = ["180", "190", "347", "390"] as const

    const enabledIds = FISCAL_MODEL_OPTIONS.map((model) => model.id)
    expect(enabledIds).toHaveLength(quarterly.length + annual.length)
    expect(enabledIds.sort()).toEqual([...quarterly, ...annual].sort())

    for (const model of quarterly) {
      const choice = getFiscalPresentationChoice({ modelCode: model, quarter: 2 })
      expect(choice.offersModelFile, model).toBe(true)
      expect(choice.sedeUrl.length, model).toBeGreaterThan(0)
      expect(officialFormatsForModel({ modelCode: model, quarter: 2 })).toContain("txt")
    }

    for (const model of annual) {
      expect(presentationQuarterForModel(model, 3)).toBe("annual")
      const choice = getFiscalPresentationChoice({ modelCode: model, quarter: "anual" })
      expect(choice.offersModelFile, model).toBe(true)
      expect(choice.offersBooks, model).toBe(false)
      expect(officialFormatsForModel({ modelCode: model, quarter: "anual" })).toEqual(["txt", "zip"])
    }
  })

  it("labels official files by model extension", () => {
    expect(officialModelFileLabel("130")).toBe("Fichero AEAT .130")
    expect(officialBooksLabel()).toBe("Libros Excel Hacienda")
    expect(officialPackLabel()).toBe("Guardar todo")
    expect(parsePresentationQuarter("3")).toBe(3)
    expect(parsePresentationQuarter("annual")).toBe("annual")
    expect(presentationQuarterForModel("111", 2)).toBe(2)
  })
})
