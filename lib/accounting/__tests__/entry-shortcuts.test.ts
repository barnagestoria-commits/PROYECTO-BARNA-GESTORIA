import { describe, expect, it } from "vitest"
import {
  matchEntryShortcut,
  validateEntryShortcuts,
} from "@/lib/accounting/entry-shortcuts"
import { canCloseOwnAccount } from "@/lib/auth/account-closure"

describe("atajos del asiento", () => {
  it("distingue la búsqueda por nombre de la búsqueda por CIF", () => {
    const choice = { byName: "F4", byCif: "F8" }
    expect(matchEntryShortcut(choice, { key: "F4", altKey: false } as KeyboardEvent)).toBe("name")
    expect(matchEntryShortcut(choice, { key: "F8", altKey: false } as KeyboardEvent)).toBe("cif")
    expect(matchEntryShortcut(choice, { key: "F6", altKey: false } as KeyboardEvent)).toBeNull()
  })

  it("no deja la misma tecla en las dos búsquedas", () => {
    expect(validateEntryShortcuts({ byName: "F4", byCif: "F4" })).toMatch(/F4/)
    expect(validateEntryShortcuts({ byName: "F4", byCif: "F6" })).toBeNull()
  })
})

describe("baja de la cuenta", () => {
  it("la decide quien administra la suscripción", () => {
    expect(canCloseOwnAccount("ADMIN_GESTOR")).toBe(true)
    expect(canCloseOwnAccount("CLIENTE")).toBe(true)
    expect(canCloseOwnAccount("GESTOR")).toBe(false)
  })
})
