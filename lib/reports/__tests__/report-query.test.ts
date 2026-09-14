import { describe, expect, it } from "vitest"
import { parseAccountDetailLevel, parseReportQueryFromUrl } from "@/lib/reports/report-query"

describe("report-query detail level", () => {
  it("defaults to subcuentas", () => {
    expect(parseAccountDetailLevel(null)).toBe("SUBCUENTAS")
    expect(parseAccountDetailLevel("nope")).toBe("SUBCUENTAS")
  })

  it("reads Niveles a listar from the report URL", () => {
    const parsed = parseReportQueryFromUrl(
      new URL("https://example.test/api/reports/balance/preview?year=2026&detail=NIVEL_3"),
    )
    expect("error" in parsed).toBe(false)
    if ("error" in parsed) return
    expect(parsed.year).toBe(2026)
    expect(parsed.detailLevel).toBe("NIVEL_3")
  })
})
