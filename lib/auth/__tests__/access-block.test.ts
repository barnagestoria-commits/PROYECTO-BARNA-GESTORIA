import { describe, expect, it } from "vitest"
import { ACCESS_BLOCKED_MESSAGE, blockTargetError } from "@/lib/auth/access-block"

describe("bloqueo de acceso", () => {
  it("impide bloquear al propio operador", () => {
    expect(
      blockTargetError({
        operatorUserId: "op",
        targetUserId: "op",
        targetIsOperator: true,
      }),
    ).toMatch(/operador/)
  })

  it("deja bloquear a un cliente", () => {
    expect(
      blockTargetError({
        operatorUserId: "op",
        targetUserId: "cliente",
        targetIsOperator: false,
      }),
    ).toBeNull()
  })

  it("explica el bloqueo sin detallar el motivo interno", () => {
    expect(ACCESS_BLOCKED_MESSAGE).toMatch(/infotaxlyn@gmail.com/)
  })
})
