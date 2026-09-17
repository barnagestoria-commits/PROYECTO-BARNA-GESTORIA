import { describe, expect, it } from "vitest"
import {
  HOVER_MENU_PANEL_CLASS,
  hoverMenuReducer,
} from "@/lib/navigation/hover-menu"

describe("hoverMenuReducer", () => {
  it("keeps the same module open on hover instead of toggling it closed", () => {
    expect(hoverMenuReducer("ventas", { type: "open", id: "ventas" })).toBe("ventas")
  })

  it("switches from one module to another without closing first", () => {
    expect(hoverMenuReducer("ventas", { type: "open", id: "compras" })).toBe("compras")
  })

  it("does not let a stale close from Ventas kill the already open Compras menu", () => {
    expect(hoverMenuReducer("compras", { type: "close", id: "ventas" })).toBe("compras")
  })

  it("closes only the module that actually lost the pointer", () => {
    expect(hoverMenuReducer("ventas", { type: "close", id: "ventas" })).toBeNull()
  })

  it("toggles closed on an explicit click of the same chevron", () => {
    expect(hoverMenuReducer("ventas", { type: "toggle", id: "ventas" })).toBeNull()
    expect(hoverMenuReducer(null, { type: "toggle", id: "ventas" })).toBe("ventas")
  })
})

describe("hover menu panel bridge", () => {
  it("uses padding instead of margin so the pointer stays inside the menu", () => {
    expect(HOVER_MENU_PANEL_CLASS).toContain("pt-")
    expect(HOVER_MENU_PANEL_CLASS).not.toContain("mt-")
    expect(HOVER_MENU_PANEL_CLASS).toContain("top-full")
  })
})
