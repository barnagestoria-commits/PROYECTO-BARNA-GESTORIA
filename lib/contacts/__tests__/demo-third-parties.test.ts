import { describe, expect, it } from "vitest"
import {
  isDemoAccountName,
  isDemoNif,
  isDemoThirdParty,
} from "@/lib/contacts/demo-contacts"

describe("demo third parties", () => {
  it("detects DIGI as a demo account by NIF and by name", () => {
    expect(isDemoNif("A84919760")).toBe(true)
    expect(isDemoAccountName("DIGI SPAIN TELECOM, S.A.U.")).toBe(true)
    expect(
      isDemoThirdParty({
        cif: "A-84919760",
        name: "DIGI SPAIN TELECOM, S.A.U.",
        accountCode: "400.0001",
      }),
    ).toBe(true)
  })

  it("does not treat real suppliers as demo accounts", () => {
    expect(
      isDemoThirdParty({
        cif: "B63272603",
        name: "ESTACION SERVICIO MATARO S.L.",
        accountCode: "410.0002",
      }),
    ).toBe(false)
    expect(
      isDemoThirdParty({
        cif: "B12345678",
        name: "CATCHER MARKETPLACE SL",
        accountCode: "410.0001",
      }),
    ).toBe(false)
  })
})
