import { describe, expect, it } from "vitest"
import { describePlan, validatePlanRequest } from "@/lib/billing/plan-request"

describe("describePlan", () => {
  it("describes the fixed autónomo plan without a tier", () => {
    const plan = describePlan("CLIENTE_FINAL", null)
    expect(plan?.priceEuros).toBe(100)
    expect(plan?.tierId).toBeNull()
  })

  it("needs a valid tier for empresa and gestoría", () => {
    expect(describePlan("EMPRESA", null)).toBeNull()
    expect(describePlan("EMPRESA", "no-existe")).toBeNull()
    expect(describePlan("GESTORIA", null)).toBeNull()
    expect(describePlan("EMPRESA", "empresa-esencial")?.priceEuros).toBe(450)
    expect(describePlan("GESTORIA", "gestoria-50")?.priceEuros).toBe(1000)
    expect(describePlan("EMPRESA", "empresa-corporativa")?.priceEuros).toBeNull()
  })
})

describe("validatePlanRequest", () => {
  it("accepts upgrades along the allowed paths", () => {
    expect(validatePlanRequest({ accountType: "CLIENTE_FINAL", planTierId: null }, "EMPRESA", "empresa-esencial")).toBeNull()
    expect(validatePlanRequest({ accountType: "CLIENTE_FINAL", planTierId: null }, "GESTORIA", "gestoria-50")).toBeNull()
    expect(validatePlanRequest({ accountType: "EMPRESA", planTierId: null }, "GESTORIA", "gestoria-100")).toBeNull()
  })

  it("lets an empresa pick its first tier and move up, but not down", () => {
    expect(validatePlanRequest({ accountType: "EMPRESA", planTierId: null }, "EMPRESA", "empresa-esencial")).toBeNull()
    expect(validatePlanRequest({ accountType: "EMPRESA", planTierId: "empresa-esencial" }, "EMPRESA", "empresa-crecimiento")).toBeNull()
    expect(validatePlanRequest({ accountType: "EMPRESA", planTierId: "empresa-avanzada" }, "EMPRESA", "empresa-esencial")).toMatch(/bajar de tramo/)
  })

  it("rejects downgrades and unknown tiers", () => {
    expect(validatePlanRequest({ accountType: "GESTORIA", planTierId: "gestoria-50" }, "EMPRESA", "empresa-esencial")).toMatch(/inferior/)
    expect(validatePlanRequest({ accountType: "EMPRESA", planTierId: null }, "CLIENTE_FINAL", null)).toMatch(/no disponible/)
    expect(validatePlanRequest({ accountType: "CLIENTE_FINAL", planTierId: null }, "EMPRESA", "x")).toMatch(/tramo de empresa/)
  })
})
