import { describe, expect, it } from "vitest"
import { extractAccountMatchesSearch } from "@/lib/accounting/extract-account-search"

const catcher = { cuenta: "41000001", label: "Catcher Marketplace SL" }
const fernandez = { cuenta: "43000019", label: "Fernández Vega" }
const iva = { cuenta: "472", label: "Hacienda Pública, IVA soportado" }
const ivaSub = { cuenta: "411", label: "Acreedores, efectos comerciales a pagar" }

describe("extractAccountMatchesSearch", () => {
  it("matches by description regardless of accents", () => {
    expect(extractAccountMatchesSearch(catcher, "catcher")).toBe(true)
    expect(extractAccountMatchesSearch(fernandez, "fernandez")).toBe(true)
    expect(extractAccountMatchesSearch(iva, "iva soportado")).toBe(true)
  })

  it("matches by account code and group prefix", () => {
    expect(extractAccountMatchesSearch(catcher, "410")).toBe(true)
    expect(extractAccountMatchesSearch(catcher, "410.00001")).toBe(true)
    expect(extractAccountMatchesSearch(iva, "472")).toBe(true)
    expect(extractAccountMatchesSearch(catcher, "430")).toBe(false)
  })

  it("matches 41.1 to the first 410 subaccount without mixing 411", () => {
    expect(extractAccountMatchesSearch(catcher, "41.1")).toBe(true)
    expect(extractAccountMatchesSearch(ivaSub, "41.1")).toBe(false)
  })
})