import { describe, expect, it } from "vitest"
import { calculateTotals } from "@/lib/accounting/command-templates"
import type { AccountingEntryLine } from "@/lib/accounting/entry-types"

function line(partial: Partial<AccountingEntryLine> & Pick<AccountingEntryLine, "cuenta">): AccountingEntryLine {
  return {
    id: partial.id ?? "1",
    concepto: partial.concepto ?? "",
    debe: partial.debe ?? 0,
    haber: partial.haber ?? 0,
    ...partial,
  }
}

describe("calculateTotals", () => {
  it("equilibra un asiento simple debe = haber", () => {
    const totals = calculateTotals([
      line({ cuenta: "572000000001", debe: 500, haber: 0 }),
      line({ cuenta: "430000000001", debe: 0, haber: 500 }),
    ])

    expect(totals.debe).toBe(500)
    expect(totals.haber).toBe(500)
    expect(totals.difference).toBe(0)
    expect(totals.isBalanced).toBe(true)
  })

  it("detecta asientos desequilibrados", () => {
    const totals = calculateTotals([
      line({ cuenta: "629000000003", debe: 100, haber: 0 }),
      line({ cuenta: "400000000001", debe: 0, haber: 99 }),
    ])

    expect(totals.difference).toBe(1)
    expect(totals.isBalanced).toBe(false)
  })

  it("redondea a 2 decimales en la suma", () => {
    const totals = calculateTotals([
      line({ cuenta: "629000000001", debe: 0.005, haber: 0 }),
      line({ cuenta: "629000000002", debe: 0.005, haber: 0 }),
      line({ cuenta: "400000000001", debe: 0, haber: 0.01 }),
    ])

    expect(totals.debe).toBe(0.01)
    expect(totals.haber).toBe(0.01)
    expect(totals.isBalanced).toBe(true)
  })

  it("marca como no equilibrado un asiento vacío", () => {
    const totals = calculateTotals([])
    expect(totals.isBalanced).toBe(false)
  })

  it("tolera diferencias menores a 0.01 por redondeo", () => {
    const totals = calculateTotals([
      line({ cuenta: "629000000001", debe: 100.004, haber: 0 }),
      line({ cuenta: "400000000001", debe: 0, haber: 100 }),
    ])

    expect(totals.isBalanced).toBe(true)
  })

  it("calcula correctamente asientos con múltiples líneas al debe y al haber", () => {
    const totals = calculateTotals([
      line({ cuenta: "629000000003", debe: 100, haber: 0 }),
      line({ cuenta: "472000000001", debe: 21, haber: 0 }),
      line({ cuenta: "400000000523", debe: 0, haber: 121 }),
    ])

    expect(totals.debe).toBe(121)
    expect(totals.haber).toBe(121)
    expect(totals.isBalanced).toBe(true)
  })
})
