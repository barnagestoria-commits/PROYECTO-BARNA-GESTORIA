import { describe, expect, it } from "vitest"
import {
  buildModel303CasillaValues,
  buildOfficialModel303Sections,
} from "@/lib/fiscal/model-303/official-layout"
import type { FiscalModelDetailResponse } from "@/lib/types/fiscal-panorama"

const baseDetail: FiscalModelDetailResponse = {
  modelCode: "303",
  modelLabel: "Modelo 303",
  year: 2026,
  quarter: 3,
  periodLabel: "3T 2026",
  amount: 1000,
  status: "sin_datos",
  statusLabel: "SD",
  breakdown: [
    { key: "repercutido", label: "IVA repercutido", total: 5000, lines: [] },
    { key: "soportado", label: "IVA soportado", total: 4000, lines: [] },
  ],
}

describe("model 303 official layout", () => {
  it("builds all AEAT sections and casillas", () => {
    const sections = buildOfficialModel303Sections(baseDetail)
    expect(sections).toHaveLength(3)
    expect(sections[0].title).toContain("devengado")
    expect(sections[1].title).toContain("deducible")
    expect(sections[2].title).toContain("Resultado")

    const codes = sections.flatMap((section) => section.casillas.map((cell) => cell.code))
    expect(codes).toContain("01")
    expect(codes).toContain("27")
    expect(codes).toContain("45")
    expect(codes).toContain("46")
    expect(codes).toContain("71")
  })

  it("calculates totals from repercutido and soportado", () => {
    const values = buildModel303CasillaValues(baseDetail)
    expect(values.cuota03).toBe(5000)
    expect(values.cuota29).toBe(4000)
    expect(values.cuota27).toBe(5000)
    expect(values.cuota45).toBe(4000)
    expect(values.cuota46).toBe(1000)
    expect(values.cuota71).toBe(1000)
  })

  it("returns zeroed casillas when there is no data", () => {
    const empty: FiscalModelDetailResponse = {
      ...baseDetail,
      amount: 0,
      breakdown: [],
    }
    const values = buildModel303CasillaValues(empty)
    expect(values.cuota27).toBe(0)
    expect(values.cuota45).toBe(0)
    expect(values.cuota71).toBe(0)
  })
})
