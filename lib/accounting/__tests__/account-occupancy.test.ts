import { describe, expect, it } from "vitest"
import {
  assertTargetFichaAvailable,
  blockingAccountFicha,
  occupiedAccountError,
} from "@/lib/accounting/account-occupancy"

describe("account occupancy after deleting a ficha", () => {
  it("does not treat leftover movements as occupancy", () => {
    expect(blockingAccountFicha(null, "4100004")).toBeNull()
  })

  it("blocks a live ficha on the target number", () => {
    expect(
      blockingAccountFicha(
        { accountCode: "4100003", name: "ESTACION SERVICIO MATARO S.L." },
        "4100004",
      ),
    ).toEqual({ accountCode: "4100003", name: "ESTACION SERVICIO MATARO S.L." })
  })

  it("allows a contact to keep its own current number", () => {
    expect(
      blockingAccountFicha({ accountCode: "410.0004", name: "MOTOS TRAFACH S.L." }, "4100004"),
    ).toBeNull()
  })

  it("lets Motos reuse 410.0003 when Estacion's ficha is gone", () => {
    expect(() => assertTargetFichaAvailable(null, "4100003", "4100004")).not.toThrow()
  })

  it("explains that the number is still taken while the duplicate ficha exists", () => {
    expect(() =>
      assertTargetFichaAvailable(
        { accountCode: "4100003", name: "ESTACION SERVICIO MATARO S.L." },
        "4100003",
        "4100004",
      ),
    ).toThrow(/410\.0003 ya está ocupada \(ESTACION SERVICIO MATARO S.L.\)/)
  })

  it("formats the occupied-account error with PGC zeros", () => {
    expect(occupiedAccountError("4100003", "ESTACION SERVICIO MATARO S.L.")).toBe(
      "La cuenta 410.0003 ya está ocupada (ESTACION SERVICIO MATARO S.L.).",
    )
  })
})
