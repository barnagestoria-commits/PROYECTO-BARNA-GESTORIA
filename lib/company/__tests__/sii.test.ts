import { describe, expect, it } from "vitest"
import { parseSiiMode, resolveCompanySiiMode } from "@/lib/company/sii"

describe("censo SII de la empresa", () => {
  it("conserva el SII marcado en el impreso antiguo como voluntario", () => {
    expect(resolveCompanySiiMode("NONE", true)).toBe("VOLUNTARIO")
    expect(resolveCompanySiiMode("OBLIGATORIO", false)).toBe("OBLIGATORIO")
    expect(resolveCompanySiiMode("NONE", false)).toBe("NONE")
  })

  it("rechaza un régimen que no existe", () => {
    expect(parseSiiMode(undefined)).toBeUndefined()
    expect(parseSiiMode("VOLUNTARIO")).toBe("VOLUNTARIO")
    expect(() => parseSiiMode("MENSUAL")).toThrow(/no es válido/)
  })
})
