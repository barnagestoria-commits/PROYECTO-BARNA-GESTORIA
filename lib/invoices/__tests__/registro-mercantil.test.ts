import { describe, expect, it } from "vitest"
import {
  formatRegistroMercantilLine,
  hasRegistroMercantil,
  isSociedadMercantil,
} from "@/lib/invoices/registro-mercantil"

describe("registro mercantil", () => {
  it("detects sociedad mercantil", () => {
    expect(isSociedadMercantil("PERSONA_JURIDICA")).toBe(true)
    expect(isSociedadMercantil("PERSONA_FISICA")).toBe(false)
  })

  it("formats legal line for companies", () => {
    const line = formatRegistroMercantilLine({
      provincia: "Barcelona",
      tomo: "1234",
      libro: "567",
      folio: "89",
      hoja: "B-123456",
      seccion: "8",
      inscripcion: "1",
    })
    expect(line).toContain("Registro Mercantil de Barcelona")
    expect(line).toContain("Tomo 1234")
    expect(line).toContain("Inscripción 1")
  })

  it("returns null when no data", () => {
    expect(hasRegistroMercantil({ provincia: "", tomo: "", libro: "", folio: "", hoja: "", seccion: "", inscripcion: "" })).toBe(false)
    expect(formatRegistroMercantilLine(null)).toBeNull()
  })
})
