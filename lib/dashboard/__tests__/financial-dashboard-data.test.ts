import { describe, expect, it } from "vitest"
import {
  createEmptyFinancialDashboardData,
  formatEuro,
  formatPercent,
} from "@/lib/dashboard/financial-dashboard-data"

describe("financial dashboard data", () => {
  it("returns zeroed metrics when there is no accounting data", () => {
    const data = createEmptyFinancialDashboardData("this_month")

    expect(data.kpis.ingresos.value).toBe(0)
    expect(data.kpis.gastos.value).toBe(0)
    expect(data.kpis.beneficio.value).toBe(0)
    expect(data.kpis.pendientes.value).toBe(0)
    expect(data.kpis.pendientes.count).toBe(0)
    expect(data.evolution).toEqual([])
    expect(data.expenseCategories).toEqual([])
    expect(data.transactions).toEqual([])
    expect(data.alerts).toEqual([])
  })

  it("formats currency and percent helpers", () => {
    expect(formatEuro(0)).toContain("0")
    expect(formatEuro(1250, { signed: true })).toContain("+")
    expect(formatPercent(0)).toBe("0.0%")
    expect(formatPercent(12.4)).toBe("+12.4%")
  })
})
