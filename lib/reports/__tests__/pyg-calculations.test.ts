import { describe, expect, it } from "vitest"
import { calculatePygFromAccountTotals, gastoAmount, ingresoAmount } from "@/lib/reports/pyg-calculations"
import type { AccountTotals } from "@/lib/accounting/import-validation"

describe("pyg-calculations", () => {
  it("calcula ingresos como haber - debe (grupo 7)", () => {
    expect(ingresoAmount({ totalDebe: 0, totalHaber: 1000 })).toBe(1000)
    expect(ingresoAmount({ totalDebe: 100, totalHaber: 500 })).toBe(400)
  })

  it("calcula gastos como debe - haber (grupo 6)", () => {
    expect(gastoAmount({ totalDebe: 800, totalHaber: 0 })).toBe(800)
    expect(gastoAmount({ totalDebe: 500, totalHaber: 50 })).toBe(450)
  })

  it("calcula resultado del ejercicio", () => {
    const rows: AccountTotals[] = [
      { cuenta: "700000000001", totalDebe: 0, totalHaber: 5000, saldo: -5000 },
      { cuenta: "629000000003", totalDebe: 1200, totalHaber: 0, saldo: 1200 },
      { cuenta: "640000000001", totalDebe: 800, totalHaber: 0, saldo: 800 },
      { cuenta: "572000000001", totalDebe: 3000, totalHaber: 2500, saldo: 500 },
    ]

    const pyg = calculatePygFromAccountTotals(rows)
    expect(pyg.totalIngresos).toBe(5000)
    expect(pyg.totalGastos).toBe(2000)
    expect(pyg.resultado).toBe(3000)
  })
})
