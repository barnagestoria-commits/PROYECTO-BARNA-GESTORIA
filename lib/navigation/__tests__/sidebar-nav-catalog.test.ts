import { describe, expect, it } from "vitest"
import { getSidebarNavModules } from "@/lib/navigation/sidebar-nav"

function catalogLabels(accountType: "CLIENTE_FINAL" | "EMPRESA" | "GESTORIA" = "CLIENTE_FINAL") {
  return getSidebarNavModules(accountType).flatMap((module) => [
    module.label,
    ...(module.sections?.flatMap((section) => section.items.map((item) => item.label)) ?? []),
  ])
}

describe("sidebar nav catalog", () => {
  it("includes balances and the quarterly fiscal breakdown for every profile", () => {
    for (const accountType of ["CLIENTE_FINAL", "EMPRESA", "GESTORIA"] as const) {
      const labels = catalogLabels(accountType)
      expect(labels).toContain("Balance de situación")
      expect(labels).toContain("Pérdidas y ganancias")
      expect(labels).toContain("Informes PDF / Excel")
      expect(labels).toContain("Resumen trimestral")
      expect(labels).toContain("Modelo 303 — IVA")
      expect(labels).toContain("Modelo 180 — Resumen anual")
      expect(labels).toContain("Analítica")
      expect(labels).toContain("Impuestos")
    }
  })
})
