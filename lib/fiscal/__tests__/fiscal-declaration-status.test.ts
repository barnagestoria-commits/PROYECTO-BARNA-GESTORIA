import { describe, expect, it } from "vitest"
import { resolveCellStatus } from "@/lib/fiscal/panorama"
import { periodKeyToDeclarationQuarter } from "@/lib/fiscal/fiscal-declaration-service"

describe("resolveCellStatus", () => {
  it("respeta el estado manual de presentado", () => {
    expect(resolveCellStatus(0, 0, "PRESENTADO")).toEqual({
      status: "presentado",
      statusLabel: "Presentado",
    })
  })

  it("respeta el estado manual de pendiente aunque no haya importe", () => {
    expect(resolveCellStatus(237.33, 0, "PENDIENTE")).toEqual({
      status: "pendiente",
      statusLabel: "Pendiente",
    })
  })

  it("sin registro manual, un importe con líneas queda pendiente", () => {
    expect(resolveCellStatus(10, 2, undefined)).toEqual({
      status: "pendiente",
      statusLabel: "Pendiente",
    })
  })
})

describe("periodKeyToDeclarationQuarter", () => {
  it("mapea el resumen anual al trimestre 0", () => {
    expect(periodKeyToDeclarationQuarter("annual")).toBe(0)
    expect(periodKeyToDeclarationQuarter("q3")).toBe(3)
  })
})