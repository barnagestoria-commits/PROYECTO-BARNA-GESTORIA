import { describe, expect, it } from "vitest"
import {
  model202InstallmentPercent,
  model202PaymentForQuarter,
  settleModel202,
  type Model202Options,
} from "@/lib/fiscal/model-202"

const article403: Model202Options = {
  modality: "ART_40_3",
  taxRate: 25,
  priorNetQuota: null,
  turnoverAtLeast10m: false,
  correctionsIncrease: 0,
  correctionsDecrease: 0,
  negativeBases: 0,
}

function line(cuenta: string, haber: number, debe: number, month: number) {
  return {
    id: `${cuenta}-${month}`,
    cuenta,
    haber,
    debe,
    entry: { id: `e-${month}`, fecha: new Date(Date.UTC(2026, month - 1, 15)) },
  }
}

describe("modelo 202", () => {
  it("uses 17 percent, five sevenths of the 25 percent rate rounded down", () => {
    expect(model202InstallmentPercent(25)).toBe(17)
    expect(model202InstallmentPercent(25, true)).toBe(24)
    expect(model202PaymentForQuarter(2)).toBeNull()
    expect(model202PaymentForQuarter(3)).toBe("2P")
  })

  it("calculates the three payments on the accumulated accounting result", () => {
    const lines = [
      line("700000", 10000, 0, 2),
      line("600000", 0, 2000, 2),
      line("700000", 10000, 0, 8),
      line("630000", 0, 5000, 8),
      line("700000", 4000, 0, 11),
      line("700000", 9000, 0, 12),
    ]

    const first = settleModel202(lines, 2026, 1, article403)
    expect(first.base).toBe(8000)
    expect(first.amountDue).toBe(1360)

    const second = settleModel202(lines, 2026, 3, article403)
    expect(second.base).toBe(18000)
    expect(second.previousPayments).toBe(1360)
    expect(second.amountDue).toBe(1700)

    const third = settleModel202(lines, 2026, 4, article403)
    expect(third.base).toBe(22000)
    expect(third.amountDue).toBe(680)

    expect(settleModel202(lines, 2026, 2, article403).amountDue).toBe(0)
    expect(settleModel202(lines, 2026, "annual", article403).amountDue).toBe(3740)
    expect(first.casillas.c04).toBe(8000)
    expect(second.casillas.c05).toBe(5000)
    expect(third.casillas.c17).toBe(17)
  })

  it("repeats 18 percent of the last tax quota under article 40.2", () => {
    const options: Model202Options = { ...article403, modality: "ART_40_2", priorNetQuota: 10000 }
    expect(settleModel202([], 2026, 1, options).amountDue).toBe(1800)
    expect(settleModel202([], 2026, 3, options).amountDue).toBe(1800)
    expect(settleModel202([], 2026, 3, options).previousPayments).toBe(0)
    expect(settleModel202([], 2026, 4, options).amountDue).toBe(1800)
    expect(settleModel202([], 2026, "annual", options).amountDue).toBe(5400)
    expect(settleModel202([], 2026, 1).priorQuotaMissing).toBe(true)
    expect(settleModel202([], 2026, 1).amountDue).toBe(0)
  })

  it("uses 24 percent and the minimum when turnover reaches 10 million", () => {
    const lines = [line("700000", 10000, 0, 2)]
    const large: Model202Options = {
      ...article403,
      turnoverAtLeast10m: true,
      correctionsDecrease: 8000,
    }
    const payment = settleModel202(lines, 2026, 1, large)
    expect(payment.casillas.c17).toBe(24)
    expect(payment.casillas.c18).toBe(480)
    expect(payment.casillas.c33).toBe(2300)
    expect(payment.amountDue).toBe(2300)
  })

  it("subtracts withholdings and compensates negative bases under article 40.3", () => {
    const lines = [line("700000", 10000, 0, 2), line("473000", 0, 200, 2)]
    const payment = settleModel202(lines, 2026, 1, { ...article403, negativeBases: 3000 })
    expect(payment.casillas.c14).toBe(3000)
    expect(payment.casillas.c16).toBe(7000)
    expect(payment.casillas.c18).toBe(1190)
    expect(payment.casillas.c28).toBe(200)
    expect(payment.amountDue).toBe(990)
  })
})
