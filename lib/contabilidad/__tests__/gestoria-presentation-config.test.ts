import { describe, expect, it } from "vitest"
import {
  createDefaultPresentationConfig,
  defaultAccountingPlanForEntity,
  syncPresentationWithAccountingPlan,
} from "@/lib/contabilidad/gestoria-presentation-config"

describe("gestoria-presentation-config", () => {
  it("asigna IRPF por defecto a autónomos", () => {
    const config = createDefaultPresentationConfig("fisica")
    expect(config.balanceFormat).toBe("IRPF_SIMPLIFICADO")
    expect(config.profitLossFormat).toBe("IRPF")
    expect(config.corporateTax.enabled).toBe(false)
    expect(config.model232Enabled).toBe(false)
  })

  it("asigna Pymes e IS por defecto a sociedades", () => {
    const config = createDefaultPresentationConfig("juridica")
    expect(config.balanceFormat).toBe("BALANCE_PYMES")
    expect(config.profitLossFormat).toBe("PYG_PYMES")
    expect(config.corporateTax.enabled).toBe(true)
    expect(config.model232Enabled).toBe(true)
    expect(config.annualAccounts.includeEcpn).toBe(true)
  })

  it("sincroniza balances al cambiar plan contable", () => {
    const base = createDefaultPresentationConfig("juridica")
    const synced = syncPresentationWithAccountingPlan(base, "PGC_GENERAL", "juridica")
    expect(synced.balanceFormat).toBe("BALANCE_NORMAL")
    expect(synced.profitLossFormat).toBe("PYG_NORMAL")
    expect(synced.annualAccounts.balanceFormat).toBe("BALANCE_NORMAL")
  })

  it("resuelve plan contable por tipo de entidad", () => {
    expect(defaultAccountingPlanForEntity("fisica")).toBe("PGC_MICRO")
    expect(defaultAccountingPlanForEntity("juridica")).toBe("PGC_PYME")
  })
})
