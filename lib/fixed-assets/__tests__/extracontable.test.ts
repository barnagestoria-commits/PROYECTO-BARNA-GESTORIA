import { describe, expect, it } from "vitest"
import { buildExtracontableReport, type ExtracontableAsset } from "@/lib/fixed-assets/extracontable"
import { settleModel202, type Model202Options } from "@/lib/fiscal/model-202"

const laptop: ExtracontableAsset = {
  code: "2",
  name: "PORTATIL GAMING HP VICTUS",
  adjustmentKind: "LIBRE_ACELERADA",
  acquisitionDate: new Date(Date.UTC(2026, 0, 15)),
  acquisitionCost: 1200,
  residualValue: 0,
  usefulLifeMonths: 12,
  fiscalAnnualPercent: 0,
}

describe("ajustes extracontables", () => {
  it("treats accounting depreciation above the fiscal amount as an increase", () => {
    const report = buildExtracontableReport([laptop], 2026, 25, 1)
    expect(report.rows[0]?.accountingPeriod).toBe(100)
    expect(report.rows[0]?.fiscalPeriod).toBe(0)
    expect(report.increase).toBe(100)
    expect(report.rows[0]?.deferredPeriod).toBe(25)
    expect(report.decrease).toBe(0)
  })

  it("treats a higher fiscal coefficient as a decrease", () => {
    const accelerated: ExtracontableAsset = {
      ...laptop,
      usefulLifeMonths: 60,
      fiscalAnnualPercent: 100,
    }
    const report = buildExtracontableReport([accelerated], 2026, 25, 3)
    expect(report.rows[0]?.accountingPeriod).toBe(60)
    expect(report.rows[0]?.fiscalPeriod).toBe(300)
    expect(report.decrease).toBe(240)
    expect(report.increase).toBe(0)
  })

  it("adds the depreciation difference to modelo 202 article 40.3", () => {
    const options: Model202Options = {
      modality: "ART_40_3",
      taxRate: 25,
      priorNetQuota: null,
      turnoverAtLeast10m: false,
      correctionsIncrease: 0,
      correctionsDecrease: 0,
      negativeBases: 0,
      assets: [laptop],
    }
    const payment = settleModel202([], 2026, 1, options)
    expect(payment.casillas.c07).toBe(300)
    expect(payment.casillas.c16).toBe(300)
    expect(payment.amountDue).toBe(51)
  })
})
