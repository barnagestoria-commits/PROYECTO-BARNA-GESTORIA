import { describe, expect, it } from "vitest"
import { mergeComparedAmounts } from "@/lib/reports/compare-years"
import { parseReportQueryFromUrl } from "@/lib/reports/report-query"

describe("comparativa de ejercicios", () => {
  it("keeps an account that only exists in the comparison year", () => {
    const rows = mergeComparedAmounts(
      [{ cuenta: "217", label: "Equipos", level: 0, amount: 44716.48 }],
      [
        { cuenta: "217", label: "Equipos", level: 0, amount: 27461.48 },
        { cuenta: "216", label: "Mobiliario", level: 0, amount: 13093.06 },
      ],
    )

    expect(rows).toEqual([
      { cuenta: "217", label: "Equipos", level: 0, amount: 44716.48, compareAmount: 27461.48 },
      { cuenta: "216", label: "Mobiliario", level: 0, amount: 0, compareAmount: 13093.06 },
    ])
  })

  it("reads the comparison year from the report address", () => {
    const parsed = parseReportQueryFromUrl(
      new URL("https://example.test/api/reports/balance/preview?year=2025&compareYear=2024"),
    )
    expect("error" in parsed).toBe(false)
    if ("error" in parsed) return
    expect(parsed.year).toBe(2025)
    expect(parsed.compareYear).toBe(2024)
  })
})
