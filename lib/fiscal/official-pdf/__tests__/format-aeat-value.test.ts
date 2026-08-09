import { describe, expect, it } from "vitest"
import { formatAeatAmount, formatAeatPeriod } from "@/lib/fiscal/official-pdf/format-aeat-value"

describe("formatAeatAmount", () => {
  it("formatea importes al estilo AEAT", () => {
    expect(formatAeatAmount(2532454.16)).toBe("2.532.454,16")
    expect(formatAeatAmount(0)).toBe("0,00")
    expect(formatAeatAmount(-110116.19)).toBe("-110.116,19")
  })
})

describe("formatAeatPeriod", () => {
  it("convierte trimestre y anual", () => {
    expect(formatAeatPeriod(2)).toBe("2T")
    expect(formatAeatPeriod("annual")).toBe("0A")
  })
})
