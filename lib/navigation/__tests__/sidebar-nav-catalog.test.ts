import { describe, expect, it } from "vitest"
import { getSidebarNavModules, isNavLinkActive } from "@/lib/navigation/sidebar-nav"

function catalogLabels(accountType: "CLIENTE_FINAL" | "EMPRESA" | "GESTORIA" = "CLIENTE_FINAL") {
  return getSidebarNavModules(accountType).flatMap((module) => [
    module.label,
    ...(module.sections?.flatMap((section) => [
      section.title,
      ...section.items.map((item) => item.label),
    ]) ?? []),
  ])
}

describe("sidebar nav catalog", () => {
  it("includes balances and the quarterly fiscal breakdown for every profile", () => {
    for (const accountType of ["CLIENTE_FINAL", "EMPRESA", "GESTORIA"] as const) {
      const labels = catalogLabels(accountType)
      expect(labels).toContain("Balance de situación")
      expect(labels).toContain("Pérdidas y ganancias")
      expect(labels).toContain("Asiento de ventas")
      expect(labels).toContain("Asiento de gastos")
      expect(labels).toContain("Resumen trimestral")
      expect(labels).toContain("Modelo 303 — IVA")
      expect(labels).toContain("Modelo 180 — Resumen anual")
      expect(labels).toContain("Analítica")
      expect(labels).toContain("Libro registro de facturas")
      expect(labels).toContain("Impuestos")
    }
  })

  it("does not expose laboral, payroll or unused gestoría stubs", () => {
    for (const accountType of ["CLIENTE_FINAL", "EMPRESA", "GESTORIA"] as const) {
      const labels = catalogLabels(accountType)
      expect(labels).not.toContain("Laboral")
      expect(labels).not.toContain("Nóminas")
      expect(labels).not.toContain("RRHH")
      expect(labels).not.toContain("Gestión Laboral")
      expect(labels).not.toContain("Constitución de Empresas")
      expect(labels).not.toContain("Presupuestos")
      expect(labels).not.toContain("Ingresos del periodo")
      expect(labels).not.toContain("Gastos deducibles")
      expect(labels).not.toContain("Informes PDF / Excel")
      expect(labels).not.toContain("Captura documental")
      expect(labels).not.toContain("Exportación")
    }
  })

  it("abre el asiento de ventas y el de gastos sin confundirlos con el diario", () => {
    expect(isNavLinkActive("/dashboard/contabilidad?comando=17", "/dashboard/contabilidad", "comando=17")).toBe(
      true,
    )
    expect(isNavLinkActive("/dashboard/contabilidad?comando=34", "/dashboard/contabilidad", "comando=17")).toBe(
      false,
    )
    expect(isNavLinkActive("/dashboard/contabilidad", "/dashboard/contabilidad", "comando=17")).toBe(false)
    expect(isNavLinkActive("/dashboard/contabilidad", "/dashboard/contabilidad")).toBe(true)
  })
})
